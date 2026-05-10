
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Users, Ticket, TrendingUp,
  ArrowLeft, Download, Send, Plus, Trash2,
  Edit3, Trophy, Megaphone, Loader2, Store, Crown, Check, X, ImagePlus, FolderOpen, Copy, QrCode
} from "lucide-react";
import QRCode from "react-qr-code";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";
import {
  collection, query, where, getDocs,
  addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, orderBy, limit, getDoc,
  arrayUnion, setDoc, serverTimestamp
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

const COLORS = ['#D3B673', '#9DCC65', '#6EBBD1', '#BFA05C'];

export default function DirectorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasVendorRole, setHasVendorRole] = useState(false);
  const [activatingStore, setActivatingStore] = useState(false);
  const [ranking, setRanking] = useState<any[]>([]);
  const [premios, setPremios] = useState<any[]>([]);
  const [mensajeGlobal, setMensajeGlobal] = useState({
    titulo: "", cuerpo: "", destino: "todos", enviarEn: "",
    tipo: "info" as "info" | "urgente" | "promo" | "sorteo",
    cta: "",
    vendedorFiltro: "",
  });

  const [vendorToDelete, setVendorToDelete] = useState<{ id: string; nombre: string } | null>(null);

  // Marcas Ancla
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [savingPremiumId, setSavingPremiumId] = useState<string | null>(null);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoTextDraft, setPromoTextDraft] = useState("");
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [deletingVendor, setDeletingVendor] = useState(false);
  const [isPremioModalOpen, setIsPremioModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState<{ id: string; nombre: string } | null>(null);
  const [comunicadoOpen, setComunicadoOpen] = useState(false);
  const [profileSearch, setProfileSearch] = useState("");
  const [vendorList, setVendorList] = useState<{ id: string; nombre: string }[]>([]);
  const [premioForm, setPremioForm] = useState<{
    id: string | null;
    nombre: string;
    descripcion: string;
    sellosRequeridos: number;
    icono: string;
    vendorId: string;
    esSorteo: boolean;
    activo: boolean;
    stock: number;
  }>({ id: null, nombre: '', descripcion: '', sellosRequeridos: 5, icono: '🎁', vendorId: '', esSorteo: false, activo: true, stock: 0 });

  const [chartData, setChartData] = useState([
    { name: 'Sem 1', sellos: 0 },
    { name: 'Sem 2', sellos: 0 },
    { name: 'Sem 3', sellos: 0 },
    { name: 'Sem 4', sellos: 0 },
  ]);
  const [mesLabel, setMesLabel] = useState("");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const masterEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "ignaciiio.mate@gmail.com").trim().toLowerCase();
        if ((user.email ?? "").trim().toLowerCase() === masterEmail) {
          setIsAuthorized(true);
        } else {
          try {
             const userDoc = await getDoc(doc(db, "usuarios", user.uid));
             const userData = userDoc.data();
             const rolStr: string = userData?.rol ?? "";
             const rolesArr: string[] = Array.isArray(userData?.roles) ? userData.roles : [];
             const isDirector = rolesArr.includes("director") || rolesArr.includes("director_patio") ||
               rolStr === "director" || rolStr === "director_patio";
             if (userDoc.exists() && isDirector) {
                setIsAuthorized(true);
                const isVendor = rolesArr.includes("emprendedor") || rolStr === "emprendedor";
                setHasVendorRole(isVendor);
             } else {
                toast({ variant: "destructive", title: "Acceso Denegado", description: "No cuentas con privilegios para ver este panel." });
                router.replace("/");
             }
          } catch (e) {
             router.replace("/");
          }
        }
      } else {
        router.replace("/");
      }
    });

    return () => unsubAuth();
  }, [router, toast]);

  useEffect(() => {
    if (!isAuthorized) return;

    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    // Label dinámico del mes actual
    setMesLabel(
      now.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).toUpperCase()
    );

    // Semanas del mes para el gráfico
    const SEMANAS = [
      { name: 'Sem 1', start: 1, end: 7 },
      { name: 'Sem 2', start: 8, end: 14 },
      { name: 'Sem 3', start: 15, end: 21 },
      { name: 'Sem 4', start: 22, end: 31 },
    ];

    // Listener en tiempo real a system_logs desde el inicio del mes
    const logsQ = query(
      collection(db, "system_logs"),
      where("fecha", ">=", inicioMes.toISOString())
    );

    const unsubLogs = onSnapshot(logsQ, async (logsSnap) => {
      // Solo sellos confirmados por handshake
      const handshakeLogs = logsSnap.docs
        .map(d => d.data())
        .filter(d => d.tipo === "FIDELIZACION");

      // ── Gráfico semanal ──────────────────────────────────────────────
      setChartData(
        SEMANAS.map(sem => ({
          name: sem.name,
          sellos: handshakeLogs.filter(log => {
            const day = new Date(log.fecha).getDate();
            return day >= sem.start && day <= sem.end;
          }).length
        }))
      );


    });

    // ── Ranking por vendedor (Listener separado a usuarios) ────────
    const unsubRanking = onSnapshot(
      query(collection(db, "usuarios"), where("rol", "==", "emprendedor")),
      (snap) => {
        const currentMonth = new Date().toISOString().substring(0, 7);
        const rankingData = snap.docs
          .map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              nombreTienda: data.nombreTienda || data.nombre || "Local Aliado",
              rubro: data.rubro || "General",
              sellosEntregados: (data.sellosEntregadosMensual && data.sellosEntregadosMensual[currentMonth]) || 0,
              sellosEntregadosHistorico: data.sellosEntregadosHistorico || 0,
            };
          })
          .sort((a, b) => b.sellosEntregados - a.sellosEntregados);
        setRanking(rankingData);
      }
    );

    // Escuchar premios en tiempo real (nueva colección)
    const unsubPremios = onSnapshot(collection(db, "premios"), (snap) => {
      setPremios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Cargar lista de vendors + listener completo de perfiles (para Marcas Ancla)
    const unsubProfiles = onSnapshot(collection(db, "entrepreneur_profiles"), (snap) => {
      const profiles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      profiles.sort((a: any, b: any) =>
        (a.businessName || a.nombre || "").localeCompare(b.businessName || b.nombre || "")
      );
      setAllProfiles(profiles);
      setVendorList(
        profiles.map((p: any) => ({
          id: p.id,
          nombre: p.businessName || p.nombre || p.id.substring(0, 8),
        }))
      );
    });

    return () => {
      unsubLogs();
      unsubRanking();
      unsubPremios();
      unsubProfiles();
    };
  }, [isAuthorized]);

  const handleSendGlobalMessage = async () => {
    if (!mensajeGlobal.titulo || !mensajeGlobal.cuerpo) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "Escribe un título y un mensaje." });
      return;
    }
    const isProgramado = !!mensajeGlobal.enviarEn && new Date(mensajeGlobal.enviarEn) > new Date();
    setLoading(true);
    try {
      const tipoEmoji: Record<string, string> = { info: "📢", urgente: "🚨", promo: "🎉", sorteo: "🎟️" };
      await addDoc(collection(db, "broadcast_messages"), {
        titulo: `${tipoEmoji[mensajeGlobal.tipo] ?? "📢"} ${mensajeGlobal.titulo}`,
        mensaje: mensajeGlobal.cuerpo,
        destino: mensajeGlobal.destino,
        vendedorFiltro: mensajeGlobal.destino === "visitaron_local" ? mensajeGlobal.vendedorFiltro : null,
        tipo: mensajeGlobal.tipo,
        cta: mensajeGlobal.cta || "/",
        fechaCreacion: new Date().toISOString(),
        estado: isProgramado ? "programado" : "pendiente",
        ...(isProgramado && { enviarEn: mensajeGlobal.enviarEn }),
      });
      toast({
        title: isProgramado ? "¡Comunicado programado!" : "¡Comunicado encolado!",
        description: isProgramado
          ? `Se enviará el ${new Date(mensajeGlobal.enviarEn).toLocaleString("es-CL")}.`
          : "El mensaje se enviará en segundo plano a la brevedad.",
      });
      setMensajeGlobal({ titulo: "", cuerpo: "", destino: "todos", enviarEn: "", tipo: "info", cta: "", vendedorFiltro: "" });
    } catch (error) {
      console.error("Error encolando comunicado:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo encolar el comunicado." });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQR = (nombre: string) => {
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
        
        const nombreTiendaFiltrado = nombre.toLowerCase().replace(/[^a-z0-9]/g, "_");
        downloadLink.download = `codigo_qr_${nombreTiendaFiltrado}.png`;
        
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleOpenPremioModal = (premio?: any) => {
    if (premio) {
      setPremioForm({
        id: premio.id,
        nombre: premio.nombre || '',
        descripcion: premio.descripcion || '',
        sellosRequeridos: premio.sellosRequeridos || premio.sellos_requeridos || 5,
        icono: premio.icono || '🎁',
        vendorId: premio.vendorId || '',
        esSorteo: premio.esSorteo || false,
        activo: premio.activo !== false,
        stock: premio.stock || 0,
      });
    } else {
      setPremioForm({ id: null, nombre: '', descripcion: '', sellosRequeridos: 5, icono: '🎁', vendorId: '', esSorteo: false, activo: true, stock: 0 });
    }
    setIsPremioModalOpen(true);
  };

  const handleSavePremio = async () => {
    if (!premioForm.nombre || !premioForm.sellosRequeridos) return;
    setLoading(true);
    try {
      const vendorInfo = vendorList.find((v) => v.id === premioForm.vendorId);
      const vendorNombre = vendorInfo?.nombre || "Patio Curauma";

      const data: Record<string, any> = {
        nombre: premioForm.nombre,
        descripcion: premioForm.descripcion,
        sellosRequeridos: Number(premioForm.sellosRequeridos),
        icono: premioForm.icono,
        vendorId: premioForm.vendorId || "",
        vendorNombre,
        esSorteo: premioForm.esSorteo,
        activo: premioForm.activo,
        stock: Number(premioForm.stock),
      };

      if (premioForm.id) {
        await updateDoc(doc(db, "premios", premioForm.id), data);
        toast({ title: "Premio Actualizado" });
      } else {
        await addDoc(collection(db, "premios"), {
          ...data,
          creadoEn: serverTimestamp(),
          creadoPor: currentUserId,
        });
        toast({ title: "Premio Creado" });
      }
      setIsPremioModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se guardaron los cambios." });
    } finally {
      setLoading(false);
    }
  };

  const handleActivateStore = async () => {
    if (!currentUserId || !auth.currentUser) return;
    setActivatingStore(true);
    try {
      await updateDoc(doc(db, "usuarios", currentUserId), {
        roles: arrayUnion("emprendedor")
      });
      await setDoc(doc(db, "entrepreneur_profiles", currentUserId), {
        businessName: "",
        description: "",
        category: "",
        imageUrls: [],
        createdAt: new Date().toISOString(),
        active: true
      }, { merge: true });
      setHasVendorRole(true);
      toast({ title: "¡Tienda activada!", description: "Ya puedes gestionar tu tienda desde el perfil." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo activar la tienda." });
    } finally {
      setActivatingStore(false);
    }
  };

  const handleDeleteVendor = async () => {
    if (!vendorToDelete || !auth.currentUser) return;
    setDeletingVendor(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/delete-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: vendorToDelete.id, idToken }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: "Local eliminado correctamente" });
      setVendorToDelete(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo eliminar el local." });
    } finally {
      setDeletingVendor(false);
    }
  };

  const handleDeletePremio = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este premio?")) {
      await deleteDoc(doc(db, "premios", id));
      toast({ title: "Premio Eliminado" });
    }
  };

  const handleToggleActivo = async (id: string, activo: boolean) => {
    await updateDoc(doc(db, "premios", id), { activo: !activo });
    toast({ title: activo ? "Premio desactivado" : "Premio activado" });
  };

  const handleTogglePremium = async (id: string, current: boolean) => {
    setSavingPremiumId(id);
    try {
      await updateDoc(doc(db, "entrepreneur_profiles", id), { isPremium: !current });
      toast({ title: !current ? "✦ Local marcado como Destacado" : "Local removido de Destacados" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado Premium." });
    } finally {
      setSavingPremiumId(null);
    }
  };

  const handleSavePromoText = async (id: string) => {
    setSavingPremiumId(id);
    try {
      await updateDoc(doc(db, "entrepreneur_profiles", id), {
        promoText: promoTextDraft.trim() || null,
      });
      toast({ title: "Texto promocional guardado" });
      setEditingPromoId(null);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el texto." });
    } finally {
      setSavingPremiumId(null);
    }
  };

  const handleImageUpload = async (vendorId: string, file: File) => {
    setUploadingImageId(vendorId);
    try {
      const storageRef = ref(storage, `entrepreneur_photos/${vendorId}/profile_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "entrepreneur_profiles", vendorId), {
        imageUrl: url,
        imageUrls: [url],
        imagenTarjeta: url,
        imagenPerfil: url,
      });
      toast({ title: "Foto actualizada", description: "La imagen del local se actualizó correctamente." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al subir imagen", description: err.message || "Intenta de nuevo." });
    } finally {
      setUploadingImageId(null);
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
         <Loader2 className="w-8 h-8 animate-spin text-primary" />
         <p className="text-sm font-bold text-slate-500 animate-pulse">Verificando credenciales...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 pb-32">
      <div className="bg-white border-b border-slate-100 p-6 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="text-slate-400">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Panel Directivo</h1>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm" variant="outline"
              onClick={() => router.push("/directorio")}
              className="rounded-xl gap-1.5 font-bold text-[10px] uppercase"
            >
              <FolderOpen className="w-3 h-3" /> Directorio
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl gap-2 font-bold text-[10px] uppercase">
              <Download className="w-3 h-3" /> Reporte
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-8">
        
        {/* RANKING DE EMPRENDEDORES */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" /> Ranking de Locales
            </h2>
            <Badge className="bg-primary/10 text-primary border-none text-[9px]">{mesLabel}</Badge>
          </div>
          <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
            <CardContent className="p-2">
              {ranking.length > 0 ? (
                ranking.slice(0, 5).map((emp, i) => (
                  <div key={emp.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-2xl group">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{emp.nombreTienda || emp.nombre || "Local Aliado"}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black">{emp.rubro || "General"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-black text-primary">{emp.sellosEntregados || 0}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Mes</p>
                        </div>
                        <div className="text-right border-l pl-3 ml-1 border-slate-100">
                          <p className="text-sm font-black text-slate-600">{emp.sellosEntregadosHistorico || 0}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Histórico</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setVendorToDelete({ id: emp.id, nombre: emp.nombreTienda || emp.nombre || "Local Aliado" })}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50"
                        title="Eliminar local"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 italic">No hay datos de actividad aún.</div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* COMUNICADO GLOBAL — CTA */}
        <section>
          <button
            onClick={() => setComunicadoOpen(true)}
            className="w-full flex items-center justify-between gap-4 px-6 py-5 rounded-[2rem] shadow-lg transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #C9920A 0%, #E8B028 100%)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-black text-white">📢 Enviar Comunicado Global</p>
                <p className="text-[10px] text-white/75 font-medium">Push · Programado · Segmentado</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-white" />
            </div>
          </button>
        </section>

        {/* GESTOR DE PREMIOS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Gestión de Premios</h2>
            <Button onClick={() => handleOpenPremioModal()} size="sm" variant="ghost" className="text-primary font-bold h-8 gap-1">
              <Plus className="w-4 h-4" /> Nuevo
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {premios.length > 0 ? (
              premios.map(premio => (
                <Card key={premio.id} className="border-none shadow-sm bg-white rounded-2xl">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center shrink-0 text-xl">
                        {premio.esSorteo ? <Ticket className="w-5 h-5 text-yellow-600" /> : (premio.icono || '🎁')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 truncate">{premio.nombre}</p>
                          <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full ${premio.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {premio.activo ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium truncate">{premio.vendorNombre || 'Sin local asignado'}</p>
                        <p className="text-[10px] text-primary font-black uppercase">
                          {premio.sellosRequeridos || 0} sellos
                          {premio.stock > 0 ? ` · Stock: ${premio.stock}` : ' · Stock ilimitado'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button onClick={() => handleToggleActivo(premio.id, premio.activo)} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-amber-500" title={premio.activo ? "Desactivar" : "Activar"}>
                        {premio.activo ? <Users className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                      </Button>
                      <Button onClick={() => handleOpenPremioModal(premio)} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-primary"><Edit3 className="w-4 h-4" /></Button>
                      <Button onClick={() => handleDeletePremio(premio.id)} variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 italic">No hay premios configurados. Crea el primero.</div>
            )}
          </div>
        </section>

        {/* GRÁFICO DE SALUD DEL PATIO */}
        <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black text-slate-400 uppercase flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Salud del Recinto
            </CardTitle>
          </CardHeader>
          <CardContent className="h-48 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '10px'}}
                />
                <Bar dataKey="sellos" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* MARCAS ANCLA / LOCALES DESTACADOS */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Crown className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Marcas Ancla · Locales Destacados
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 px-1">
            Activa el modo Patrocinado para que el local aparezca en el carrusel "Destacados del Patio".
          </p>

          {/* Buscador sticky */}
          <div className="sticky top-[73px] z-[9] -mx-6 px-6 py-2 bg-slate-50/90 backdrop-blur-sm">
            <Input
              type="search"
              placeholder="Buscar local..."
              value={profileSearch}
              onChange={(e) => setProfileSearch(e.target.value)}
              className="h-10 rounded-xl bg-white border-slate-200 text-sm shadow-sm"
            />
          </div>

          {allProfiles.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No hay perfiles de locales cargados aún.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {allProfiles
                .filter((p: any) => {
                  const nombre = (p.businessName || p.nombre || "").toLowerCase();
                  return nombre.includes(profileSearch.toLowerCase());
                })
                .map((profile: any) => {
                const nombre = profile.businessName || profile.nombre || profile.id.substring(0, 8);
                const isPremium = profile.isPremium === true;
                const promoText = profile.promoText || "";
                const isEditingThis = editingPromoId === profile.id;
                const isSaving = savingPremiumId === profile.id;

                return (
                  <Card
                    key={profile.id}
                    className={`border-none shadow-sm rounded-2xl transition-all ${
                      isPremium
                        ? "bg-amber-50 outline outline-1 outline-amber-200"
                        : "bg-white"
                    }`}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Fila principal: nombre + switch */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-800 truncate">{nombre}</p>
                            {isPremium && (
                              <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 uppercase tracking-wider">
                                ✦ PATROCINADO
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                            {profile.category || profile.rubro || "Sin categoría"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/10"
                            onClick={() => setQrModalOpen({ id: profile.id, nombre: nombre })}
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>
                          {isSaving && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
                          <Switch
                            checked={isPremium}
                            disabled={isSaving}
                            onCheckedChange={() => handleTogglePremium(profile.id, isPremium)}
                            className="data-[state=checked]:bg-amber-500"
                          />
                        </div>
                      </div>

                      {/* Subir foto del local */}
                      <label className="flex items-center gap-2 cursor-pointer w-full">
                        <div
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors w-full ${
                            uploadingImageId === profile.id
                              ? "border-amber-200 bg-amber-50"
                              : "border-slate-100 bg-slate-50 hover:bg-amber-50 hover:border-amber-200"
                          }`}
                        >
                          {uploadingImageId === profile.id ? (
                            <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
                          ) : (
                            <ImagePlus className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                          )}
                          <span className="text-[11px] text-slate-500">
                            {uploadingImageId === profile.id ? "Subiendo imagen..." : "Cambiar foto del local"}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingImageId !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(profile.id, file);
                            e.target.value = "";
                          }}
                        />
                      </label>

                      {/* Texto promocional — editable inline */}
                      {isEditingThis ? (
                        <div className="space-y-2">
                          <Textarea
                            value={promoTextDraft}
                            onChange={(e) => setPromoTextDraft(e.target.value)}
                            placeholder="Ej: Gana doble sello en compras sobre $15.000"
                            className="text-xs min-h-[72px] rounded-xl border-amber-200 focus:border-amber-400 resize-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={isSaving}
                              onClick={() => handleSavePromoText(profile.id)}
                              className="h-8 px-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white gap-1 text-xs"
                            >
                              {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Guardar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingPromoId(null)}
                              className="h-8 px-3 rounded-xl font-bold text-slate-400 text-xs gap-1"
                            >
                              <X className="w-3.5 h-3.5" /> Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingPromoId(profile.id);
                            setPromoTextDraft(promoText);
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-100 hover:border-amber-200 transition-colors">
                            <Edit3 className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-slate-500 italic line-clamp-2 leading-relaxed">
                              {promoText || "Agregar texto promocional…"}
                            </p>
                          </div>
                        </button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* MI TIENDA COMO EMPRENDEDOR */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <Store className="w-4 h-4" /> Mi Tienda
          </h2>
          {hasVendorRole ? (
            <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-slate-800">Tienda activa</p>
                  <p className="text-xs text-slate-400 font-medium">Gestiona tu local desde el perfil o el panel de emprendedor.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-sm bg-white rounded-[2rem] overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Activa tu propio local en el patio para gestionar sellos y aparecer en el directorio.
                </p>
                <Button
                  onClick={handleActivateStore}
                  disabled={activatingStore}
                  className="w-full h-12 rounded-2xl font-black gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                >
                  {activatingStore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
                  Activar mi tienda como emprendedor
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

      </div>

      {/* MODAL COMUNICADO GLOBAL */}
      {comunicadoOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setComunicadoOpen(false)}>
          <div
            className="w-full max-w-sm bg-primary text-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Megaphone className="w-4 h-4" /> Comunicado Global
              </h2>
              <button
                onClick={() => setComunicadoOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Tipo de comunicado */}
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { value: "info",    emoji: "📢", label: "Info" },
                  { value: "urgente", emoji: "🚨", label: "Urgente" },
                  { value: "promo",   emoji: "🎉", label: "Promo" },
                  { value: "sorteo",  emoji: "🎟️", label: "Sorteo" },
                ] as const).map(({ value, emoji, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMensajeGlobal({...mensajeGlobal, tipo: value})}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all ${
                      mensajeGlobal.tipo === value
                        ? "bg-white text-primary shadow-sm"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    <span className="text-base leading-none">{emoji}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <Input
                placeholder="Título del anuncio..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-xl"
                value={mensajeGlobal.titulo}
                onChange={(e) => setMensajeGlobal({...mensajeGlobal, titulo: e.target.value})}
              />
              <Textarea
                placeholder="Escribe el mensaje..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-xl min-h-[80px]"
                value={mensajeGlobal.cuerpo}
                onChange={(e) => setMensajeGlobal({...mensajeGlobal, cuerpo: e.target.value})}
              />
              <select
                value={mensajeGlobal.destino}
                onChange={(e) => setMensajeGlobal({...mensajeGlobal, destino: e.target.value})}
                className="w-full bg-white/10 border border-white/20 text-white rounded-xl h-10 px-3 outline-none focus:ring-2 focus:ring-white/50 text-sm"
              >
                <option value="todos" className="text-slate-800">Todos los socios</option>
                <option value="emprendedor" className="text-slate-800">Solo Emprendedores</option>
                <option value="cerca_de_premio" className="text-slate-800">Cerca de su premio (4+ sellos)</option>
                <option value="inactivos" className="text-slate-800">Inactivos (+30 días sin compras)</option>
                <option value="activos_recientes" className="text-slate-800">Activos en los últimos 30 días</option>
                <option value="cumpleanios_mes" className="text-slate-800">Cumpleaños este mes 🎂</option>
                <option value="aceptaPromoLocales" className="text-slate-800">Consintieron promos de locales ✅</option>
                <option value="visitaron_local" className="text-slate-800">Visitaron un local específico 📍</option>
              </select>
              {mensajeGlobal.destino === "visitaron_local" && (
                <select
                  value={mensajeGlobal.vendedorFiltro}
                  onChange={(e) => setMensajeGlobal({ ...mensajeGlobal, vendedorFiltro: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl h-10 px-3 outline-none focus:ring-2 focus:ring-white/50 text-sm"
                >
                  <option value="" className="text-slate-800">— Selecciona el local —</option>
                  {vendorList.map((v: any) => (
                    <option key={v.id} value={v.id} className="text-slate-800">{v.nombre}</option>
                  ))}
                </select>
              )}
              <select
                value={mensajeGlobal.cta}
                onChange={(e) => setMensajeGlobal({...mensajeGlobal, cta: e.target.value})}
                className="w-full bg-white/10 border border-white/20 text-white rounded-xl h-10 px-3 outline-none focus:ring-2 focus:ring-white/50 text-sm"
              >
                <option value="" className="text-slate-800">Al tocar → Inicio</option>
                <option value="/premios" className="text-slate-800">Al tocar → Mis Premios</option>
                <option value="/directorio" className="text-slate-800">Al tocar → Directorio de locales</option>
                <option value="/ruta" className="text-slate-800">Al tocar → Ver Mapa</option>
                <option value="/perfil" className="text-slate-800">Al tocar → Mi Perfil</option>
              </select>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-white/70 font-bold">Programar envío</span>
                <Switch
                  checked={!!mensajeGlobal.enviarEn}
                  onCheckedChange={(v) => {
                    if (v) {
                      const d = new Date(Date.now() + 60 * 60 * 1000);
                      setMensajeGlobal({...mensajeGlobal, enviarEn: d.toISOString().slice(0, 16)});
                    } else {
                      setMensajeGlobal({...mensajeGlobal, enviarEn: ""});
                    }
                  }}
                />
              </div>
              {mensajeGlobal.enviarEn && (
                <input
                  type="datetime-local"
                  value={mensajeGlobal.enviarEn}
                  min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                  onChange={(e) => setMensajeGlobal({...mensajeGlobal, enviarEn: e.target.value})}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl h-10 px-3 text-sm outline-none focus:ring-2 focus:ring-white/50 [color-scheme:dark]"
                />
              )}
              <Button
                onClick={async () => { await handleSendGlobalMessage(); if (!loading) setComunicadoOpen(false); }}
                disabled={loading}
                className="w-full bg-white text-primary hover:bg-white/90 font-black rounded-xl h-12 gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {mensajeGlobal.enviarEn ? "Programar Comunicado" : "Enviar Notificación Push"}
              </Button>
              {(() => {
                const labels: Record<string, string> = {
                  todos: "todos los socios",
                  emprendedor: "emprendedores",
                  cerca_de_premio: "socios con 4+ sellos",
                  inactivos: "socios inactivos (+30 días)",
                  activos_recientes: "socios activos en 30 días",
                  aceptaPromoLocales: "socios con consentimiento de promos",
                  visitaron_local: mensajeGlobal.vendedorFiltro
                    ? `socios que visitaron ${vendorList.find((v: any) => v.id === mensajeGlobal.vendedorFiltro)?.nombre ?? "el local"}`
                    : "socios de un local (selecciona el local)",
                };
                const dest = labels[mensajeGlobal.destino] ?? mensajeGlobal.destino;
                return (
                  <p className="text-[9px] text-center text-white/60 font-medium pb-2">
                    {mensajeGlobal.enviarEn
                      ? `Programado para ${new Date(mensajeGlobal.enviarEn).toLocaleString("es-CL")} → ${dest}.`
                      : `Se enviará en segundo plano a ${dest}.`}
                  </p>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR EMPRENDEDOR */}
      {vendorToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm rounded-[2rem] border-none shadow-2xl animate-in zoom-in-95 duration-300">
            <CardContent className="p-8 space-y-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-7 h-7 text-red-500" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-slate-800">¿Eliminar local?</h2>
                  <p className="text-sm font-bold text-primary">"{vendorToDelete.nombre}"</p>
                  <p className="text-xs text-slate-500 leading-relaxed pt-1">
                    Se eliminarán su perfil, cuenta y solicitudes pendientes.
                    <br />Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setVendorToDelete(null)}
                  disabled={deletingVendor}
                  className="flex-1 h-12 rounded-xl font-bold border-slate-200"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDeleteVendor}
                  disabled={deletingVendor}
                  className="flex-1 h-12 rounded-xl font-black bg-red-500 hover:bg-red-600 text-white gap-2"
                >
                  {deletingVendor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL CONFIGURACION DE PREMIOS */}
      {isPremioModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm rounded-[2rem] border-none shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 sticky top-0 z-10">
              <CardTitle className="text-lg font-black text-slate-800">
                {premioForm.id ? "Editar Premio" : "Nuevo Premio"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nombre del Premio</label>
                <Input
                  value={premioForm.nombre}
                  onChange={e => setPremioForm({ ...premioForm, nombre: e.target.value })}
                  placeholder="Ej: Café gratis..."
                  className="h-12 rounded-xl"
                />
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Descripción corta</label>
                <Input
                  value={premioForm.descripcion}
                  onChange={e => setPremioForm({ ...premioForm, descripcion: e.target.value })}
                  placeholder="Ej: Un café de especialidad"
                  className="h-12 rounded-xl"
                />
              </div>

              {/* Sellos + Ícono */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sellos requeridos</label>
                  <Input
                    type="number"
                    min={1}
                    value={premioForm.sellosRequeridos}
                    onChange={e => setPremioForm({ ...premioForm, sellosRequeridos: parseInt(e.target.value) || 0 })}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ícono</label>
                  <select
                    value={premioForm.icono}
                    onChange={e => setPremioForm({ ...premioForm, icono: e.target.value })}
                    className="flex h-12 w-full rounded-xl border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="☕">☕ Café</option>
                    <option value="🍦">🍦 Helado</option>
                    <option value="🍕">🍕 Pizza</option>
                    <option value="🎁">🎁 Regalo</option>
                    <option value="⭐">⭐ Especial</option>
                    <option value="🎟️">🎟️ Entrada</option>
                    <option value="🏷️">🏷️ Descuento</option>
                    <option value="🍷">🍷 Bebida</option>
                  </select>
                </div>
              </div>

              {/* Vendor */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Emprendedor que lo ofrece</label>
                <select
                  value={premioForm.vendorId}
                  onChange={e => setPremioForm({ ...premioForm, vendorId: e.target.value })}
                  className="flex h-12 w-full rounded-xl border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— Patio Curauma (general) —</option>
                  {vendorList.map(v => (
                    <option key={v.id} value={v.id}>{v.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Stock */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Stock disponible</label>
                <Input
                  type="number"
                  min={0}
                  value={premioForm.stock}
                  onChange={e => setPremioForm({ ...premioForm, stock: parseInt(e.target.value) || 0 })}
                  placeholder="0 = ilimitado"
                  className="h-12 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">0 = ilimitado</p>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={premioForm.esSorteo}
                    onChange={e => setPremioForm({ ...premioForm, esSorteo: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-700">Es un Sorteo</p>
                    <p className="text-[10px] text-slate-400">No descuenta sellos, genera un ticket</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={premioForm.activo}
                    onChange={e => setPremioForm({ ...premioForm, activo: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-700">Activo (visible al cliente)</p>
                    <p className="text-[10px] text-slate-400">Desactiva para ocultarlo sin eliminar</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setIsPremioModalOpen(false)} className="flex-1 h-12 rounded-xl font-bold border-slate-200">Cancelar</Button>
                <Button onClick={handleSavePremio} disabled={loading} className="flex-1 h-12 rounded-xl font-bold bg-primary text-white hover:bg-primary/90">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL QR */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm rounded-[2rem] border-none shadow-2xl animate-in zoom-in-95 duration-300">
            <CardContent className="p-8 space-y-6 text-center">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-slate-800 text-left line-clamp-1">QR de {qrModalOpen.nombre}</h2>
                <Button variant="ghost" size="icon" onClick={() => setQrModalOpen(null)} className="shrink-0 -mr-2">
                  <X className="w-5 h-5 text-slate-400" />
                </Button>
              </div>
              <div id="qr-codigo-mostrador" className="bg-white p-4 rounded-3xl inline-block shadow-lg border border-slate-100 mx-auto">
                <QRCode
                  value={`https://club-patio-curauma.vercel.app/canje?localId=${qrModalOpen.id}`}
                  size={200}
                  fgColor="#000000"
                  className="rounded-xl"
                />
              </div>
              <div className="flex flex-col gap-3">
                <Button 
                  className="w-full h-12 rounded-xl font-bold bg-primary text-white gap-2 shadow-md hover:scale-[1.02] transition-all"
                  onClick={() => handleDownloadQR(qrModalOpen.nombre)}
                >
                  <Download className="w-5 h-5" />
                  Descargar Código QR
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full h-12 rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-50 gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://club-patio-curauma.vercel.app/canje?localId=${qrModalOpen.id}`);
                    toast({ title: "Enlace copiado", description: "¡Listo para compartir!" });
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Copiar Enlace
                </Button>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                  ID: {qrModalOpen.id.substring(0, 8)}...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
