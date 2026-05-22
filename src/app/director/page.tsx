
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Users, Ticket, TrendingUp,
  ArrowLeft, Download, Send, Plus, Trash2,
  Edit3, Trophy, Megaphone, Loader2, Store, Crown, Check, X, ImagePlus, FolderOpen, Copy, QrCode,
  Search, UserCheck,
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
import { ADMIN_EMAIL } from "@/lib/constants";
import { SynapTechAIPanel, type AIInsight } from "@/components/SynapTechAI";

function generarInsightsDirector(
  ranking: any[],
  kpiSellosMes: number,
  kpiLocalesActivos: number,
  kpiTotalLocales: number,
  chartData: { name: string; sellos: number }[]
): AIInsight[] {
  const out: AIInsight[] = [];
  if (ranking.length === 0) return out;

  // Locales dormidos
  const dormidos = ranking.filter(r => r.sellosEntregados === 0);
  if (dormidos.length > 0) {
    const pct = Math.round((dormidos.length / ranking.length) * 100);
    out.push({
      icon: "😴", type: dormidos.length >= ranking.length * 0.5 ? "alert" : "warning",
      text: `${dormidos.length} de ${ranking.length} locales (${pct}%) no han entregado ningún sello este mes. ${dormidos.length >= 3 ? "Considera contactarlos para reactivar su participación." : "Mantén el seguimiento cercano."}`,
    });
  }

  // Concentración en top 3
  if (ranking.length >= 4) {
    const top3 = ranking.slice(0, 3).reduce((s, r) => s + r.sellosEntregados, 0);
    const pctConc = kpiSellosMes > 0 ? Math.round((top3 / kpiSellosMes) * 100) : 0;
    if (pctConc > 70) {
      out.push({ icon: "📊", type: "warning", text: `Los 3 locales más activos concentran el ${pctConc}% de todos los sellos del mes. Alta dependencia — incentiva a los locales de menor actividad para distribuir mejor el flujo.` });
    } else if (pctConc > 0) {
      out.push({ icon: "📊", type: "positive", text: `El top 3 de locales representa el ${pctConc}% de los sellos mensuales. Distribución saludable — el resto del ecosistema también aporta volumen.` });
    }
  }

  // Local estrella del mes
  const lider = ranking[0];
  if (lider?.sellosEntregados > 0) {
    out.push({ icon: "🏆", type: "positive", text: `Líder del mes: "${lider.nombreTienda || "Local #1"}" con ${lider.sellosEntregados} sellos entregados. ${lider.sellosEntregados > (ranking[1]?.sellosEntregados || 0) * 2 ? "Domina con ventaja holgada sobre el segundo puesto." : "Diferencia ajustada con el segundo puesto."}` });
  }

  // Tendencia semanal
  const semanas = chartData.filter(s => s.sellos > 0);
  if (semanas.length >= 2) {
    const ultima = chartData[chartData.length - 1];
    const penultima = chartData[chartData.length - 2];
    if (ultima.sellos > penultima.sellos) {
      const delta = ultima.sellos - penultima.sellos;
      out.push({ icon: "📈", type: "positive", text: `La última semana registrada (${ultima.sellos} sellos) superó a la anterior en ${delta} sello${delta !== 1 ? "s" : ""}. Tendencia positiva del mes en curso.` });
    } else if (ultima.sellos < penultima.sellos) {
      out.push({ icon: "📉", type: "warning", text: `La actividad de la última semana (${ultima.sellos} sellos) bajó respecto a la anterior (${penultima.sellos}). Puede ser estacional — monitorea si continúa la semana siguiente.` });
    }
  }

  // Promedio por local activo
  if (kpiLocalesActivos > 0 && kpiSellosMes > 0) {
    const promedio = Math.round(kpiSellosMes / kpiLocalesActivos);
    out.push({ icon: "🔢", type: "neutral", text: `Promedio de ${promedio} sello${promedio !== 1 ? "s" : ""} por local activo este mes. ${promedio >= 20 ? "Nivel de actividad sólido." : "Hay margen para crecer con capacitación o incentivos a emprendedores."}` });
  }

  return out;
}

const COLORS = ['#D3B673', '#9DCC65', '#6EBBD1', '#BFA05C'];

export default function DirectorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasVendorRole, setHasVendorRole] = useState(false);
  const [activatingStore, setActivatingStore] = useState(false);
  const [rankingByRol, setRankingByRol] = useState<any[]>([]);
  const [rankingByRoles, setRankingByRoles] = useState<any[]>([]);
  const [showAllRanking, setShowAllRanking] = useState(false);
  const [premios, setPremios] = useState<any[]>([]);
  const [mensajeGlobal, setMensajeGlobal] = useState({
    titulo: "", cuerpo: "", destino: "todos", enviarEn: "",
    tipo: "info" as "info" | "urgente" | "promo" | "sorteo",
    cta: "",
    vendedorFiltro: "",
    usuarioFiltro: "",
  });
  const [userSearchQuery, setUserSearchQuery]   = useState("");
  const [userSearchResults, setUserSearchResults] = useState<{ uid: string; nombre: string; email: string }[]>([]);
  const [searchingUser, setSearchingUser]       = useState(false);
  const [selectedUserInfo, setSelectedUserInfo] = useState<{ uid: string; nombre: string; email: string } | null>(null);

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
  const [comunicadoTab, setComunicadoTab] = useState<"nuevo" | "historial">("nuevo");
  const [historial, setHistorial] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
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
        if ((user.email ?? "").trim().toLowerCase() === ADMIN_EMAIL) {
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

    // ── Ranking por vendedor — doble query para cubrir rol (string) y roles (array) ──
    const currentMonth = new Date().toISOString().substring(0, 7);
    const toRankRow = (d: any) => {
      const data = d.data();
      return {
        id: d.id,
        nombreTienda: data.nombreTienda || data.nombre || "Local Aliado",
        rubro: data.rubro || "General",
        sellosEntregados: (data.sellosEntregadosMensual?.[currentMonth]) || 0,
        sellosEntregadosHistorico: data.sellosEntregadosHistorico || 0,
        ultimaActividad: data.ultimaVenta || data.ultimaVisita || null,
      };
    };
    const unsubRankingRol = onSnapshot(
      query(collection(db, "usuarios"), where("rol", "==", "emprendedor"), limit(200)),
      (snap) => setRankingByRol(snap.docs.map(toRankRow))
    );
    const unsubRankingRoles = onSnapshot(
      query(collection(db, "usuarios"), where("roles", "array-contains", "emprendedor"), limit(200)),
      (snap) => setRankingByRoles(snap.docs.map(toRankRow))
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
      unsubRankingRol();
      unsubRankingRoles();
      unsubPremios();
      unsubProfiles();
    };
  }, [isAuthorized]);

  // Merged ranking: deduplica por ID, ordena por sellos del mes
  const ranking = useMemo(() => {
    const map = new Map<string, any>();
    [...rankingByRol, ...rankingByRoles].forEach((emp) => {
      if (!map.has(emp.id)) map.set(emp.id, emp);
    });
    return Array.from(map.values()).sort((a, b) => b.sellosEntregados - a.sellosEntregados);
  }, [rankingByRol, rankingByRoles]);

  // KPIs derivados del ranking
  const kpiSellosMes = ranking.reduce((s, v) => s + v.sellosEntregados, 0);
  const kpiLocalesActivos = ranking.filter((v) => v.sellosEntregados > 0).length;
  const kpiTotalLocales = Math.max(ranking.length, allProfiles.length);

  const handleExportRanking = async () => {
    const { default: XLSX } = await import("xlsx");
    const rows = ranking.map((emp, i) => ({
      "#": i + 1,
      Local: emp.nombreTienda,
      Rubro: emp.rubro,
      "Sellos Mes": emp.sellosEntregados,
      "Sellos Histórico": emp.sellosEntregadosHistorico,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ranking");
    XLSX.writeFile(wb, `ranking_emprendedores_${mesLabel.replace(/\s/g, "_").toLowerCase()}.xlsx`);
  };

  const searchUsers = async (q: string) => {
    const term = q.trim();
    if (term.length < 2) { setUserSearchResults([]); return; }
    setSearchingUser(true);
    try {
      const [byNombre, byEmail] = await Promise.all([
        getDocs(query(collection(db, "usuarios"), where("nombre", ">=", term), where("nombre", "<=", term + ""), limit(6))),
        getDocs(query(collection(db, "usuarios"), where("correo", ">=", term), where("correo", "<=", term + ""), limit(6))),
      ]);
      const map = new Map<string, { uid: string; nombre: string; email: string }>();
      [...byNombre.docs, ...byEmail.docs].forEach(d => {
        const data = d.data();
        map.set(d.id, { uid: d.id, nombre: data.nombre || "Sin nombre", email: data.correo || "" });
      });
      setUserSearchResults([...map.values()].slice(0, 8));
    } catch {
      setUserSearchResults([]);
    } finally {
      setSearchingUser(false);
    }
  };

  const handleSendGlobalMessage = async () => {
    if (!mensajeGlobal.titulo || !mensajeGlobal.cuerpo) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "Escribe un título y un mensaje." });
      return;
    }
    if (mensajeGlobal.destino === "usuario_especifico" && !mensajeGlobal.usuarioFiltro) {
      toast({ variant: "destructive", title: "Falta el destinatario", description: "Busca y selecciona un usuario." });
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
        usuarioFiltro: mensajeGlobal.destino === "usuario_especifico" ? mensajeGlobal.usuarioFiltro : null,
        usuarioFiltroNombre: mensajeGlobal.destino === "usuario_especifico" ? (selectedUserInfo?.nombre ?? null) : null,
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
      setMensajeGlobal({ titulo: "", cuerpo: "", destino: "todos", enviarEn: "", tipo: "info", cta: "", vendedorFiltro: "", usuarioFiltro: "" });
      setSelectedUserInfo(null);
      setUserSearchQuery("");
      setUserSearchResults([]);
      // Recargar historial tras enviar
      loadHistorial();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo encolar el comunicado." });
    } finally {
      setLoading(false);
    }
  };

  const loadHistorial = async () => {
    setLoadingHistorial(true);
    try {
      const snap = await getDocs(
        query(collection(db, "broadcast_messages"), orderBy("fechaCreacion", "desc"), limit(15))
      );
      setHistorial(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      // Sin permisos o colección vacía
    } finally {
      setLoadingHistorial(false);
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
      const profileSnap = await getDoc(doc(db, "entrepreneur_profiles", vendorId));
      const existing: string[] = profileSnap.data()?.imageUrls || [];
      const imageUrls = [url, ...existing.filter((u) => u !== url)].slice(0, 5);
      await updateDoc(doc(db, "entrepreneur_profiles", vendorId), {
        imageUrl: url,
        imageUrls,
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
            <Button size="sm" variant="outline" onClick={handleExportRanking} className="rounded-xl gap-2 font-bold text-[10px] uppercase">
              <Download className="w-3 h-3" /> Reporte
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-8">
        
        {/* KPI CARDS */}
        <section className="grid grid-cols-3 gap-3">
          {[
            { label: "Sellos del mes", value: kpiSellosMes, color: "#D3B673", icon: "🎟️" },
            { label: "Locales activos", value: kpiLocalesActivos, color: "#9DCC65", icon: "✅" },
            { label: "Total locales", value: kpiTotalLocales, color: "#6EBBD1", icon: "🏪" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="bg-white rounded-2xl p-4 shadow-sm text-center space-y-1 border border-slate-50">
              <span className="text-lg leading-none">{icon}</span>
              <p className="text-xl font-black" style={{ color }}>{value}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{label}</p>
            </div>
          ))}
        </section>

        {/* ANÁLISIS SYNAPTECH AI */}
        {ranking.length > 0 && (
          <SynapTechAIPanel
            title="Diagnóstico del Club"
            insights={generarInsightsDirector(ranking, kpiSellosMes, kpiLocalesActivos, kpiTotalLocales, chartData)}
          />
        )}

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
                <>
                  {(showAllRanking ? ranking : ranking.slice(0, 5)).map((emp, i) => (
                    <div key={emp.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-2xl group">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${i === 0 ? "bg-yellow-400 text-white" : i === 1 ? "bg-slate-300 text-white" : i === 2 ? "bg-amber-600/80 text-white" : "bg-slate-100 text-slate-400"}`}>
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{emp.nombreTienda || "Local Aliado"}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black">{emp.rubro || "General"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-primary">{emp.sellosEntregados || 0}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Mes</p>
                        </div>
                        <div className="text-right border-l pl-3 ml-1 border-slate-100">
                          <p className="text-sm font-black text-slate-600">{emp.sellosEntregadosHistorico || 0}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Total</p>
                        </div>
                        <button
                          onClick={() => setVendorToDelete({ id: emp.id, nombre: emp.nombreTienda || "Local Aliado" })}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50"
                          title="Eliminar local"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {ranking.length > 5 && (
                    <button
                      onClick={() => setShowAllRanking((v) => !v)}
                      className="w-full py-3 text-[11px] font-black text-slate-400 hover:text-primary transition-colors uppercase tracking-widest"
                    >
                      {showAllRanking ? "▲ Ver menos" : `▼ Ver todos (${ranking.length})`}
                    </button>
                  )}
                </>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 italic">No hay datos de actividad aún.</div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* COMUNICADO GLOBAL — CTA */}
        <section>
          <button
            onClick={() => { setComunicadoOpen(true); setComunicadoTab("nuevo"); loadHistorial(); }}
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

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {(["nuevo", "historial"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setComunicadoTab(tab)}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition-colors ${
                    comunicadoTab === tab
                      ? "text-white border-b-2 border-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {tab === "nuevo" ? "✏️ Nuevo" : "📋 Historial"}
                </button>
              ))}
            </div>

            {/* ── Tab: Historial ────────────────────────────────────── */}
            {comunicadoTab === "historial" && (
              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-white/60 uppercase tracking-widest">Últimos 15 comunicados</p>
                  <button onClick={loadHistorial} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                    {loadingHistorial ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Check className="w-3 h-3 text-white/60" />}
                  </button>
                </div>
                {loadingHistorial ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>
                ) : historial.length === 0 ? (
                  <p className="text-center text-white/40 text-xs py-10 font-medium">Sin comunicados enviados aún.</p>
                ) : (
                  <div className="space-y-2">
                    {historial.map((h: any) => {
                      const estadoColor: Record<string, string> = {
                        completado: "bg-green-500/20 text-green-300",
                        procesando: "bg-yellow-500/20 text-yellow-300",
                        pendiente: "bg-blue-500/20 text-blue-300",
                        programado: "bg-violet-500/20 text-violet-300",
                        error: "bg-red-500/20 text-red-300",
                      };
                      const estadoLabel: Record<string, string> = {
                        completado: "✓ Enviado",
                        procesando: "⏳ Enviando",
                        pendiente: "⏳ Pendiente",
                        programado: "🕐 Programado",
                        error: "✗ Error",
                      };
                      const destinoLabel: Record<string, string> = {
                        todos: "Todos",
                        emprendedor: "Emprendedores",
                        cerca_de_premio: "4+ sellos",
                        inactivos: "Inactivos",
                        activos_recientes: "Activos",
                        cumpleanios_mes: "Cumpleaños",
                        aceptaPromoLocales: "Con consentimiento",
                        visitaron_local: "Visitaron local",
                        usuario_especifico: h.usuarioFiltroNombre ? `👤 ${h.usuarioFiltroNombre}` : "Usuario específico",
                      };
                      return (
                        <div key={h.id} className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-black text-white leading-tight line-clamp-1">{h.titulo}</p>
                            <span className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${estadoColor[h.estado] ?? "bg-white/10 text-white/50"}`}>
                              {estadoLabel[h.estado] ?? h.estado}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/50 line-clamp-2">{h.mensaje}</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full">
                              {destinoLabel[h.destino] ?? h.destino}
                            </span>
                            {h.stats && (
                              <span className="text-[9px] font-bold text-white/40">
                                {h.stats.totalNotificados} notif · {h.stats.pushSent} push
                              </span>
                            )}
                            {h.fechaCreacion && (
                              <span className="text-[9px] text-white/30">
                                {new Date(h.fechaCreacion).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            {h.enviarEn && h.estado === "programado" && (
                              <span className="text-[9px] font-bold text-violet-300">
                                → {new Date(h.enviarEn).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                          {h.error && (
                            <p className="text-[10px] text-red-300 font-medium">{h.error}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Nuevo comunicado ─────────────────────────────── */}
            {comunicadoTab === "nuevo" && (
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
                <option value="usuario_especifico" className="text-slate-800">Usuario específico 👤</option>
              </select>

              {/* ── Búsqueda de usuario específico ─────────────────────── */}
              {mensajeGlobal.destino === "usuario_especifico" && (
                <div className="space-y-2">
                  {selectedUserInfo ? (
                    <div className="flex items-center gap-3 bg-white/15 border border-white/20 rounded-xl px-3 py-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-primary font-black text-sm shrink-0">
                        {selectedUserInfo.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate">{selectedUserInfo.nombre}</p>
                        <p className="text-xs text-white/50 truncate">{selectedUserInfo.email}</p>
                      </div>
                      <UserCheck className="w-4 h-4 text-green-400 shrink-0" />
                      <button
                        type="button"
                        onClick={() => { setSelectedUserInfo(null); setMensajeGlobal({ ...mensajeGlobal, usuarioFiltro: "" }); }}
                        className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Buscar por nombre o email..."
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-xl"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") searchUsers(userSearchQuery); }}
                      />
                      <button
                        type="button"
                        onClick={() => searchUsers(userSearchQuery)}
                        disabled={searchingUser || userSearchQuery.trim().length < 2}
                        className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white disabled:opacity-40 transition-colors shrink-0"
                      >
                        {searchingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                  {!selectedUserInfo && userSearchResults.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                      {userSearchResults.map((u) => (
                        <button
                          key={u.uid}
                          type="button"
                          onClick={() => {
                            setSelectedUserInfo(u);
                            setMensajeGlobal({ ...mensajeGlobal, usuarioFiltro: u.uid });
                            setUserSearchResults([]);
                            setUserSearchQuery("");
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors text-left border-b border-white/5 last:border-0"
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-xs shrink-0">
                            {u.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{u.nombre}</p>
                            <p className="text-xs text-white/50 truncate">{u.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {!selectedUserInfo && !searchingUser && userSearchQuery.trim().length >= 2 && userSearchResults.length === 0 && (
                    <p className="text-xs text-white/40 text-center py-1">Sin resultados — intenta con otro término</p>
                  )}
                </div>
              )}

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
                  cumpleanios_mes: "socios con cumpleaños este mes 🎂",
                  aceptaPromoLocales: "socios con consentimiento de promos",
                  visitaron_local: mensajeGlobal.vendedorFiltro
                    ? `socios que visitaron ${vendorList.find((v: any) => v.id === mensajeGlobal.vendedorFiltro)?.nombre ?? "el local"}`
                    : "socios de un local (selecciona el local)",
                  usuario_especifico: selectedUserInfo
                    ? `${selectedUserInfo.nombre} (${selectedUserInfo.email})`
                    : "usuario específico (selecciona uno)",
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
            )}
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
                  value={`https://clubpatiocurauma.synaptechspa.cl/canje?localId=${qrModalOpen.id}`}
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
                    navigator.clipboard.writeText(`https://clubpatiocurauma.synaptechspa.cl/canje?localId=${qrModalOpen.id}`);
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
