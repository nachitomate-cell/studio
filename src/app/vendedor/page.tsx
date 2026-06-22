"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { query, collection, orderBy, limit, onSnapshot, doc, setDoc, updateDoc, getDocs, getDoc, addDoc, deleteDoc, serverTimestamp, where } from "firebase/firestore";
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
  DollarSign, BarChart2, RefreshCw, FileDown, HelpCircle,
  CheckCircle2, User, MessageCircle, CalendarDays, Star,
  Sparkles, ExternalLink, Link2,
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

import { ADMIN_EMAIL } from "@/lib/constants";
import VendorStampModal from "@/components/VendorStampModal";
import { SynapTechAIPanel, type AIInsight } from "@/components/SynapTechAI";
import { clasificarPerfil, calcularSegmentacion, PERFILES_META, type PerfilConductual } from "@/lib/perfilesConductuales";

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
  perfil?: PerfilConductual;
}


const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function generarInsightsCRM(
  crm: ReturnType<typeof calcularCRM>,
  totalSellosHistorico: number
): AIInsight[] {
  const out: AIInsight[] = [];

  // Retención
  if (crm.tasaRetorno >= 55) {
    out.push({ icon: "🔄", type: "positive", text: `Tasa de retorno del ${crm.tasaRetorno}%: más de la mitad de tus clientes históricos ha vuelto a comprarte. Excelente fidelización.` });
  } else if (crm.tasaRetorno > 0 && crm.tasaRetorno < 30) {
    out.push({ icon: "⚠️", type: "warning", text: `Tasa de retorno baja: ${crm.tasaRetorno}%. Menos de 1 de cada 3 clientes regresa. Usa las plantillas de reactivación para mejorar este número.` });
  } else if (crm.tasaRetorno > 0) {
    out.push({ icon: "🔄", type: "neutral", text: `Tasa de retorno del ${crm.tasaRetorno}%. Hay margen para mejorar — los incentivos por visita frecuente pueden impulsar esta cifra.` });
  }

  // Día más activo
  const mejorDiaIdx = crm.visitasPorDia.indexOf(crm.maxDia);
  if (crm.maxDia > 1) {
    const segundoMayor = [...crm.visitasPorDia].sort((a, b) => b - a)[1];
    const flojo = crm.visitasPorDia.indexOf(Math.min(...crm.visitasPorDia.filter(v => v > 0)));
    out.push({
      icon: "📅", type: "neutral",
      text: `Tu día estrella es el ${DIAS_SEMANA[mejorDiaIdx]} (${crm.maxDia} visitas). ${segundoMayor < crm.maxDia * 0.5 && flojo >= 0 ? `El ${DIAS_SEMANA[flojo]} es el más flojo — considera una promoción ese día para nivelar el flujo.` : "Mantén reforzado stock y atención ese día."}`,
    });
  }

  // Clientes inactivos
  if (crm.clientesInactivos.length >= 3) {
    out.push({ icon: "💤", type: "warning", text: `${crm.clientesInactivos.length} clientes llevan más de 30 días sin visitarte. Un mensaje de reactivación personalizado puede recuperar entre el 20–30% de ellos.` });
  } else if (crm.clientesInactivos.length > 0) {
    out.push({ icon: "💤", type: "neutral", text: `${crm.clientesInactivos.length} cliente${crm.clientesInactivos.length !== 1 ? "s" : ""} no ha regresado en más de 30 días. Aprovecha el botón WhatsApp de la sección de inactivos para reactivarlos.` });
  }

  // Ticket promedio
  if (crm.ticketPromedio > 0) {
    if (crm.ticketPromedio >= 25000) {
      out.push({ icon: "💰", type: "positive", text: `Ticket promedio alto: ${formatCLP(crm.ticketPromedio)}. Tus clientes gastan bien — prioriza la frecuencia de visitas sobre la captación masiva.` });
    } else if (crm.ticketPromedio < 8000) {
      out.push({ icon: "💰", type: "neutral", text: `Ticket promedio de ${formatCLP(crm.ticketPromedio)}. Combos o productos complementarios podrían aumentar el valor por visita sin perder volumen de clientes.` });
    } else {
      out.push({ icon: "💰", type: "neutral", text: `Ticket promedio del mes: ${formatCLP(crm.ticketPromedio)}. Nivel razonable — monitorea si sube con las promociones activas.` });
    }
  }

  // Volumen mensual vs histórico
  if (totalSellosHistorico > 0 && crm.totalRegistros > 0) {
    const pctMesDelTotal = Math.round((crm.clientesUnicos / Math.max(crm.totalRegistros, 1)) * 100);
    if (crm.clientesUnicos > 0 && pctMesDelTotal > 60) {
      out.push({ icon: "🆕", type: "positive", text: `Este mes predominan clientes nuevos o de primera visita. Señal positiva de captación — asegúrate de fidelizarlos desde el primer contacto.` });
    }
  }

  return out;
}

function calcularCRM(ventas: VentaRecord[]) {
  const mes = currentMonth();
  const ventasMes = ventas.filter(v => v.fecha?.startsWith(mes));

  const ingresosMes = ventasMes.reduce((s, v) => s + (v.monto || 0), 0);
  const clientesSet = new Set(ventasMes.map(v => v.clienteId));
  const clientesUnicos = clientesSet.size;

  const conteo: Record<string, number> = {};
  ventas.forEach(v => { conteo[v.clienteId] = (conteo[v.clienteId] || 0) + 1; });
  const retorno = Object.values(conteo).filter(c => c > 1).length;
  const tasaRetorno = ventas.length > 0
    ? Math.round((retorno / Object.keys(conteo).length) * 100) : 0;

  const clienteMap: Record<string, ClienteStats> = {};
  ventas.forEach(v => {
    if (!clienteMap[v.clienteId]) {
      clienteMap[v.clienteId] = { clienteId: v.clienteId, nombre: v.clienteNombre || "?", visitas: 0, gasto: 0, ultimaVisita: v.fecha };
    }
    clienteMap[v.clienteId].visitas++;
    clienteMap[v.clienteId].gasto += v.monto || 0;
    if (v.fecha > clienteMap[v.clienteId].ultimaVisita) clienteMap[v.clienteId].ultimaVisita = v.fecha;
  });
  // Segmentación conductual: clasificar a toda la cartera en los 5 perfiles
  const todosClientes = Object.values(clienteMap);
  todosClientes.forEach(c => { c.perfil = clasificarPerfil(c); });
  const segmentacion = calcularSegmentacion(todosClientes);

  const topClientes = [...todosClientes].sort((a, b) => b.visitas - a.visitas).slice(0, 10);

  // Clientes inactivos: última visita > 30 días
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const clientesInactivos = Object.values(clienteMap)
    .filter(c => c.ultimaVisita.slice(0, 10) < hace30)
    .sort((a, b) => a.ultimaVisita.localeCompare(b.ultimaVisita))
    .slice(0, 5);

  // Visitas por día de la semana (fecha ISO viene como "YYYY-MM-DDTHH:mm...")
  const visitasPorDia: number[] = Array(7).fill(0);
  ventas.forEach(v => {
    if (v.fecha) visitasPorDia[new Date(v.fecha.length === 10 ? v.fecha + "T12:00" : v.fecha).getDay()]++;
  });
  const maxDia = Math.max(...visitasPorDia, 1);

  // Ticket promedio del mes
  const ventasConMonto = ventasMes.filter(v => (v.monto || 0) > 0);
  const ticketPromedio = ventasConMonto.length > 0
    ? Math.round(ventasConMonto.reduce((s, v) => s + (v.monto || 0), 0) / ventasConMonto.length) : 0;
  const ventasConMontoCount = ventasConMonto.length;

  return { ingresosMes, clientesUnicos, tasaRetorno, topClientes, totalRegistros: ventas.length, clientesInactivos, visitasPorDia, maxDia, ticketPromedio, ventasConMontoCount, segmentacion };
}

export default function VendedorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [view, setView] = useState<"dashboard" | "scanner" | "profile" | "myqr" | "clientes">("dashboard");
  const [loading, setLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [allVentas, setAllVentas] = useState<VentaRecord[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const scannerInstance = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileLoadedRef = useRef(false);

  const [shopForm, setShopForm] = useState({
    nombreTienda: "",
    descripcion: "",
    categoria: "",
    mediosPago: [] as string[],
    otroMedio: "",
    whatsapp: "+56",
    instagram: "",
    ubicacion: "",
    horario: "",
    promoText: "",
    isPremium: false,
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [vendorSaleTarget, setVendorSaleTarget] = useState<{ clientId: string; clientName: string } | null>(null);
  const [vendorSalePendingId, setVendorSalePendingId] = useState<string | null>(null);
  const [vendorSaleLoading, setVendorSaleLoading] = useState(false);
  const [vendorSaleMonto, setVendorSaleMonto] = useState("");
  const [wspLoading, setWspLoading] = useState<string | null>(null);
  const [sellosHistoricoFromLogs, setSellosHistoricoFromLogs] = useState<number | null>(null);
  const [sellosEsteMesFromLogs, setSellosEsteMesFromLogs] = useState<number | null>(null);
  const [vendorUid, setVendorUid] = useState<string | null>(null);
  const [ofertaHoy, setOfertaHoy] = useState<any>(null);
  const [ofertaTexto, setOfertaTexto] = useState("");
  const [savingOferta, setSavingOferta] = useState(false);
  const [vendorAvgRating, setVendorAvgRating] = useState<number | null>(null);
  const [vendorReviewCount, setVendorReviewCount] = useState(0);
  // Link in Bio premium (bioo.cl)
  const [biooInfo, setBiooInfo] = useState<{ handle?: string; claimUrl?: string; publicUrl?: string }>({});
  const [biooBusy, setBiooBusy] = useState(false);
  const [biooOpening, setBiooOpening] = useState(false);


  useEffect(() => {
    const checkPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        stream.getTracks().forEach(track => track.stop && track.stop());
      } catch {
        setHasCameraPermission(false);
      }
      // Abrir scanner DESPUÉS de resolver el permiso para evitar race condition
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("action") === "scan") {
          startScanner();
        }
      }
    };
    checkPermission();

    let unsubscribeProfile: () => void = () => {};
    let unsubscribeUser: () => void = () => {};
    let unsubscribeVentas: () => void = () => {};
    let unsubscribeLogs: () => void = () => {};

    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        // Limpiar listeners activos al cerrar sesión
        unsubscribeProfile();
        unsubscribeUser();
        unsubscribeVentas();
        unsubscribeLogs();
        unsubscribeProfile = () => {};
        unsubscribeUser = () => {};
        unsubscribeVentas = () => {};
        profileLoadedRef.current = false;
        setProfileChecked(true);
        return;
      }
      if (user) {
        setVendorUid(user.uid);
        // Detectar si es admin para mostrar controles extra
        setIsAdmin((user.email || "").trim().toLowerCase() === ADMIN_EMAIL);

        // Cargar estadísticas de reviews del vendor
        getDocs(query(collection(db, "reviews"), where("vendorId", "==", user.uid)))
          .then((snap) => {
            if (snap.empty) return;
            const count = snap.docs.length;
            const avg = snap.docs.reduce((s, d) => s + (d.data().rating || 0), 0) / count;
            setVendorAvgRating(avg);
            setVendorReviewCount(count);
          })
          .catch(() => {});

        const profileRef = doc(db, "entrepreneur_profiles", user.uid);
        unsubscribeProfile = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const mp: string[] = data.mediosPago || [];
            const isOtro = mp.some(m => !['efectivo', 'debito', 'transferencia'].includes(m));
            const otroVal = isOtro ? mp.find(m => !['efectivo', 'debito', 'transferencia'].includes(m)) || "" : "";
            const businessName = data.businessName || data.nombre || "";
            setShopForm({
              nombreTienda: businessName,
              descripcion: data.description || data.descripcion || "",
              categoria: data.category || data.rubro || "",
              mediosPago: isOtro
                ? [...mp.filter(m => ['efectivo', 'debito', 'transferencia'].includes(m)), 'otro']
                : mp,
              otroMedio: otroVal === 'otro' ? "" : otroVal,
              whatsapp: data.whatsapp || data.contactPhone || "+56",
              instagram: data.instagram ? data.instagram.replace('@', '') : "",
              ubicacion: data.ubicacionTienda || data.address || "",
              horario: data.operatingHours || data.horario || "",
              promoText: data.promoText || "",
              isPremium: data.isPremium === true,
            });
            setPreviewUrl(data.imageUrl || data.imageUrls?.[0] || null);
            setBiooInfo({ handle: data.biooHandle, claimUrl: data.biooClaimUrl, publicUrl: data.biooPublicUrl });
            if (!profileLoadedRef.current && (!businessName.trim() || businessName.trim() === "—")) {
              toast({ title: "¡Bienvenido! Configura tu local", description: "Por favor, configura el nombre de tu local para empezar a entregar sellos." });
              router.push("/tienda");
            }
          } else if (!profileLoadedRef.current) {
            toast({ title: "¡Bienvenido! Configura tu local", description: "Por favor, configura el nombre de tu local para empezar a entregar sellos." });
            router.push("/tienda");
          }
          profileLoadedRef.current = true;
          setProfileChecked(true);
        });

        const userRef = doc(db, "usuarios", user.uid);
        unsubscribeUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserData(snap.data());
          }
        });

        // Conteo en tiempo real desde system_logs — mes e histórico del mismo snapshot
        const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        unsubscribeLogs = onSnapshot(
          query(
            collection(db, "system_logs"),
            where("vendedorId", "==", user.uid),
            where("tipo", "==", "FIDELIZACION")
          ),
          (snap) => {
            let historico = 0;
            let esteMes = 0;
            snap.docs.forEach(d => {
              const data = d.data();
              if (!data.anulada) {
                historico++;
                if (data.fecha && new Date(data.fecha) >= inicioMes) esteMes++;
              }
            });
            setSellosHistoricoFromLogs(historico);
            setSellosEsteMesFromLogs(esteMes);
          },
          () => {}
        );

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
      unsubscribeLogs();
      stopScanner();
    };
  }, []);

  useEffect(() => {
    if (!vendorUid) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const unsub = onSnapshot(
      query(collection(db, "ofertas_dia"), where("vendorId", "==", vendorUid), where("fechaISO", "==", hoy)),
      (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0];
          setOfertaHoy({ id: d.id, ...d.data() });
          setOfertaTexto(d.data().texto || "");
        } else {
          setOfertaHoy(null);
          setOfertaTexto("");
        }
      }
    );
    return () => unsub();
  }, [vendorUid]);

  // Auto-load CRM when entering the clientes view
  useEffect(() => {
    if (view === "clientes" && allVentas.length === 0 && !crmLoading) {
      loadCRM();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

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

  const abrirWhatsApp = async (
    clienteId: string,
    clienteNombre: string,
    tiendaNombre: string,
    vendorNombre: string,
    tipo: "fidelizacion" | "reactivacion" | "bienvenida" | "promo"
  ) => {
    setWspLoading(clienteId);
    try {
      const snap = await getDoc(doc(db, "usuarios", clienteId));
      const tel = snap.exists() ? (snap.data().telefono || "").replace(/\s/g, "") : "";
      if (!tel || tel.length < 8) {
        toast({ title: "Sin teléfono", description: `${clienteNombre} no ha registrado su número.` });
        return;
      }
      const num = tel.startsWith("+") ? tel.slice(1) : tel;
      const mensajes: Record<string, string> = {
        fidelizacion: `Hola ${clienteNombre}! 👋 Soy ${vendorNombre} de ${tiendaNombre} en Patio Curauma. ¡Gracias por visitarnos! Cada compra suma un sello ⭐ y te acerca a tu premio. ¡Vuelve pronto! 🎁`,
        reactivacion: `Hola ${clienteNombre}! 😊 Te echamos de menos en ${tiendaNombre}. ¿Cómo has estado? Esta semana tenemos novedades que te van a gustar. ¡Te esperamos en Patio Curauma! 🙌`,
        bienvenida: `¡Bienvenida/o ${clienteNombre}! 🥳 Soy ${vendorNombre} de ${tiendaNombre}. Ya eres parte del Club Patio Curauma. Cada visita te suma un sello y al llegar a 10 ¡ganas un premio especial! ⭐🎁`,
        promo: `Hola ${clienteNombre}! 🎉 Hoy tenemos algo especial en ${tiendaNombre}. Ven a visitarnos y suma tu sello del día. ¡Te esperamos con novedades en Patio Curauma! 👋`,
      };
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(mensajes[tipo])}`, "_blank");
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo obtener el contacto." });
    } finally {
      setWspLoading(null);
    }
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

  // ── Link in Bio premium (bioo.cl) — autoservicio del emprendedor ──────────
  const crearMiBioo = async () => {
    if (!auth.currentUser) {
      toast({ variant: "destructive", title: "No autenticado", description: "Inicia sesión para crear tu página." });
      return;
    }
    if (!shopForm.nombreTienda.trim() || shopForm.nombreTienda.trim() === "—") {
      toast({ variant: "destructive", title: "Configura tu local primero", description: "Necesitas el nombre de tu local antes de crear tu Link in Bio." });
      return;
    }
    setBiooBusy(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/bioo/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: auth.currentUser.uid, idToken }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ variant: "destructive", title: "No se pudo crear", description: json.error || "Intenta de nuevo." });
        return;
      }
      setBiooInfo({ handle: json.handle, claimUrl: json.claimUrl, publicUrl: json.publicUrl });
      toast({ title: "¡Tu Link in Bio está listo!", description: `bioo.cl/${json.handle} — actívala para personalizarla.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo conectar. Intenta de nuevo." });
    } finally {
      setBiooBusy(false);
    }
  };

  const copiarBioo = (texto: string, msg: string) => {
    navigator.clipboard?.writeText(texto).then(
      () => toast({ title: msg }),
      () => toast({ variant: "destructive", title: "No se pudo copiar" })
    );
  };

  // Abre el editor de bioo.cl con la sesión del emprendedor ya iniciada (SSO).
  const abrirEditorBioo = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setBiooOpening(true);
    const w = window.open("", "_blank"); // abrir en el gesto para evitar bloqueo
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/bioo/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const json = await res.json();
      if (!res.ok || !json.editUrl) {
        if (w) w.close();
        toast({ variant: "destructive", title: "No se pudo abrir", description: json.error || "Intenta de nuevo." });
        return;
      }
      if (w) w.location.href = json.editUrl;
      else window.location.href = json.editUrl;
    } catch {
      if (w) w.close();
      toast({ variant: "destructive", title: "Error", description: "No se pudo conectar. Intenta de nuevo." });
    } finally {
      setBiooOpening(false);
    }
  };

  const handleSaveShopInfo = async () => {
    if (!auth.currentUser) {
      toast({ variant: "destructive", title: "No autenticado", description: "Debes iniciar sesión para realizar cambios." });
      return;
    }
    
    // Validación WhatsApp ("+56" solo = sin número, se trata como vacío)
    const waRaw = shopForm.whatsapp.replace(/\s/g, '');
    const waClean = (waRaw === '+' || waRaw === '+56') ? '' : waRaw;
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

      // Auto-crear su Link in Bio (bioo.cl) si aún no lo tiene. Idempotente y silencioso.
      if (!biooInfo.handle) {
        try {
          const idToken = await auth.currentUser.getIdToken();
          await fetch("/api/bioo/provision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vendorId: auth.currentUser.uid, idToken }),
          });
        } catch { /* no bloquea el guardado */ }
      }

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

  const handleProcessSale = async (rawScanned: string) => {
    let raw = rawScanned.trim();
    if (!raw) return;

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Client QRs encode a full URL: /scan?ref=UID
    // Extract the UID from the ref param so the rest of the logic can treat it normally.
    if (raw.startsWith("http") || raw.includes("ref=")) {
      try {
        const url = new URL(raw);
        const ref = url.searchParams.get("ref");
        if (!ref) {
          toast({ variant: "destructive", title: "QR no reconocido", description: "Pide al cliente que muestre su código QR personal." });
          return;
        }
        raw = ref;
      } catch {
        toast({ variant: "destructive", title: "QR no reconocido", description: "Pide al cliente que muestre su código QR personal." });
        return;
      }
    }

    // Block canje/prize QRs
    if (raw.includes("localId=") || raw.startsWith("VND_") || raw.startsWith("canje:")) {
      toast({ variant: "destructive", title: "QR de premio", description: "Escaneaste un código de canje, no un QR de cliente." });
      return;
    }

    // Prevent scanning own QR
    if (raw === currentUser.uid) {
      toast({ variant: "destructive", title: "Ese eres tú", description: "No puedes escanearte a ti mismo." });
      return;
    }

    setVendorSaleLoading(true);
    try {
      // Check if it's a registered user (clients and other vendors are both valid recipients)
      const userSnap = await getDoc(doc(db, "usuarios", raw));
      if (!userSnap.exists()) {
        toast({ variant: "destructive", title: "Código no reconocido", description: "Este código no corresponde a un socio registrado." });
        return;
      }

      const clientData = userSnap.data();
      const clientName = clientData.nombre || clientData.displayName || "Socio";
      const vendorName = shopForm.nombreTienda || "Mi Local";

      // Create pending_stamps doc for real-time client feedback
      const pendingRef = await addDoc(collection(db, "pending_stamps"), {
        userId: raw,
        userName: clientName,
        vendorId: currentUser.uid,
        vendorName,
        status: "vendor_processing",
        initiatedBy: "vendor",
        createdAt: serverTimestamp(),
      });

      setVendorSalePendingId(pendingRef.id);
      setVendorSaleTarget({ clientId: raw, clientName });
      setVendorSaleMonto("");
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo verificar el código. Inténtalo de nuevo." });
    } finally {
      setVendorSaleLoading(false);
    }
  };

  const handleConfirmVendorSale = async () => {
    if (!vendorSaleTarget || !vendorSalePendingId) return;
    const montoNum = parseInt(vendorSaleMonto.replace(/\D/g, ""), 10) || 0;
    if (montoNum <= 0 || montoNum > 150_000) {
      toast({ variant: "destructive", title: "Monto inválido", description: "Ingresa un monto entre $1 y $150.000." });
      return;
    }

    setVendorSaleLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sin sesión");

      const res = await fetch("/api/handshake/vendor-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ pendingId: vendorSalePendingId, monto: montoNum }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al confirmar");

      const sellosOtorgados = data.numSellos ?? 1;
      toast({ title: "✅ Sello confirmado", description: `+${sellosOtorgados} ${sellosOtorgados === 1 ? "sello" : "sellos"} acreditado${sellosOtorgados === 1 ? "" : "s"} a ${vendorSaleTarget.clientName}.` });
      setVendorSaleTarget(null);
      setVendorSalePendingId(null);
      setVendorSaleMonto("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudo confirmar el sello." });
    } finally {
      setVendorSaleLoading(false);
    }
  };

  const handleCancelVendorSale = async () => {
    const idToDelete = vendorSalePendingId;
    setVendorSaleTarget(null);
    setVendorSalePendingId(null);
    setVendorSaleMonto("");
    if (idToDelete) {
      const { doc: fsDoc, deleteDoc } = await import("firebase/firestore");
      deleteDoc(fsDoc(db, "pending_stamps", idToDelete)).catch(() => {});
    }
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

  const handlePublicarOferta = async () => {
    if (!ofertaTexto.trim() || !vendorUid) return;
    setSavingOferta(true);
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      await addDoc(collection(db, "ofertas_dia"), {
        vendorId: vendorUid,
        localNombre: shopForm.nombreTienda || "Local Aliado",
        localId: vendorUid,
        texto: ofertaTexto.trim(),
        fechaISO: hoy,
        activa: true,
        creadoEn: serverTimestamp(),
      });
      toast({ title: "¡Oferta publicada!", description: "Los socios la verán al abrir la app hoy." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSavingOferta(false);
    }
  };

  const handleEliminarOferta = async () => {
    if (!ofertaHoy?.id) return;
    try {
      await deleteDoc(doc(db, "ofertas_dia", ofertaHoy.id));
      toast({ title: "Oferta eliminada" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  if (!profileChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
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

          {/* ── QR Universal ── */}
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white text-center p-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-5"
              style={{ background: "linear-gradient(135deg, #C9920A22 0%, #8DC63F22 100%)", border: "1px solid #C9920A44" }}>
              <QrCode className="w-3.5 h-3.5" style={{ color: "#C9920A" }} />
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#C9920A" }}>
                QR Universal
              </span>
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-2">Código de Mostrador</h2>
            <p className="text-sm text-slate-500 mb-8 max-w-[280px] mx-auto leading-relaxed">
              Un solo QR para todos. Clientes nuevos se registran y su primer sello queda en tu cuenta. Clientes actuales van directo a confirmar su sello.
            </p>

            {/* QR */}
            <div id="qr-codigo-mostrador" className="bg-white p-5 rounded-3xl inline-block shadow-xl border-2 mx-auto mb-6"
              style={{ borderColor: "#C9920A33" }}>
              <QRCode
                value={auth.currentUser?.uid
                  ? `https://clubpatiocurauma.synaptechspa.cl/scan?ref=${auth.currentUser.uid}`
                  : "cargando"}
                size={260}
                fgColor="#1a1a1a"
                className="rounded-xl"
              />
            </div>

            {/* Instrucción visual */}
            <div className="flex items-center justify-center gap-6 mb-8 text-xs text-slate-400 font-medium">
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-base">👤</div>
                <span>Cliente nuevo</span>
                <span className="text-[10px] text-green-600 font-bold">→ Se registra</span>
              </div>
              <div className="text-slate-200 text-lg">|</div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-base">🎫</div>
                <span>Ya registrado</span>
                <span className="text-[10px] text-blue-600 font-bold">→ Suma sello</span>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col items-center gap-3">
              <Button
                className="w-full max-w-[280px] rounded-xl font-bold gap-2 shadow-md hover:scale-[1.02] transition-all"
                style={{ background: "linear-gradient(135deg, #C9920A, #8DC63F)", color: "white" }}
                onClick={handleDownloadQR}
              >
                <Download className="w-5 h-5" />
                Descargar QR
              </Button>
              <Button
                variant="outline"
                className="w-full max-w-[280px] rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-50 gap-2"
                onClick={() => {
                  if (auth.currentUser?.uid) {
                    navigator.clipboard.writeText(`${window.location.origin}/scan?ref=${auth.currentUser.uid}`);
                    toast({ title: "Enlace copiado", description: "Compártelo por WhatsApp o Instagram." });
                  }
                }}
              >
                <Copy className="w-4 h-4" />
                Copiar Enlace
              </Button>
              <p className="text-[10px] text-slate-300 font-mono mt-1">
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
    const tiendaNombre = userData?.nombreTienda || "nuestra tienda";
    const vendorNombre = userData?.nombre || "tu emprendedor/a";

    const PLANTILLAS = [
      {
        label: "Fidelización", emoji: "⭐",
        bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700",
        msg: `¡Hola! 👋 Soy ${vendorNombre} de ${tiendaNombre} en Patio Curauma. ¡Gracias por visitarnos! Cada compra suma un sello ⭐ y te acerca a tu premio. ¡Vuelve pronto! 🎁`,
      },
      {
        label: "Bienvenida", emoji: "🥳",
        bg: "bg-green-50", border: "border-green-200", text: "text-green-700",
        msg: `¡Bienvenida/o al Club! 🥳 Soy ${vendorNombre} de ${tiendaNombre}. Ya eres parte del Club Patio Curauma: cada visita suma un sello ⭐ y al llegar a 10 ¡ganas un premio especial! 🎁`,
      },
      {
        label: "Promoción", emoji: "🎉",
        bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700",
        msg: `¡Hola! 🎉 Hoy tenemos algo especial en ${tiendaNombre}. Ven a visitarnos y suma tu sello del día. ¡Te esperamos con novedades en Patio Curauma! 👋`,
      },
      {
        label: "Reactivación", emoji: "💛",
        bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700",
        msg: `¡Hola! 😊 Te echamos de menos en ${tiendaNombre}. ¿Cómo has estado? Esta semana tenemos novedades que te van a gustar. ¡Te esperamos en Patio Curauma! 🙌`,
      },
    ];

    return (
      <main className="min-h-screen bg-slate-50/50 pb-20 font-sans animate-in slide-in-from-right duration-300">
        <div className="bg-white border-b border-slate-200 p-6 sticky top-0 z-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setView("dashboard")} className="text-slate-400">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">CRM · Mis Clientes</h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{mes}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={loadCRM} disabled={crmLoading} className="text-slate-400 gap-1">
            <RefreshCw className={`w-4 h-4 ${crmLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="max-w-lg mx-auto p-5 space-y-6">
          {allVentas.length === 0 && !crmLoading ? (
            <div className="text-center py-16 space-y-3">
              <BarChart2 className="w-12 h-12 text-slate-200 mx-auto" />
              <p className="text-sm font-bold text-slate-400">Sin datos aún</p>
              <p className="text-xs text-slate-300">Los datos aparecen cuando confirmas sellos en el Panel de Validación.</p>
            </div>
          ) : (
            <>
              {/* ── KPIs del mes ─────────────────────────────────────────────── */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Resumen del mes</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Ingresos</span>
                    </div>
                    <p className="text-xl font-black text-slate-800">{crm.ingresosMes > 0 ? formatCLP(crm.ingresosMes) : "—"}</p>
                    {crm.ingresosMes === 0 && <p className="text-[9px] text-slate-300">Ingresa montos al validar</p>}
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Clientes</span>
                    </div>
                    <p className="text-xl font-black text-slate-800">{crm.clientesUnicos}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <RefreshCw className="w-4 h-4 text-purple-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Retorno</span>
                    </div>
                    <p className="text-xl font-black text-slate-800">{crm.tasaRetorno}%</p>
                  </div>
                  <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Sellos totales</span>
                    </div>
                    <p className="text-xl font-black text-slate-800">{sellosHistoricoFromLogs ?? userData?.sellosEntregadosHistorico ?? crm.totalRegistros}</p>
                  </div>
                  {crm.ticketPromedio > 0 && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1 col-span-2">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Ticket promedio</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-xl font-black text-slate-800">{formatCLP(crm.ticketPromedio)}</p>
                        <p className="text-[10px] text-slate-300">por compra · {crm.ventasConMontoCount} ventas con monto</p>
                      </div>
                    </div>
                  )}
                  {vendorReviewCount > 0 && vendorAvgRating !== null && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1 col-span-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Valoración socios</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xl font-black text-slate-800">{vendorAvgRating.toFixed(1)}</p>
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map((s) => (
                            <Star key={s} className={`w-4 h-4 ${s <= Math.round(vendorAvgRating) ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}`} />
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400">{vendorReviewCount} valoracion{vendorReviewCount !== 1 ? "es" : ""}</p>
                      </div>
                    </div>
                  )}
                </div>
                {crm.ingresosMes === 0 && allVentas.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                    <DollarSign className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">Activa el ingreso de montos</p>
                      <p className="text-xs text-amber-700 mt-1">Al confirmar un sello ingresa el valor de la boleta para ver ingresos reales aquí.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Análisis SynapTech AI ─────────────────────────────────────── */}
              {allVentas.length > 0 && (
                <SynapTechAIPanel
                  title="Análisis de tu Local"
                  insights={generarInsightsCRM(crm, sellosHistoricoFromLogs ?? userData?.sellosEntregadosHistorico ?? crm.totalRegistros)}
                />
              )}

              {/* ── Segmentación conductual (5 perfiles) ──────────────────────── */}
              {crm.topClientes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Users className="w-4 h-4 text-slate-400" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Segmentación de clientes</p>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
                    {/* Barra de distribución apilada */}
                    <div className="flex w-full h-3 rounded-full overflow-hidden bg-slate-100">
                      {crm.segmentacion.filter(s => s.cantidad > 0).map(s => (
                        <div
                          key={s.perfil}
                          style={{ width: `${s.porcentaje}%`, background: s.meta.color }}
                          title={`${s.perfil}: ${s.cantidad} (${s.porcentaje}%)`}
                        />
                      ))}
                    </div>
                    {/* Detalle por perfil */}
                    <div className="space-y-1.5">
                      {crm.segmentacion.map(s => (
                        <div key={s.perfil} className="flex items-center gap-2.5">
                          <span className="text-base leading-none">{s.meta.emoji}</span>
                          <span className="text-sm font-semibold text-slate-700 flex-1">{s.perfil}</span>
                          <span className="text-xs font-bold text-slate-500 tabular-nums">{s.cantidad}</span>
                          <span className="text-[10px] text-slate-400 w-9 text-right tabular-nums">{s.porcentaje}%</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      Clasificación automática según frecuencia, gasto y recencia de cada cliente.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Top clientes (con WhatsApp) ───────────────────────────────── */}
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
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-slate-800 truncate">{c.nombre}</p>
                            {c.perfil && (
                              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0", PERFILES_META[c.perfil].badgeClass)}>
                                {PERFILES_META[c.perfil].emoji} {c.perfil}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {c.visitas} visita{c.visitas !== 1 ? "s" : ""}
                            {c.gasto > 0 ? ` · ${formatCLP(c.gasto)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-[10px] text-slate-300 hidden sm:block">
                            {new Date(c.ultimaVisita).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                          </p>
                          <button
                            onClick={() => abrirWhatsApp(c.clienteId, c.nombre, tiendaNombre, vendorNombre, "fidelizacion")}
                            disabled={wspLoading === c.clienteId}
                            className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center hover:bg-green-100 transition-colors"
                            title="Enviar WhatsApp de agradecimiento"
                          >
                            {wspLoading === c.clienteId
                              ? <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                              : <MessageCircle className="w-4 h-4 text-green-500" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-300 px-1">El botón verde abre WhatsApp con un mensaje personalizado (requiere que el cliente tenga teléfono registrado).</p>
                </div>
              )}

              {/* ── Clientes sin regresar (+30 días) ─────────────────────────── */}
              {crm.clientesInactivos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Clock className="w-4 h-4 text-orange-400" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sin regresar (+30 días)</p>
                    <span className="ml-auto text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">{crm.clientesInactivos.length}</span>
                  </div>
                  <div className="space-y-2">
                    {crm.clientesInactivos.map((c) => {
                      const dias = Math.floor((Date.now() - new Date(c.ultimaVisita).getTime()) / 86400000);
                      return (
                        <div key={c.clienteId} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                          <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{c.nombre}</p>
                            <p className="text-[10px] text-orange-500 font-medium">{dias} días sin visitar</p>
                          </div>
                          <button
                            onClick={() => abrirWhatsApp(c.clienteId, c.nombre, tiendaNombre, vendorNombre, "reactivacion")}
                            disabled={wspLoading === c.clienteId}
                            className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center hover:bg-green-100 transition-colors shrink-0"
                            title="Enviar WhatsApp de reactivación"
                          >
                            {wspLoading === c.clienteId
                              ? <Loader2 className="w-4 h-4 animate-spin text-green-500" />
                              : <MessageCircle className="w-4 h-4 text-green-500" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Análisis de visitas por día ───────────────────────────────── */}
              {allVentas.length > 3 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Días más activos</p>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-end gap-2 h-20">
                      {DIAS_SEMANA.map((dia, i) => {
                        const visitas = crm.visitasPorDia[i];
                        const pct = Math.round((visitas / crm.maxDia) * 100);
                        const isMax = visitas === crm.maxDia && visitas > 0;
                        return (
                          <div key={dia} className="flex-1 flex flex-col items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-400">{visitas > 0 ? visitas : ""}</span>
                            <div
                              className="w-full rounded-t-lg"
                              style={{
                                height: `${Math.max(pct * 0.52, 4)}px`,
                                background: isMax ? "linear-gradient(180deg,#D3B673,#C9920A)" : "#E2E8F0",
                              }}
                            />
                            <span className="text-[9px] font-bold" style={{ color: isMax ? "#C9920A" : "#94A3B8" }}>{dia}</span>
                          </div>
                        );
                      })}
                    </div>
                    {crm.maxDia > 0 && (
                      <p className="text-xs text-slate-500 mt-3 text-center">
                        Mejor día: <strong style={{ color: "#C9920A" }}>{DIAS_SEMANA[crm.visitasPorDia.indexOf(crm.maxDia)]}</strong> · {crm.maxDia} visita{crm.maxDia !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Plantillas de mensaje WhatsApp ───────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <MessageCircle className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Plantillas WhatsApp</p>
                </div>
                <div className="space-y-2">
                  {PLANTILLAS.map(({ label, emoji, bg, border, text, msg }) => (
                    <div key={label} className={`rounded-2xl p-4 border ${bg} ${border} space-y-2`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-700">{emoji} {label}</p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg);
                            toast({ title: `"${label}" copiada`, description: "Pégala en WhatsApp y agrega el nombre del cliente." });
                          }}
                          className={`flex items-center gap-1 text-[10px] font-bold ${text} hover:opacity-80 transition-opacity bg-white/60 px-2.5 py-1 rounded-full border ${border}`}
                        >
                          <Copy className="w-3 h-3" /> Copiar
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{msg}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-300 px-1">Copia, pega en WhatsApp y personaliza el nombre del cliente antes de enviar.</p>
              </div>
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
                    <button
                      type="button"
                      onClick={() => setShopForm({...shopForm, categoria: "otra"})}
                      className={cn(
                        "h-12 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2",
                        shopForm.categoria === "otra" || (!CATEGORIES.some(c => c.id === shopForm.categoria) && shopForm.categoria !== "")
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-600 hover:border-primary/40"
                      )}
                    >
                      Otra…
                    </button>
                  </div>
                  {(shopForm.categoria === "otra" || (!CATEGORIES.some(c => c.id === shopForm.categoria) && shopForm.categoria !== "")) && (
                    <Input
                      placeholder="Escribe tu categoría personalizada..."
                      className="h-11 border-slate-200 focus:border-primary rounded-xl text-sm"
                      value={shopForm.categoria === "otra" ? "" : shopForm.categoria}
                      onChange={(e) => setShopForm({...shopForm, categoria: e.target.value || "otra"})}
                      autoFocus
                    />
                  )}
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
                    inputMode="tel"
                    placeholder="+56 9 XXXX XXXX"
                    className="h-12 border-slate-200 focus:border-primary rounded-lg text-base"
                    value={shopForm.whatsapp}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (!val.startsWith('+')) val = '+' + val.replace(/^\++/, '');
                      setShopForm({...shopForm, whatsapp: val});
                    }}
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

              {/* ── Mi Link in Bio (bioo.cl) ─────────────────────────────── */}
              <div className="mt-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50/60 p-5">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-black text-slate-800 flex items-center gap-2 flex-wrap">
                      Mi Link in Bio
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-700 border border-violet-300">bioo.cl</span>
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                      Tu página de enlaces para la bio de Instagram, con tu WhatsApp, redes y web en un solo toque.
                    </p>
                  </div>
                </div>

                {!biooInfo.handle ? (
                  <div className="mt-4 space-y-3">
                    <Button
                      onClick={crearMiBioo}
                      disabled={biooBusy}
                      className="w-full h-12 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 gap-2"
                    >
                      {biooBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      {biooBusy ? "Creando…" : "Crear mi Link in Bio"}
                    </Button>
                    <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                      Se crea con tus datos ya cargados. {!shopForm.isPremium && (
                        <span className="text-violet-600 font-semibold">Con el plan Patrocinado desbloqueas temas, fondos y animaciones premium.</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2 rounded-xl bg-white border border-violet-200 px-3 py-3">
                      <Link2 className="w-4 h-4 text-violet-500 shrink-0" />
                      <span className="text-sm font-bold text-slate-800 truncate flex-1">bioo.cl/{biooInfo.handle}</span>
                      <button
                        type="button"
                        onClick={() => copiarBioo(biooInfo.publicUrl || `https://bioo.cl/${biooInfo.handle}`, "Enlace copiado")}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                        aria-label="Copiar enlace"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={biooInfo.publicUrl || `https://bioo.cl/${biooInfo.handle}`}
                        target="_blank" rel="noopener noreferrer"
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                        aria-label="Ver página"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={abrirEditorBioo}
                      disabled={biooOpening}
                      className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {biooOpening ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      {biooOpening ? "Abriendo editor…" : "Personalizar mi página →"}
                    </button>
                    <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                      Entras directo al editor con tu sesión, sin volver a iniciar sesión.
                      {!shopForm.isPremium && <span className="text-violet-600 font-semibold"> Hazte Patrocinado para temas y fondos premium.</span>}
                    </p>
                  </div>
                )}
              </div>

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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold">
              Aliado Activo
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowGuide(true)}
              className="text-slate-400 hover:text-primary"
              aria-label="¿Cómo funciona?"
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
          </div>
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
              <Button
                onClick={() => router.push("/validar")}
                className="w-full h-16 rounded-2xl font-bold text-base gap-3 shadow-lg active:scale-[0.97] transition-transform"
                style={{ backgroundColor: "#D3B673", color: "#fff" }}
              >
                <span className="text-lg">🛠️</span>
                Panel de Validación (Caja)
              </Button>
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
            const sellosEsteMes = sellosEsteMesFromLogs ?? userData?.sellosEntregadosMensual?.[mes] ?? 0;
            const sellosHistorico = sellosHistoricoFromLogs ?? userData?.sellosEntregadosHistorico ?? 0;
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

        {/* OFERTA DEL DÍA */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="text-base">🔥</span>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Oferta del Día</h2>
          </div>
          <Card className="border-none shadow-sm bg-white rounded-[2rem]">
            <CardContent className="p-5 space-y-4">
              {ofertaHoy ? (
                <div className="space-y-3">
                  <div className="rounded-2xl p-4 border" style={{ background: "linear-gradient(135deg, #FFF7E6 0%, #FFFBF0 100%)", borderColor: "rgba(201,146,10,0.2)" }}>
                    <p className="text-sm font-bold text-slate-800 leading-snug">{ofertaHoy.texto}</p>
                    <p className="text-[10px] font-black mt-1.5" style={{ color: "#C9920A" }}>Activa hoy · visible en la app</p>
                  </div>
                  <button
                    onClick={handleEliminarOferta}
                    className="w-full h-10 rounded-xl font-bold text-red-500 border border-red-100 bg-red-50/50 hover:bg-red-50 transition-colors text-sm"
                  >
                    Eliminar oferta
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    value={ofertaTexto}
                    onChange={(e) => setOfertaTexto(e.target.value.slice(0, 120))}
                    placeholder="Ej: 20% en todos los cafés hoy ☕"
                    className="rounded-xl resize-none text-sm"
                    rows={3}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">{ofertaTexto.length}/120 caracteres</span>
                    <Button
                      onClick={handlePublicarOferta}
                      disabled={!ofertaTexto.trim() || savingOferta}
                      className="h-10 px-5 rounded-xl font-bold text-sm gap-2"
                      style={{ backgroundColor: "#C9920A", color: "white" }}
                    >
                      {savingOferta ? <Loader2 className="w-4 h-4 animate-spin" /> : "🔥 Publicar"}
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-slate-400 text-center">Una oferta por día. Se limpia automáticamente a medianoche.</p>
            </CardContent>
          </Card>
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

      {/* ── Modal: Confirmar Sello (Emprendedor escaneó cliente) ── */}
      {vendorSaleTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleCancelVendorSale}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4" />
            <div className="px-7 pt-5 pb-8 space-y-6">
              {/* Header */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(211,182,115,0.12)", color: "#D3B673" }}>
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Cliente identificado</p>
                  <h3 className="text-xl font-black text-slate-800">{vendorSaleTarget.clientName}</h3>
                </div>
              </div>

              {/* Monto */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Monto de la compra <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 5000"
                    value={vendorSaleMonto}
                    onChange={(e) => setVendorSaleMonto(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && handleConfirmVendorSale()}
                    disabled={vendorSaleLoading}
                    autoFocus
                    className="w-full h-14 pl-8 pr-4 rounded-2xl border-2 border-slate-200 focus:border-primary focus:outline-none text-lg font-black text-slate-800 bg-slate-50 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Máximo $150.000.</p>
              </div>

              {/* Botones */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleConfirmVendorSale}
                  disabled={vendorSaleLoading || !vendorSaleMonto}
                  className="w-full h-14 rounded-2xl font-black text-base gap-2 shadow-lg"
                  style={{ backgroundColor: "#D3B673" }}
                >
                  {vendorSaleLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Confirmar sello (+1 ⭐)
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCancelVendorSale}
                  disabled={vendorSaleLoading}
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-bold gap-2 text-slate-500 border-slate-200"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <VendorStampModal vendorId={auth.currentUser?.uid ?? null} />

      {/* ── Modal de Guía ──────────────────────────────────────────────── */}
      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle + Header */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-800">¿Cómo funciona?</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowGuide(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Guía */}
            <div className="space-y-4">
              {[
                {
                  icon: "📱",
                  label: "Mi Código QR (Mostrador)",
                  desc: "Muestra este código a tus clientes. Ellos lo escanean con su app para registrar su visita y solicitar su sello.",
                },
                {
                  icon: "🛠️",
                  label: "Panel de Validación (Caja)",
                  desc: "Tu herramienta principal. Aquí apruebas los sellos que los clientes acaban de solicitar al escanear tu QR y registras el monto de la venta.",
                },
                {
                  icon: "📷",
                  label: "Escanear",
                  desc: "Opción alternativa. Úsala para escanear manualmente el QR del teléfono del cliente si ellos tienen problemas de conexión.",
                },
                {
                  icon: "📊",
                  label: "Clientes / CRM",
                  desc: "Revisa las estadísticas de quiénes te compran, identifica a tus clientes más leales y analiza tus ventas.",
                },
                {
                  icon: "🏪",
                  label: "Mi Tienda",
                  desc: "Actualiza tu perfil público. Cambia tu foto, descripción y horarios para que los socios del club te encuentren fácilmente.",
                },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex gap-3">
                  <span className="text-2xl shrink-0 leading-none mt-0.5">{icon}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full h-12 rounded-2xl font-bold"
              onClick={() => setShowGuide(false)}
            >
              Entendido
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
