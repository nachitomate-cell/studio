"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { query, collection, orderBy, limit, onSnapshot, doc, setDoc, updateDoc, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
// DESACTIVADO: import { registrarCompra } from "@/lib/puntos"; — reemplazado por Handshake Digital
import {
  ArrowLeft, QrCode, Camera,
  Loader2, AlertCircle, TrendingUp, Users,
  Gift, Clock, ChevronRight, LayoutDashboard,
  X, Store, Save, ImagePlus, UserCircle, Upload, Copy, Download,
  DollarSign, BarChart2, RefreshCw, FileDown,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import QRCode from "react-qr-code";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/data";
import ValidarPanel from "@/components/ValidarPanel";

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "ignaciiio.mate@gmail.com").trim().toLowerCase();

// ── Helpers CRM ──────────────────────────────────────────────────────────────
function currentMonth() {
  return new Date().toISOString().substring(0, 7); // "YYYY-MM"
}

function formatCLP(n: number) {
  return n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
}

interface VentaRecord {
  id: string;
  clienteId: string;
  clienteNombre: string;
  fecha: string;
  monto?: number;
  metodo?: string;
}

interface ClienteStats {
  clienteId: string;
  nombre: string;
  visitas: number;
  gasto: number;
  ultimaVisita: string;
}

function calcularCRM(ventas: VentaRecord[]) {
  const mes = currentMonth();
  const ventasMes = ventas.filter(v => v.fecha?.startsWith(mes));

  const ingresosMes = ventasMes.reduce((s, v) => s + (v.monto || 0), 0);
  const clientesSet = new Set(ventasMes.map(v => v.clienteId));
  const clientesUnicos = clientesSet.size;

  // Clientes que volvieron (aparecen > 1 vez en todos los registros)
  const conteo: Record<string, number> = {};
  ventas.forEach(v => { conteo[v.clienteId] = (conteo[v.clienteId] || 0) + 1; });
  const retorno = Object.values(conteo).filter(c => c > 1).length;
  const tasaRetorno = ventas.length > 0
    ? Math.round((retorno / Object.keys(conteo).length) * 100)
    : 0;

  // Top clientes (todo el historial)
  const clienteMap: Record<string, ClienteStats> = {};
  ventas.forEach(v => {
    if (!clienteMap[v.clienteId]) {
      clienteMap[v.clienteId] = { clienteId: v.clienteId, nombre: v.clienteNombre || "?", visitas: 0, gasto: 0, ultimaVisita: v.fecha };
    }
    clienteMap[v.clienteId].visitas++;
    clienteMap[v.clienteId].gasto += v.monto || 0;
    if (v.fecha > clienteMap[v.clienteId].ultimaVisita) {
      clienteMap[v.clienteId].ultimaVisita = v.fecha;
    }
  });
  const topClientes = Object.values(clienteMap).sort((a, b) => b.visitas - a.visitas).slice(0, 10);

  return { ingresosMes, clientesUnicos, tasaRetorno, topClientes, totalRegistros: ventas.length };
}

export default function VendedorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [view, setView] = useState<"dashboard" | "scanner" | "profile" | "myqr" | "validar" | "clientes">("dashboard");
  const [loading, setLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [allVentas, setAllVentas] = useState<VentaRecord[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const scannerInstance = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shopForm, setShopForm] = useState({
    nombreTienda: "",
    descripcion: "",
    categoria: "",
    mediosPago: [] as string[],
    otroMedio: "",
    whatsapp: "",
    instagram: "",
    ubicacion: "",
    horario: "",
    promoText: "",
    isPremium: false,
  });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        stream.getTracks().forEach(track => track.stop && track.stop());
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    checkPermission();

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("action") === "scan") {
        setTimeout(() => {
          startScanner();
        }, 300);
      }
    }

    let unsubscribeProfile: () => void = () => {};
    let unsubscribeUser: () => void = () => {};
    let unsubscribeVentas: () => void = () => {};

    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Detectar si es admin para mostrar controles extra
        setIsAdmin((user.email || "").trim().toLowerCase() === ADMIN_EMAIL);

        const profileRef = doc(db, "entrepreneur_profiles", user.uid);
        unsubscribeProfile = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const mp: string[] = data.mediosPago || [];
            const isOtro = mp.some(m => !['efectivo', 'debito', 'transferencia'].includes(m));
            const otroVal = isOtro ? mp.find(m => !['efectivo', 'debito', 'transferencia'].includes(m)) || "" : "";
            setShopForm({
              nombreTienda: data.businessName || data.nombre || "",
              descripcion: data.description || data.descripcion || "",
              categoria: data.category || data.rubro || "",
              mediosPago: isOtro
                ? [...mp.filter(m => ['efectivo', 'debito', 'transferencia'].includes(m)), 'otro']
                : mp,
              otroMedio: otroVal === 'otro' ? "" : otroVal,
              whatsapp: data.whatsapp || data.contactPhone || "",
              instagram: data.instagram ? data.instagram.replace('@', '') : "",
              ubicacion: data.ubicacionTienda || data.address || "",
              horario: data.operatingHours || data.horario || "",
              promoText: data.promoText || "",
              isPremium: data.isPremium === true,
            });
            setPreviewUrl(data.imageUrl || data.imageUrls?.[0] || null);
          }
        });

        const userRef = doc(db, "usuarios", user.uid);
        unsubscribeUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserData(snap.data());
          }
        });

        const q = query(
          collection(db, "usuarios", user.uid, "ventas_registradas"),
          orderBy("fecha", "desc"),
          limit(5)
        );
        unsubscribeVentas = onSnapshot(q, (snapshot) => {
          setRecentActivity(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
      }
    });

    return () => {
      authUnsubscribe();
      unsubscribeProfile();
      unsubscribeUser();
      unsubscribeVentas();
      stopScanner();
    };
  }, []);

  const loadCRM = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setCrmLoading(true);
    try {
      const q = query(
        collection(db, "usuarios", user.uid, "ventas_registradas"),
        orderBy("fecha", "desc"),
        limit(300)
      );
      const snap = await getDocs(q);
      setAllVentas(snap.docs.map(d => ({ id: d.id, ...d.data() } as VentaRecord)));
    } catch (e) {
      toast({ variant: "destructive", title: "Error al cargar datos", description: "Inténtalo de nuevo." });
    } finally {
      setCrmLoading(false);
    }
  };

  const handleExportCRM = async () => {
    const { default: XLSX } = await import("xlsx");
    const crm = calcularCRM(allVentas);
    const rows = crm.topClientes.map(c => ({
      Nombre: c.nombre,
      Visitas: c.visitas,
      "Gasto Total": c.gasto,
      "Última Visita": new Date(c.ultimaVisita).toLocaleDateString("es-CL"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mis Clientes");
    XLSX.writeFile(wb, `clientes_${auth.currentUser?.uid?.substring(0, 6)}_${currentMonth()}.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const toggleMedioPago = (key: string) => {
    setShopForm(prev => ({
      ...prev,
      mediosPago: prev.mediosPago.includes(key)
        ? prev.mediosPago.filter(m => m !== key)
        : [...prev.mediosPago, key]
    }));
  };

  const handleSaveShopInfo = async () => {
    if (!auth.currentUser) {
      toast({ variant: "destructive", title: "No autenticado", description: "Debes iniciar sesión para realizar cambios." });
      return;
    }
    
    // Validación WhatsApp
    const waClean = shopForm.whatsapp.replace(/\s/g, '');
    if (waClean && !/^\+56\d{9}$/.test(waClean)) {
      toast({ variant: "destructive", title: "WhatsApp inválido", description: "Debe comenzar con +56 y tener 11 dígitos totales. Ej: +56912345678" });
      return;
    }

    // Construir array mediosPago final
    const mediosFinal = shopForm.mediosPago.filter(m => m !== 'otro');
    if (shopForm.mediosPago.includes('otro')) {
      const otroTexto = shopForm.otroMedio.trim();
      mediosFinal.push(otroTexto || 'otro');
    }

    setLoading(true);

    try {
      let finalImageUrl = previewUrl;

      if (profileImage) {
        try {
          const storageRef = ref(storage, `entrepreneur_photos/${auth.currentUser.uid}/profile.jpg`);
          const uploadResult = await uploadBytes(storageRef, profileImage);
          finalImageUrl = await getDownloadURL(uploadResult.ref);
        } catch (storageError: any) {
          console.error("Storage Error:", storageError);
          toast({ 
            variant: "destructive", 
            title: "Error de Imagen", 
            description: "No se pudo subir la foto. Se guardará solo el texto." 
          });
        }
      }

      const profileRef = doc(db, "entrepreneur_profiles", auth.currentUser.uid);
      const updateData = {
        id: auth.currentUser.uid,
        userId: auth.currentUser.uid,
        businessName: shopForm.nombreTienda,
        description: shopForm.descripcion,
        category: shopForm.categoria || null,
        imageUrl: finalImageUrl || null,
        imageUrls: finalImageUrl ? [finalImageUrl] : [],
        mediosPago: mediosFinal,
        whatsapp: waClean || null,
        instagram: shopForm.instagram.replace('@', '').trim() || null,
        ubicacionTienda: shopForm.ubicacion.trim() || null,
        operatingHours: shopForm.horario.trim() || null,
        promoText: shopForm.promoText.trim() || null,
        isPremium: shopForm.isPremium,
        updatedAt: new Date().toISOString()
      };

      await setDoc(profileRef, updateData, { merge: true });

      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      await updateDoc(userRef, { nombreTienda: shopForm.nombreTienda });

      toast({ title: "¡Perfil actualizado!", description: "La información de tu local se ha guardado correctamente." });
      setView("dashboard");
    } catch (error: any) {
      console.error("Error al guardar perfil:", error);
      toast({ 
        variant: "destructive", 
        title: "Error al guardar", 
        description: "Hubo un problema al conectar con la base de datos." 
      });
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    setView("scanner");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode("reader");
          scannerInstance.current = html5QrCode;
          const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
          await html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => onScanSuccess(decodedText), () => {});
        } catch (err) {
          setView("dashboard");
          toast({ variant: "destructive", title: "Error de Cámara", description: "No se pudo iniciar el escáner." });
        }
      }, 300);
    } catch (e) {
      setView("dashboard");
    }
  };

  const stopScanner = async () => {
    if (scannerInstance.current && scannerInstance.current.isScanning) {
      try { await scannerInstance.current.stop(); } catch (err) {}
    }
    setView("dashboard");
    scannerInstance.current = null;
  };

  const onScanSuccess = async (decodedText: string) => {
    const clientUid = decodedText.trim();
    if (!clientUid) return;
    await stopScanner();
    handleProcessSale(clientUid);
  };

  const handleProcessSale = async (_uid: string) => {
    // DESACTIVADO: asignación directa de sellos reemplazada por flujo Handshake Digital.
    // El sello solo se asigna cuando el CLIENTE escanea el QR del mostrador y
    // el emprendedor confirma en su Panel de Validación (/validar/[vendorId]).
    //
    // await registrarCompra(db, uid, auth.currentUser?.uid); // DESACTIVADO
    //
    toast({
      title: "Usa el Panel de Validación",
      description: "Pide al cliente que escanee tu QR de mostrador. La solicitud aparecerá en tu panel.",
    });
  };

  const handleDownloadQR = () => {
    const svg = document.querySelector("#qr-codigo-mostrador svg");
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        
        const nombre = userData?.nombreTienda || shopForm.nombreTienda || "mi_tienda";
        const nombreTiendaFiltrado = nombre.toLowerCase().replace(/[^a-z0-9]/g, "_");
        downloadLink.download = `codigo_qr_${nombreTiendaFiltrado}.png`;
        
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (view === "validar" && auth.currentUser) {
    return (
      <div className="animate-in slide-in-from-right duration-300">
        <ValidarPanel 
          vendorId={auth.currentUser.uid} 
          onBack={() => setView("dashboard")} 
        />
      </div>
    );
  }

  if (view === "myqr") {
    return (
      <main className="min-h-screen bg-slate-50/50 pb-20 font-sans animate-in slide-in-from-right duration-300">
        <div className="bg-white border-b border-slate-200 p-6 sticky top-0 z-10 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView("dashboard")} className="text-slate-400">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800">Mi Código QR</h1>
        </div>

        <div className="max-w-lg mx-auto p-6 space-y-6">
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white text-center p-8">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Código de Mostrador</h2>
            <p className="text-sm text-slate-500 mb-8 max-w-[250px] mx-auto">
              Los clientes deben escanear este código desde su app para sumar un sello.
            </p>
            
            <div id="qr-codigo-mostrador" className="bg-white p-4 rounded-3xl inline-block shadow-lg border border-slate-100 mx-auto mb-6">
              <QRCode
                value={auth.currentUser?.uid ? `https://club-patio-curauma.vercel.app/canje?localId=${auth.currentUser.uid}` : "cargando"}
                size={250}
                fgColor="#000000"
                className="rounded-xl"
              />
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <Button 
                className="w-full max-w-[250px] rounded-xl font-bold bg-primary text-white gap-2 shadow-md hover:scale-[1.02] transition-all"
                onClick={handleDownloadQR}
              >
                <Download className="w-5 h-5" />
                Descargar Código QR
              </Button>
              <Button 
                variant="outline" 
                className="w-full max-w-[250px] rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-50 gap-2"
                onClick={() => {
                  if (auth.currentUser?.uid) {
                    navigator.clipboard.writeText(`https://club-patio-curauma.vercel.app/canje?localId=${auth.currentUser.uid}`);
                    toast({ title: "Enlace copiado", description: "¡Listo para compartir!" });
                  }
                }}
              >
                <Copy className="w-4 h-4" />
                Copiar Enlace
              </Button>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                ID: {auth.currentUser?.uid?.substring(0, 8)}...
              </p>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (view === "clientes") {
    const crm = calcularCRM(allVentas);
    const mes = currentMonth();
    return (
      <main className="min-h-screen bg-slate-50/50 pb-20 font-sans animate-in slide-in-from-right duration-300">
        <div className="bg-white border-b border-slate-200 p-6 sticky top-0 z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setView("dashboard")} className="text-slate-400">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Mis Clientes</h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{mes}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={loadCRM} disabled={crmLoading} className="text-slate-400 gap-1">
            <RefreshCw className={`w-4 h-4 ${crmLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="max-w-lg mx-auto p-5 space-y-5">
          {allVentas.length === 0 && !crmLoading ? (
            <div className="text-center py-16 space-y-3">
              <BarChart2 className="w-12 h-12 text-slate-200 mx-auto" />
              <p className="text-sm font-bold text-slate-400">Sin datos aún</p>
              <p className="text-xs text-slate-300">Los datos aparecen cuando confirmas sellos en el Panel de Validación.</p>
            </div>
          ) : (
            <>
              {/* KPIs del mes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Ingresos mes</span>
                  </div>
                  <p className="text-xl font-black text-slate-800">
                    {crm.ingresosMes > 0 ? formatCLP(crm.ingresosMes) : "—"}
                  </p>
                  {crm.ingresosMes === 0 && (
                    <p className="text-[9px] text-slate-300">Ingresa montos en el panel de validación</p>
                  )}
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Clientes mes</span>
                  </div>
                  <p className="text-xl font-black text-slate-800">{crm.clientesUnicos}</p>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <RefreshCw className="w-4 h-4 text-purple-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tasa retorno</span>
                  </div>
                  <p className="text-xl font-black text-slate-800">{crm.tasaRetorno}%</p>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total sellos</span>
                  </div>
                  <p className="text-xl font-black text-slate-800">{crm.totalRegistros}</p>
                </div>
              </div>

              {/* Aviso si no hay montos */}
              {crm.ingresosMes === 0 && allVentas.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                  <DollarSign className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">Activa el ingreso de montos</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Al confirmar un sello en el Panel de Validación ingresa el valor de la boleta. Con eso verás ingresos reales aquí.
                    </p>
                  </div>
                </div>
              )}

              {/* Top clientes */}
              {crm.topClientes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Top clientes (historial)</p>
                    <Button size="sm" variant="ghost" onClick={handleExportCRM} className="text-xs gap-1 text-slate-400 h-7">
                      <FileDown className="w-3 h-3" /> Excel
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {crm.topClientes.map((c, i) => (
                      <div key={c.clienteId} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-slate-500">#{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{c.nombre}</p>
                          <p className="text-[10px] text-slate-400">
                            {c.visitas} visita{c.visitas !== 1 ? "s" : ""}
                            {c.gasto > 0 ? ` · ${formatCLP(c.gasto)}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-slate-300">
                            {new Date(c.ultimaVisita).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    );
  }

  if (view === "profile") {
    return (
      <main className="min-h-screen bg-slate-50/50 pb-20 font-sans animate-in slide-in-from-right duration-300">
        <div className="bg-white border-b border-slate-200 p-6 sticky top-0 z-10 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView("dashboard")} className="text-slate-400">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800">Mi Perfil de Tienda</h1>
        </div>

        <div className="max-w-lg mx-auto p-6 space-y-6">
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
            <div className="h-2 bg-primary w-full" />
            <CardContent className="p-8 space-y-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-medium text-slate-900">Configuración del Local</h2>
                <p className="text-sm text-slate-500">Completa la información que verán los socios del club.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="shopName" className="text-sm font-bold text-slate-700">Nombre de tu local</Label>
                  <Input 
                    id="shopName" 
                    placeholder="Ej: Sabores del Patio" 
                    className="h-12 border-slate-200 focus:border-primary rounded-lg text-base"
                    value={shopForm.nombreTienda}
                    onChange={(e) => setShopForm({...shopForm, nombreTienda: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="shopDesc" className="text-sm font-bold text-slate-700">¿De qué trata tu tienda?</Label>
                  <Textarea
                    id="shopDesc"
                    placeholder="Describe tus productos o servicios..."
                    className="min-h-[120px] border-slate-200 focus:border-primary rounded-lg text-base p-4"
                    value={shopForm.descripcion}
                    onChange={(e) => setShopForm({...shopForm, descripcion: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-700">Categoría de tu emprendimiento</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setShopForm({...shopForm, categoria: cat.id})}
                        className={cn(
                          "h-12 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2",
                          shopForm.categoria === cat.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-200 bg-white text-slate-600 hover:border-primary/40"
                        )}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-700">Foto de tu local</Label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group overflow-hidden relative aspect-video bg-slate-50/50",
                      previewUrl && "border-solid border-primary/20"
                    )}
                  >
                    {previewUrl ? (
                      <>
                        <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Upload className="text-white w-8 h-8" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-400 group-hover:text-primary transition-colors">
                          <ImagePlus className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subir foto de mi tienda</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Medios de pago */}
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-700">¿Qué medios de pago aceptas?</Label>
                  <div className="space-y-2">
                    {[
                      { key: "efectivo", label: "Efectivo" },
                      { key: "debito", label: "Débito/Crédito" },
                      { key: "transferencia", label: "Transferencia" },
                      { key: "otro", label: "Otro" },
                    ].map((medio) => (
                      <div key={medio.key} className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={shopForm.mediosPago.includes(medio.key)}
                            onChange={() => toggleMedioPago(medio.key)}
                            className="w-4 h-4 accent-[#C9920A]"
                          />
                          <span className="text-sm text-slate-700">{medio.label}</span>
                        </label>
                        {medio.key === 'otro' && shopForm.mediosPago.includes('otro') && (
                          <Input
                            placeholder="Ej: Pago en especie, criptomoneda..."
                            className="h-10 border-slate-200 focus:border-primary rounded-lg text-sm ml-7"
                            value={shopForm.otroMedio}
                            onChange={(e) => setShopForm({...shopForm, otroMedio: e.target.value})}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-3">
                  <Label htmlFor="whatsapp" className="text-sm font-bold text-slate-700">Número de WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    inputMode="numeric"
                    placeholder="+56 9 XXXX XXXX"
                    className="h-12 border-slate-200 focus:border-primary rounded-lg text-base"
                    value={shopForm.whatsapp}
                    onChange={(e) => setShopForm({...shopForm, whatsapp: e.target.value})}
                  />
                </div>

                {/* Instagram */}
                <div className="space-y-3">
                  <Label htmlFor="instagram" className="text-sm font-bold text-slate-700">Instagram</Label>
                  <Input
                    id="instagram"
                    placeholder="@tunegocio"
                    className="h-12 border-slate-200 focus:border-primary rounded-lg text-base"
                    value={shopForm.instagram}
                    onChange={(e) => setShopForm({...shopForm, instagram: e.target.value})}
                  />
                </div>

                {/* Ubicación */}
                <div className="space-y-3">
                  <Label htmlFor="ubicacion" className="text-sm font-bold text-slate-700">Sector / Ubicación</Label>
                  <Input
                    id="ubicacion"
                    list="ubicaciones-list"
                    placeholder="Selecciona de la lista o escribe tu ubicación..."
                    className="h-12 border-slate-200 focus:border-primary rounded-lg text-base"
                    value={shopForm.ubicacion}
                    onChange={(e) => setShopForm({...shopForm, ubicacion: e.target.value})}
                  />
                  <datalist id="ubicaciones-list">
                    <option value="Outlet Curauma (Av. Lomas de la luz 4650, Curauma, Valparaíso)" />
                    <option value="Tienda Patio Curauma (Avenida Universidad 134, Local 1)" />
                    <option value="Patio Curauma Villa Alemana (Manuel Montt #1561, Villa Alemana)" />
                  </datalist>
                </div>

                {/* Horario */}
                <div className="space-y-3">
                  <Label htmlFor="horario" className="text-sm font-bold text-slate-700">Horario de atención</Label>
                  <Input
                    id="horario"
                    placeholder="Ej: Lunes a Domingo 10:00 - 20:00"
                    className="h-12 border-slate-200 focus:border-primary rounded-lg text-base"
                    value={shopForm.horario}
                    onChange={(e) => setShopForm({...shopForm, horario: e.target.value})}
                  />
                </div>

                {/* Texto Promocional */}
                <div className="space-y-3">
                  <Label htmlFor="promoText" className="text-sm font-bold text-slate-700">
                    Texto Promocional{" "}
                    <span className="font-normal text-slate-400">(Opcional)</span>
                  </Label>
                  <Textarea
                    id="promoText"
                    placeholder="Ej: Gana doble sello en compras sobre $15.000 este mes"
                    className="min-h-[80px] border-slate-200 focus:border-primary rounded-lg text-sm p-4"
                    value={shopForm.promoText}
                    onChange={(e) => setShopForm({ ...shopForm, promoText: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-400">
                    Este texto aparece en el carrusel "Destacados del Patio" cuando tu local es Premium.
                  </p>
                </div>

                {/* Toggle isPremium — solo visible para admin */}
                {isAdmin && (
                  <div className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/60 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-amber-800 flex items-center gap-2">
                          ✦ Marca Ancla / Local Destacado
                        </p>
                        <p className="text-[10px] text-amber-700/70 font-medium mt-0.5">
                          Activa para aparecer en el carrusel "Destacados del Patio" (solo admin)
                        </p>
                      </div>
                      <Switch
                        checked={shopForm.isPremium}
                        onCheckedChange={(val) =>
                          setShopForm({ ...shopForm, isPremium: val })
                        }
                        className="data-[state=checked]:bg-amber-500"
                      />
                    </div>
                    {shopForm.isPremium && (
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                        ✓ Este local aparecerá como PATROCINADO en el carrusel
                      </p>
                    )}
                  </div>
                )}

              </div>{/* end space-y-6 */}

              <div className="pt-4">
                <Button
                  onClick={handleSaveShopInfo}
                  disabled={loading}
                  className="w-full h-14 bg-primary text-white font-black rounded-xl text-lg gap-3 shadow-lg shadow-primary/20"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 pb-20">
      <div className="bg-white border-b border-slate-100 p-6 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="text-slate-400">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-bold text-slate-800">Panel del Emprendedor</h1>
          </div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold">
            Aliado Activo
          </Badge>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-8">
        
        <section className="space-y-4">
          {view === "scanner" ? (
            <Card className="border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300">
              <CardHeader className="bg-slate-900 text-white pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm font-bold">Escáner de Sellos</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={stopScanner} className="text-slate-400 hover:text-white rounded-full h-8 w-8">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-black relative">
                <div id="reader" className="w-full aspect-square overflow-hidden"></div>
                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                  <div className="w-full h-full border-2 border-primary/50 rounded-xl"></div>
                </div>
                <div className="p-6 bg-slate-900 text-center">
                  <p className="text-xs text-slate-300 font-medium">Enfoca el código QR del Socio</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <Button
                onClick={() => setView("myqr")}
                className="w-full h-20 rounded-2xl bg-slate-900 text-white font-bold text-xl gap-4 shadow-xl shadow-slate-900/20 hover:scale-[1.01] transition-all active:scale-95"
              >
                <QrCode className="w-8 h-8" />
                Mi Código QR (Mostrador)
              </Button>
              {/* Panel de Validación — handshake digital */}
              {auth.currentUser && (
                <Button
                  onClick={() => setView("validar")}
                  className="w-full h-16 rounded-2xl font-bold text-base gap-3 shadow-lg active:scale-[0.97] transition-transform"
                  style={{ backgroundColor: "#D3B673", color: "#fff" }}
                >
                  <span className="text-lg">🛠️</span>
                  Panel de Validación (Caja)
                </Button>
              )}
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={startScanner}
                  variant="outline"
                  className="w-full h-16 rounded-2xl border-primary text-primary font-bold gap-2 hover:bg-primary/5 flex-col text-xs"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  Escanear
                </Button>
                <Button
                  onClick={() => { loadCRM(); setView("clientes"); }}
                  variant="outline"
                  className="w-full h-16 rounded-2xl border-blue-200 bg-blue-50/50 text-blue-700 font-bold gap-2 hover:bg-blue-100/50 flex-col text-xs"
                >
                  <BarChart2 className="w-5 h-5" />
                  Clientes
                </Button>
                <Button
                  onClick={() => setView("profile")}
                  variant="outline"
                  className="w-full h-16 rounded-2xl border-slate-200 bg-white text-slate-600 font-bold gap-2 hover:bg-slate-50 flex-col text-xs"
                >
                  <Store className="w-5 h-5 text-primary" />
                  Mi Tienda
                </Button>
              </div>
            </div>
          )}

          {hasCameraPermission === false && view === "scanner" && (
            <Alert variant="destructive" className="rounded-2xl border-none shadow-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sin acceso a cámara</AlertTitle>
              <AlertDescription>Habilita los permisos para poder escanear socios.</AlertDescription>
            </Alert>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <LayoutDashboard className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Resumen de mi Local</h2>
          </div>

          {(() => {
            const mes = currentMonth();
            const sellosEsteMes = userData?.sellosEntregadosMensual?.[mes] || 0;
            const sellosHistorico = userData?.sellosEntregadosHistorico || 0;
            return (
              <div className="grid grid-cols-1 gap-3">
                <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Sellos entregados este mes</p>
                      <p className="text-2xl font-black text-slate-800">{sellosEsteMes}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-300 uppercase">Total histórico</p>
                      <p className="text-base font-black text-slate-400">{sellosHistorico}</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-3">
                  <Card className="border-none shadow-sm bg-white rounded-2xl">
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Clientes recientes</span>
                      </div>
                      <p className="text-xl font-black text-slate-800">{recentActivity.length}</p>
                    </CardContent>
                  </Card>
                  <Card
                    className="border-none shadow-sm bg-blue-50/60 rounded-2xl cursor-pointer hover:bg-blue-100/60 transition-colors"
                    onClick={() => { loadCRM(); setView("clientes"); }}
                  >
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart2 className="w-4 h-4 text-blue-600" />
                        <span className="text-[10px] font-bold text-blue-500 uppercase">CRM</span>
                      </div>
                      <p className="text-xs font-black text-blue-700">Ver análisis →</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })()}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Ventas Recientes</h2>
            </div>
          </div>

          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((sale, idx) => (
                <div 
                  key={sale.id} 
                  className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between animate-in slide-in-from-right duration-300"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                      <UserCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{sale.clienteNombre}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(sale.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Sello sumado
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-medium italic">Esperando primera venta del día...</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
