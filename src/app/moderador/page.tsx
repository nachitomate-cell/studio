"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where, updateDoc, doc, limit, orderBy, getDoc, setDoc, writeBatch, increment, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, AlertTriangle, Search, Gift, Zap, ShieldCheck, UserCog, Trash2, BarChart2, Settings, ToggleLeft, ToggleRight, RefreshCw, Share2, Clock, MessageSquare, CheckCheck, Eye, Hourglass, X, Store, ArrowRight, Star } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

import { registrarCompra } from "@/lib/puntos";

import { ADMIN_EMAIL as MASTER_EMAIL, ALLOWED_MOD_EMAILS as ALLOWED_EMAILS } from "@/lib/constants";

const MAX_PIN_ATTEMPTS = 3;
const PIN_LOCKOUT_SECONDS = 60;

const PIN_MAP: Record<string, string> = {
  [MASTER_EMAIL]: (process.env.NEXT_PUBLIC_MOD_PIN_ADMIN || "482917").trim(),
  "fgcservicios@gmail.com": (process.env.NEXT_PUBLIC_MOD_PIN_FGC || "736254").trim(),
};

interface Cliente {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  rol?: string;
  sellos?: number;
  nps?: { score: number; fecha: string; comentario?: string };
}

interface PendingStamp {
  id: string;
  userId: string | null;
  userName: string;
  vendorId: string | null;
  vendorName: string | null;
  status: "pending" | "vendor_processing";
  monto: number | null;
  initiatedBy: string;
  createdAt: number | null;
}

export default function ModeradorPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  // Estados Generales
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  
  // Estados Tabla de Clientes
  const [loadingData, setLoadingData] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  // Estados panel
  const [searchTerm, setSearchTerm] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [loadingRole, setLoadingRole] = useState(false);
  const [recentTrans, setRecentTrans] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Config sello bienvenida
  const [configBienvenida, setConfigBienvenida] = useState<{ activo: boolean; cantidad: number }>({ activo: true, cantidad: 1 });
  const [savingConfig, setSavingConfig] = useState(false);

  // Recálculo socios captados
  const [recalcSocios, setRecalcSocios] = useState(false);
  const [recalcSociosResult, setRecalcSociosResult] = useState<string | null>(null);

  // Referidos
  const [referralPending, setReferralPending] = useState<any[]>([]);
  const [referralCompleted, setReferralCompleted] = useState(0);
  const [loadingReferrals, setLoadingReferrals] = useState(false);

  // Transacciones pendientes
  const [pendingStamps, setPendingStamps] = useState<PendingStamp[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Confirmación de eliminación
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<Cliente | null>(null);

  // Sugerencias de usuarios
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [loadingSugerencias, setLoadingSugerencias] = useState(true);

  // Solicitudes de unirse al club
  const [solicitudesClub, setSolicitudesClub] = useState<any[]>([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);

  // Refresh manual (reemplaza onSnapshot)
  const [refreshing, setRefreshing] = useState(false);

  // PIN — con bloqueo por intentos fallidos
  const [pinVerified, setPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinAttempts, setPinAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockdownSeconds, setLockdownSeconds] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // No logueado → redirigir al login directamente
        setLoadingConfig(false);
        router.push("/");
        return;
      }
      if (!ALLOWED_EMAILS.includes((user.email ?? "").trim().toLowerCase())) {
        // Logueado pero sin permisos
        setAccessDenied(true);
        setLoadingConfig(false);
        setTimeout(() => {
          router.push("/");
        }, 3500);
        return;
      }

      setCurrentUserEmail((user.email ?? "").trim().toLowerCase());
      setLoadingConfig(false);
      fetchClientes();
      loadConfigBienvenida();
      loadReferralStats();
      fetchLiveData();
      fetchPendingStamps();
    });

    return () => { unsubscribe(); };
  }, [router]);

  const fetchLiveData = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [sugerSnap, logsSnap, solicSnap] = await Promise.all([
        getDocs(query(collection(db, "sugerencias"), orderBy("fecha", "desc"), limit(50))),
        getDocs(query(collection(db, "system_logs"), orderBy("fecha", "desc"), limit(30))),
        getDocs(query(collection(db, "solicitudes_club"), orderBy("fecha", "desc"), limit(100))),
      ]);
      setSugerencias(sugerSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setRecentTrans(logsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSolicitudesClub(solicSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.warn("fetchLiveData:", e);
    } finally {
      setLoadingSugerencias(false);
      if (showSpinner) setRefreshing(false);
    }
  };

  // Countdown para el bloqueo del PIN
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setPinAttempts(0);
        setLockdownSeconds(0);
      } else {
        setLockdownSeconds(remaining);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const handlePinSubmit = () => {
    if (lockedUntil && Date.now() < lockedUntil) return;
    const expected = currentUserEmail ? PIN_MAP[currentUserEmail] : null;
    if (expected && pinInput.trim() === expected) {
      setPinVerified(true);
      setPinAttempts(0);
    } else {
      const next = pinAttempts + 1;
      setPinAttempts(next);
      setPinInput("");
      if (next >= MAX_PIN_ATTEMPTS) {
        setLockedUntil(Date.now() + PIN_LOCKOUT_SECONDS * 1000);
      }
    }
  };

  const fetchClientes = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sin sesión");

      const res = await fetch("/api/admin/usuarios", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { usuarios: docs } = await res.json();

      const data: Cliente[] = (docs as any[]).map((d) => {
        let formattedDate = "N/A";
        const fn = d.fechaNacimiento;
        if (fn) {
          // Firestore timestamp serializado como { _seconds, _nanoseconds }
          const dt = fn._seconds
            ? new Date(fn._seconds * 1000)
            : typeof fn === "string" ? new Date(fn) : null;
          if (dt && !isNaN(dt.getTime())) {
            formattedDate = new Intl.DateTimeFormat("es-CL", {
              day: "2-digit", month: "2-digit", year: "numeric",
            }).format(dt);
          }
        }

        return {
          id: d.id,
          nombre: d.nombre || "Sin nombre",
          email: d.email || d.correo || "Sin correo",
          telefono: d.telefono || "Sin teléfono",
          fechaNacimiento: formattedDate,
          rol: d.rol || "cliente",
          sellos: d.comprasRealizadas || 0,
          nps: d.nps ?? undefined,
        };
      });

      data.sort((a, b) => a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase()));
      setClientes(data);
    } catch {
      // error silenciado — loadingData: false muestra tabla vacía
    } finally {
      setLoadingData(false);
    }
  };

  const fetchPendingStamps = async () => {
    setLoadingPending(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sin sesión");
      const res = await fetch("/api/admin/pending-stamps", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { stamps } = await res.json();
      setPendingStamps(stamps ?? []);
    } catch {
      setPendingStamps([]);
    } finally {
      setLoadingPending(false);
    }
  };

  const loadReferralStats = async () => {
    setLoadingReferrals(true);
    try {
      const [pendingSnap, completedSnap] = await Promise.all([
        getDocs(query(collection(db, "referidos_pendientes"), where("status", "==", "pending"))),
        getDocs(query(collection(db, "referidos_pendientes"), where("status", "==", "completed"))),
      ]);
      const pendingList = pendingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      pendingList.sort((a: any, b: any) => (b.creadoEn?.toMillis?.() ?? 0) - (a.creadoEn?.toMillis?.() ?? 0));
      setReferralPending(pendingList);
      setReferralCompleted(completedSnap.size);
    } catch {
      // Sin permisos o colección vacía — no crítico
    } finally {
      setLoadingReferrals(false);
    }
  };

  const loadConfigBienvenida = async () => {
    try {
      const snap = await getDoc(doc(db, "configuracion", "general"));
      if (snap.exists()) {
        const data = snap.data()?.selloBienvenida;
        if (data) setConfigBienvenida({ activo: data.activo !== false, cantidad: Number(data.cantidad ?? 1) });
      }
    } catch { /* no crítico */ }
  };

  const saveConfigBienvenida = async () => {
    setSavingConfig(true);
    try {
      await setDoc(doc(db, "configuracion", "general"), {
        selloBienvenida: { activo: configBienvenida.activo, cantidad: configBienvenida.cantidad },
      }, { merge: true });
      toast({ title: "Configuración guardada", description: `Sello de bienvenida ${configBienvenida.activo ? `activo · ${configBienvenida.cantidad} sello(s)` : "desactivado"}.` });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la configuración." });
    } finally {
      setSavingConfig(false);
    }
  };

  const recalcularSociosCaptados = async () => {
    setRecalcSocios(true);
    setRecalcSociosResult(null);
    try {
      const logsSnap = await getDocs(
        query(collection(db, "system_logs"), where("metodo", "==", "REFERIDO"))
      );

      const vendorClients: Record<string, Set<string>> = {};
      logsSnap.forEach(d => {
        const { vendedorId, usuarioId } = d.data();
        if (!vendedorId || !usuarioId || vendedorId === "simulacion") return;
        if (!vendorClients[vendedorId]) vendorClients[vendedorId] = new Set();
        vendorClients[vendedorId].add(usuarioId);
      });

      const totalVendors = Object.keys(vendorClients).length;
      if (totalVendors === 0) {
        setRecalcSociosResult("Sin registros REFERIDO en system_logs.");
        toast({ title: "Sin datos", description: "No hay registros con metodo=REFERIDO aún." });
        return;
      }

      const batch = writeBatch(db);
      Object.entries(vendorClients).forEach(([vendorId, clients]) => {
        batch.update(doc(db, "usuarios", vendorId), {
          clientesNuevosRegistrados: clients.size,
        });
      });
      await batch.commit();

      const resumen = Object.entries(vendorClients)
        .map(([id, c]) => `${id.substring(0, 8)}: ${c.size}`)
        .join(" | ");
      setRecalcSociosResult(`${totalVendors} emprendedor(es) actualizados. ${resumen}`);
      toast({ title: "Recálculo completado", description: `${totalVendors} emprendedor(es) actualizados.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en recálculo", description: e.message });
    } finally {
      setRecalcSocios(false);
    }
  };

  const handleSearchUserForRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm) { setFoundUser(null); return; }
    setLoadingRole(true);
    try {
      const term = searchTerm.toLowerCase().trim();

      // Buscar por email en ambos campos posibles (correo y email)
      const [snapCorreo, snapEmail] = await Promise.all([
        getDocs(query(collection(db, "usuarios"), where("correo", "==", term))),
        getDocs(query(collection(db, "usuarios"), where("email", "==", term))),
      ]);
      const seen = new Set<string>();
      const uniqueDocs = [...snapCorreo.docs, ...snapEmail.docs].filter(d => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });

      if (uniqueDocs.length > 0) {
        setFoundUser({ id: uniqueDocs[0].id, ...uniqueDocs[0].data() });
        return;
      }

      // Fallback: buscar por nombre en el directorio ya cargado
      const byName = clientes.filter(c => c.nombre.toLowerCase().includes(term));
      if (byName.length > 0) {
        const docSnap = await getDoc(doc(db, "usuarios", byName[0].id));
        if (docSnap.exists()) {
          setFoundUser({ id: docSnap.id, ...docSnap.data() });
          return;
        }
      }

      setFoundUser(null);
      toast({ title: "Sin resultados", description: "No se encontró usuario con ese correo o nombre.", variant: "destructive" });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Fallo de comunicación con Firebase." });
    } finally {
      setLoadingRole(false);
    }
  };

  const updateUserRole = async (newRole: string) => {
    if (!foundUser) return;
    setActionLoading(true);
    try {
      const userRef = doc(db, "usuarios", foundUser.id);
      const currentRoles: string[] = foundUser.roles || [];
      const oldRole: string | undefined = foundUser.rol;
      // Sincronizar array `roles` junto con el campo `rol`
      const updatedRoles = [...new Set([...currentRoles.filter((r: string) => r !== oldRole), newRole])];
      await updateDoc(userRef, { rol: newRole, roles: updatedRoles, updatedAt: new Date().toISOString() });
      setFoundUser({ ...foundUser, rol: newRole, roles: updatedRoles });
      toast({ title: "¡Rol Actualizado!", description: `El usuario ahora tiene el rol: ${newRole}` });
      fetchClientes();
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el rol." });
    } finally {
      setActionLoading(false);
    }
  };

  const grantStampToFoundUser = async () => {
    if (!foundUser) return;
    setActionLoading(true);
    try {
      await registrarCompra(db, foundUser.id, undefined, false, "MODERADOR_GRANT");
      const nuevosSell = (foundUser.comprasRealizadas || 0) + 1;
      setFoundUser({ ...foundUser, comprasRealizadas: nuevosSell });
      toast({
        title: "✅ Sello otorgado",
        description: `+1 sello acreditado a ${foundUser.nombre || foundUser.correo}. Total: ${nuevosSell}`,
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo otorgar el sello." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = (cliente: Cliente) => {
    setDeleteConfirmUser(cliente);
  };

  const confirmDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    const cliente = deleteConfirmUser;
    setDeleteConfirmUser(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sin sesión activa");
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: cliente.id, idToken }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error);
      }
      setClientes((prev) => prev.filter((c) => c.id !== cliente.id));
      toast({ title: "Usuario eliminado", description: `${cliente.nombre} fue eliminado del sistema completo.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al eliminar", description: error.message || "No se pudo eliminar el usuario." });
    }
  };

  const markSugerenciaLeida = async (id: string) => {
    try {
      await updateDoc(doc(db, "sugerencias", id), { leida: true });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "No se pudo marcar la sugerencia." });
    }
  };

  // Detectar anomalías: usuarios con ≥ 2 sellos en los últimos logs
  const anomalies = useMemo(() => {
    const twelfveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
    const countByUser: Record<string, number> = {};
    recentTrans.forEach((log) => {
      const ts = log.fecha ? new Date(log.fecha).getTime() : 0;
      if (ts > twelfveHoursAgo && log.usuarioId) {
        countByUser[log.usuarioId] = (countByUser[log.usuarioId] || 0) + 1;
      }
    });
    return recentTrans
      .filter((log) => {
        if (!log.usuarioId) return false;
        const ts = log.fecha ? new Date(log.fecha).getTime() : 0;
        return ts > twelfveHoursAgo && (countByUser[log.usuarioId] || 0) >= 2;
      })
      .slice(0, 10);
  }, [recentTrans]);

  const npsStats = useMemo(() => {
    const respuestas = clientes.filter((c) => c.nps != null) as (Cliente & { nps: NonNullable<Cliente["nps"]> })[];
    respuestas.sort((a, b) => b.nps.fecha.localeCompare(a.nps.fecha));
    const total = respuestas.length;
    const promotores  = respuestas.filter((c) => c.nps.score >= 9).length;
    const detractores = respuestas.filter((c) => c.nps.score <= 6).length;
    const promedio = total > 0
      ? (respuestas.reduce((acc, c) => acc + c.nps.score, 0) / total).toFixed(1)
      : null;
    const npsScore = total > 0
      ? Math.round(((promotores - detractores) / total) * 100)
      : null;
    return { respuestas, total, promotores, detractores, promedio, npsScore };
  }, [clientes]);

  // --- Renderización Principal --- //

  if (loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Verificando seguridad...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 animate-in fade-in duration-500">
        <Alert variant="destructive" className="max-w-md w-full border-red-500/50 bg-white shadow-xl shadow-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <AlertTitle className="text-xl font-black text-red-700 ml-2">Acceso Denegado</AlertTitle>
          <AlertDescription className="text-sm text-slate-600 mt-2 ml-2 leading-relaxed font-medium">
            No tienes los permisos necesarios para acceder a este panel.
            <br/><br/>
            <span className="text-xs text-slate-400">Serás redirigido automáticamente a la página principal...</span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!pinVerified) {
    const isLocked = !!lockedUntil && Date.now() < lockedUntil;
    const remainingAttempts = MAX_PIN_ATTEMPTS - pinAttempts;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 animate-in fade-in duration-500">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-colors ${isLocked ? "bg-red-100" : "bg-primary/10"}`}>
              <ShieldCheck className={`w-8 h-8 transition-colors ${isLocked ? "text-red-500" : "text-primary"}`} />
            </div>
            <h1 className="text-xl font-black text-slate-800">Verificación de acceso</h1>
            <p className="text-xs text-slate-400 font-medium">Ingresa tu PIN personal para continuar</p>
          </div>

          <div className="bg-white rounded-3xl shadow-lg p-8 space-y-5">
            {isLocked ? (
              <div className="text-center space-y-3 py-2">
                <p className="text-5xl font-black text-red-500 tabular-nums">{lockdownSeconds}s</p>
                <p className="text-sm font-bold text-red-600">Acceso bloqueado temporalmente</p>
                <p className="text-xs text-slate-400">Demasiados intentos fallidos. Espera para volver a intentarlo.</p>
              </div>
            ) : (
              <>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                  className={`text-center text-2xl tracking-[0.5em] font-black h-14 rounded-2xl border-2 transition-colors ${pinAttempts > 0 ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                  autoFocus
                />
                {pinAttempts > 0 && (
                  <p className="text-xs text-red-500 font-bold text-center">
                    PIN incorrecto.{" "}
                    {remainingAttempts > 0
                      ? `${remainingAttempts} intento${remainingAttempts !== 1 ? "s" : ""} restante${remainingAttempts !== 1 ? "s" : ""}.`
                      : ""}
                  </p>
                )}
                <Button
                  onClick={handlePinSubmit}
                  disabled={pinInput.length < 4}
                  className="w-full h-12 rounded-2xl font-black text-base bg-primary hover:bg-primary/90"
                >
                  Ingresar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <main className="min-h-screen bg-slate-50/50 pb-20 p-6 md:p-12 font-sans animate-in slide-in-from-bottom-8 duration-500">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* ENCABEZADO */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Base de Datos de Clientes <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-primary hidden md:block" />
            </h1>
            <p className="text-slate-500 font-medium">Panel de administración global avanzado para Master Admin.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => { fetchClientes(); loadReferralStats(); fetchLiveData(true); }}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-2xl h-12 px-5 border-slate-200 text-slate-600 font-bold shadow-sm hover:bg-slate-100 transition-all whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Actualizando…" : "Actualizar"}
            </Button>
            <Link href="/moderador/sellos">
              <Button
                variant="outline"
                className="flex items-center gap-2 rounded-2xl h-12 px-5 border-primary/30 text-primary font-bold shadow-sm hover:bg-primary/5 hover:border-primary/60 transition-all whitespace-nowrap"
              >
                <BarChart2 className="w-4 h-4" />
                Registro de Sellos
              </Button>
            </Link>
          </div>
        </div>

        {/* NAVEGACIÓN RÁPIDA */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              href: "/moderador/sellos",
              emoji: "📊",
              titulo: "Registro de Sellos",
              desc: "Historial completo · Filtros · Exportar Excel",
              color: "#D3B673",
              bg: "#D3B67312",
            },
            {
              href: "/moderador/usuarios",
              emoji: "👥",
              titulo: "Directorio de Usuarios",
              desc: "Filtros de cumpleaños · Exportar lista",
              color: "#6366f1",
              bg: "#6366f112",
            },
            {
              href: "/admin-logs",
              emoji: "🔍",
              titulo: "Logs del Sistema",
              desc: "Eventos · Actividad en tiempo real",
              color: "#0ea5e9",
              bg: "#0ea5e912",
            },
            {
              href: "/moderador/auditoria",
              emoji: "📋",
              titulo: "Auditoría",
              desc: "Exportar datos completos · Excel",
              color: "#10b981",
              bg: "#10b98112",
            },
            {
              href: "/moderador/trafico",
              emoji: "📣",
              titulo: "Tráfico y Publicidad",
              desc: "Visitas por campaña · UTM · Fuentes",
              color: "#C9920A",
              bg: "#C9920A12",
            },
            {
              href: "/moderador/plantillas",
              emoji: "🔔",
              titulo: "Plantillas de Notificación",
              desc: "Repositorio · Filtros · Copiar al portapapeles",
              color: "#8b5cf6",
              bg: "#8b5cf612",
            },
          ].map(({ href, emoji, titulo, desc, color, bg }) => (
            <Link key={href} href={href}>
              <div
                className="rounded-3xl p-6 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5 group"
                style={{ backgroundColor: bg, border: `1.5px solid ${color}28` }}
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{emoji}</span>
                  <div className="min-w-0">
                    <p className="font-black text-slate-800 text-base group-hover:underline">{titulo}</p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{desc}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* METRICAS (TARJETAS SUPERIORES) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-none shadow-lg rounded-3xl bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full w-2 bg-primary" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-0.5">Total Socios</p>
                  {loadingData ? <Loader2 className="w-5 h-5 animate-spin text-slate-300 mt-1" /> : (
                    <p className="text-3xl font-black text-slate-800">{clientes.length}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg rounded-3xl bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full w-2 bg-violet-400" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-500 shrink-0">
                  <UserCog className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-0.5">Emprendedores</p>
                  {loadingData ? <Loader2 className="w-5 h-5 animate-spin text-slate-300 mt-1" /> : (
                    <p className="text-3xl font-black text-slate-800">
                      {clientes.filter(c => c.rol === "emprendedor").length}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg rounded-3xl bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full w-2 bg-emerald-400" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
                  <Share2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-0.5">Ref. Completados</p>
                  {loadingReferrals ? <Loader2 className="w-5 h-5 animate-spin text-slate-300 mt-1" /> : (
                    <p className="text-3xl font-black text-slate-800">{referralCompleted}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg rounded-3xl bg-white overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full w-2 bg-amber-400" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-0.5">Ref. Pendientes</p>
                  {loadingReferrals ? <Loader2 className="w-5 h-5 animate-spin text-slate-300 mt-1" /> : (
                    <p className="text-3xl font-black text-slate-800">{referralPending.length}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="border-none shadow-lg rounded-3xl bg-white overflow-hidden relative cursor-pointer hover:shadow-xl transition-all hover:-translate-y-0.5 group"
            onClick={() => { setShowPendingModal(true); fetchPendingStamps(); }}
          >
            <div className="absolute top-0 left-0 h-full w-2 bg-orange-400" />
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                  <Hourglass className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-0.5">Handshakes</p>
                  {loadingPending ? <Loader2 className="w-5 h-5 animate-spin text-slate-300 mt-1" /> : (
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-black text-slate-800">{pendingStamps.length}</p>
                      {pendingStamps.length > 0 && (
                        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Ver</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABLA DE CLIENTES */}
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-50/80 pb-6 pt-8 px-8 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Directorio de Usuarios
            </CardTitle>
            {!loadingData && (
               <div className="bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-lg">
                 Mostrando {clientes.length} resultados
               </div>
            )}
          </CardHeader>
          <div className="overflow-x-auto max-h-[500px]">
            {loadingData ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando datos desde la nube...</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/50 text-xs text-slate-400 uppercase font-black tracking-wider border-b-2 border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-8 py-5">Nombre Completo</th>
                    <th scope="col" className="px-8 py-5">Correo Electrónico</th>
                    <th scope="col" className="px-8 py-5">Teléfono</th>
                    <th scope="col" className="px-8 py-5">Nacimiento</th>
                    <th scope="col" className="px-8 py-5">Sellos</th>
                    <th scope="col" className="px-8 py-5">Rol</th>
                    {currentUserEmail === MASTER_EMAIL && (
                      <th scope="col" className="px-8 py-5">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientes.length > 0 ? (
                    clientes.map((cliente) => (
                      <tr key={cliente.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-8 py-5">
                          <span className="font-bold text-slate-800 group-hover:text-primary transition-colors">{cliente.nombre}</span>
                        </td>
                        <td className="px-8 py-5 text-slate-500 font-medium">{cliente.email}</td>
                        <td className="px-8 py-5 text-slate-500 font-medium">
                          {cliente.telefono.includes("Sin ") ? (
                            <span className="text-slate-300 italic">{cliente.telefono}</span>
                          ) : (
                            cliente.telefono
                          )}
                        </td>
                        <td className="px-8 py-5 text-slate-500 font-medium">
                          {cliente.fechaNacimiento === "N/A" ? (
                            <span className="text-slate-300 italic">—</span>
                          ) : (
                            cliente.fechaNacimiento
                          )}
                        </td>
                        <td className="px-8 py-5">
                          <span className="inline-flex items-center justify-center bg-primary/10 text-primary font-black px-3 py-1 rounded-full text-xs">
                            {cliente.sellos} sellos
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          {(() => {
                            const r = cliente.rol ?? "cliente";
                            const map: Record<string, { label: string; color: string; bg: string }> = {
                              emprendedor:    { label: "Emprendedor", color: "#7c3aed", bg: "#f5f3ff" },
                              director_patio: { label: "Director",    color: "#0ea5e9", bg: "#f0f9ff" },
                              moderador:      { label: "Moderador",   color: "#ef4444", bg: "#fef2f2" },
                              cliente:        { label: "Socio",       color: "#64748b", bg: "#f8fafc" },
                            };
                            const style = map[r] ?? map.cliente;
                            return (
                              <span
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide"
                                style={{ color: style.color, backgroundColor: style.bg }}
                              >
                                {style.label}
                              </span>
                            );
                          })()}
                        </td>
                        {currentUserEmail === MASTER_EMAIL && (
                          <td className="px-8 py-5">
                            <button
                              onClick={() => handleDeleteUser(cliente)}
                              title={`Eliminar a ${cliente.nombre}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all hover:scale-105 active:scale-95"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Eliminar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={currentUserEmail === MASTER_EMAIL ? 7 : 6} className="px-8 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <AlertTriangle className="w-8 h-8 text-slate-300" />
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay clientes registrados en la base de datos.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* PANELES DE HERRAMIENTAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t-2 border-slate-100 border-dashed mt-8">

          {/* T2. GESTION DE ROLES */}
          <Card className="border-none shadow-xl shadow-primary/5 rounded-3xl bg-white overflow-hidden outline outline-1 outline-primary/10">
            <div className="bg-primary/5 p-6 border-b border-primary/10 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-primary">
                <UserCog className="w-5 h-5" />
                <h3 className="font-bold text-lg">Gestión de Roles</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium line-clamp-2">Busca clientes y modifica sus accesos a la plataforma.</p>
            </div>
            <CardContent className="p-6 space-y-4 bg-slate-50/20">
              <form onSubmit={handleSearchUserForRole} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Buscar por correo o nombre..."
                    className="pl-9 bg-white border-slate-200 rounded-xl h-12 text-sm focus:ring-primary shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={loadingRole} className="rounded-xl h-12 px-4 shadow-sm font-bold bg-primary text-white">
                  {loadingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                </Button>
              </form>

              {foundUser && (
                <div className="mt-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 animate-in slide-in-from-top-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800 line-clamp-1">{foundUser.nombre}</p>
                    <p className="text-[10px] text-slate-500">{foundUser.correo}</p>
                    <Badge variant="outline" className="w-fit text-[9px] mt-1 uppercase font-black bg-slate-50">Rol actual: {foundUser.rol || 'cliente'}</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center mt-1">Nivel de Acceso</p>
                    <div className="flex gap-1.5 flex-col md:flex-row">
                      <Button
                        size="sm"
                        variant={foundUser.rol === 'cliente' ? 'default' : 'outline'}
                        className="flex-1 h-9 text-[10px] font-bold rounded-lg"
                        disabled={actionLoading}
                        onClick={() => updateUserRole('cliente')}
                      >Cliente</Button>
                      <Button
                        size="sm"
                        variant={foundUser.rol === 'emprendedor' ? 'default' : 'outline'}
                        className="flex-1 h-9 text-[10px] font-bold rounded-lg"
                        disabled={actionLoading}
                        onClick={() => updateUserRole('emprendedor')}
                      >Emprendedor</Button>
                      <Button
                        size="sm"
                        variant={foundUser.rol === 'director_patio' ? 'default' : 'outline'}
                        className="flex-1 h-9 text-[10px] font-bold rounded-lg"
                        disabled={actionLoading}
                        onClick={() => updateUserRole('director_patio')}
                      >Director Patio</Button>
                    </div>
                  </div>

                  {/* Otorgar sello de prueba */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center mb-2">Sellos</p>
                    <div className="flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2 border border-amber-100 mb-2">
                      <span className="text-xs font-bold text-amber-700">Sellos actuales</span>
                      <span className="text-sm font-black text-amber-700">{foundUser.comprasRealizadas ?? 0}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-10 text-[11px] font-bold rounded-xl text-amber-700 bg-amber-50/50 hover:bg-amber-100 border-amber-200 gap-2 shadow-sm"
                      disabled={actionLoading}
                      onClick={grantStampToFoundUser}
                    >
                      {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                      Otorgar Sello de Prueba
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* T3. DETECCION DE ANOMALIAS */}
          <Card className="border-none shadow-xl shadow-amber-500/10 rounded-3xl bg-white overflow-hidden outline outline-1 outline-amber-100">
            <div className="bg-amber-50/50 p-6 border-b border-amber-100/50 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-amber-600">
                  <Zap className="w-5 h-5" />
                  <h3 className="font-bold text-lg">Detección de Anomalías</h3>
                </div>
                {anomalies.length > 0 && (
                  <span className="text-[10px] font-black bg-amber-500 text-white px-2.5 py-1 rounded-full">
                    {anomalies.length} alerta{anomalies.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">Usuarios con ≥ 2 sellos en las últimas 12 h.</p>
            </div>
            <CardContent className="p-0 bg-slate-50/20 max-h-[300px] overflow-y-auto">
              <div className="divide-y divide-slate-100">
                {anomalies.length > 0 ? (
                  anomalies.map((log) => (
                    <div key={log.id} className="p-5 flex items-center justify-between hover:bg-amber-50/40 transition-colors cursor-default">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700">
                          <span className="text-amber-600">{log.usuario || "Usuario"}</span>{" "}
                          <span className="text-slate-400 font-normal">{log.accion || "acción"}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">
                          {log.fecha ? new Date(log.fecha).toLocaleString("es-CL") : "--"} · {log.metodo || "—"}
                        </p>
                      </div>
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-emerald-300" />
                    </div>
                    <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">Sin anomalías detectadas</p>
                    <p className="text-[10px] text-slate-400">Ningún usuario acumuló sellos inusualmente rápido.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {/* T7. SUGERENCIAS DE USUARIOS */}
          <Card className="border-none shadow-xl shadow-pink-500/10 rounded-3xl bg-white overflow-hidden outline outline-1 outline-pink-100 md:col-span-2">
            <div className="bg-pink-50/50 p-6 border-b border-pink-100/50 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-pink-600">
                  <MessageSquare className="w-5 h-5" />
                  <h3 className="font-bold text-lg">Sugerencias de Usuarios</h3>
                </div>
                <div className="flex items-center gap-2">
                  {sugerencias.filter(s => !s.leida).length > 0 && (
                    <span className="text-[10px] font-black bg-pink-500 text-white px-2.5 py-1 rounded-full">
                      {sugerencias.filter(s => !s.leida).length} nueva{sugerencias.filter(s => !s.leida).length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 font-medium">Feedback enviado por los socios desde la app.</p>
            </div>
            <CardContent className="p-0 bg-slate-50/20 max-h-[420px] overflow-y-auto">
              {loadingSugerencias ? (
                <div className="flex items-center justify-center py-10 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-pink-400" />
                  <p className="text-xs text-slate-400 font-bold">Cargando sugerencias...</p>
                </div>
              ) : sugerencias.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Sin sugerencias aún</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sugerencias.map((s) => {
                    const CATEGORIA_MAP: Record<string, { label: string; color: string; bg: string }> = {
                      mejora:   { label: "💡 Mejora",  color: "#d97706", bg: "#fef3c7" },
                      problema: { label: "🐛 Problema", color: "#dc2626", bg: "#fee2e2" },
                      otro:     { label: "💬 Otro",    color: "#6366f1", bg: "#ede9fe" },
                    };
                    const cat = CATEGORIA_MAP[s.categoria] ?? CATEGORIA_MAP.otro;
                    return (
                      <div
                        key={s.id}
                        className={`p-5 flex gap-4 transition-colors ${s.leida ? "opacity-60" : "bg-pink-50/30"}`}
                      >
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-700">{s.userName || "Anónimo"}</span>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ color: cat.color, backgroundColor: cat.bg }}
                            >
                              {cat.label}
                            </span>
                            {!s.leida && (
                              <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{s.texto}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {s.fecha ? new Date(s.fecha).toLocaleString("es-CL") : "—"}
                            {s.userEmail ? ` · ${s.userEmail}` : ""}
                          </p>
                        </div>
                        {!s.leida && (
                          <button
                            onClick={() => markSugerenciaLeida(s.id)}
                            title="Marcar como leída"
                            className="shrink-0 w-8 h-8 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 flex items-center justify-center transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {s.leida && (
                          <CheckCheck className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* NPS — CALIFICACIONES DE USUARIOS */}
          <Card className="border-none shadow-xl shadow-amber-500/10 rounded-3xl bg-white overflow-hidden outline outline-1 outline-amber-100 md:col-span-2">
            <div className="bg-amber-50/50 p-6 border-b border-amber-100/50 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-amber-600">
                  <Star className="w-5 h-5" />
                  <h3 className="font-bold text-lg">Calificaciones NPS</h3>
                </div>
                {npsStats.total > 0 && (
                  <span className="text-[10px] font-black bg-amber-500 text-white px-2.5 py-1 rounded-full">
                    {npsStats.total} respuesta{npsStats.total !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">¿Recomendarías el Club a un amigo? — escala del 0 al 10.</p>
              {npsStats.total > 0 && (
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 border border-amber-100 shadow-sm">
                    <span className="text-xs text-slate-400 font-semibold">NPS</span>
                    <span className={`text-lg font-black ${(npsStats.npsScore ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {npsStats.npsScore !== null ? (npsStats.npsScore >= 0 ? `+${npsStats.npsScore}` : npsStats.npsScore) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 border border-amber-100 shadow-sm">
                    <span className="text-xs text-slate-400 font-semibold">Promedio</span>
                    <span className="text-lg font-black text-amber-500">{npsStats.promedio ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 border border-emerald-100 shadow-sm">
                    <span className="text-xs text-slate-400 font-semibold">Promotores</span>
                    <span className="text-lg font-black text-emerald-500">{npsStats.promotores}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 border border-red-100 shadow-sm">
                    <span className="text-xs text-slate-400 font-semibold">Detractores</span>
                    <span className="text-lg font-black text-red-500">{npsStats.detractores}</span>
                  </div>
                </div>
              )}
            </div>
            <CardContent className="p-0 bg-slate-50/20 max-h-[420px] overflow-y-auto">
              {loadingData ? (
                <div className="flex items-center justify-center py-10 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <p className="text-xs text-slate-400 font-bold">Cargando calificaciones...</p>
                </div>
              ) : npsStats.total === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <Star className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Sin calificaciones aún</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {npsStats.respuestas.map((c) => {
                    const s = c.nps.score;
                    const color = s >= 9 ? "#22c55e" : s >= 7 ? "#eab308" : "#ef4444";
                    const label = s >= 9 ? "Promotor" : s >= 7 ? "Neutral" : "Detractor";
                    const labelBg = s >= 9 ? "#dcfce7" : s >= 7 ? "#fef9c3" : "#fee2e2";
                    return (
                      <div key={c.id} className="p-5 flex gap-4">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shrink-0"
                          style={{ background: color + "20", color }}
                        >
                          {s}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-700">{c.nombre}</span>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ color, backgroundColor: labelBg }}
                            >
                              {label}
                            </span>
                          </div>
                          {c.nps.comentario && (
                            <p className="text-sm text-slate-600 leading-relaxed">"{c.nps.comentario}"</p>
                          )}
                          <p className="text-[10px] text-slate-400 font-medium">
                            {c.nps.fecha ? new Date(c.nps.fecha).toLocaleString("es-CL") : "—"}
                            {c.email ? ` · ${c.email}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* T4. SELLO DE BIENVENIDA */}
          <Card className="border-none shadow-xl shadow-emerald-500/10 rounded-3xl bg-white overflow-hidden outline outline-1 outline-emerald-100 md:col-span-2">
            <div className="bg-emerald-50/50 p-6 border-b border-emerald-100/50 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-emerald-600">
                <Settings className="w-5 h-5" />
                <h3 className="font-bold text-lg">Sello de Bienvenida</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium">Configura el sello que recibe cada nuevo socio al registrarse sin link de referido.</p>
            </div>
            <CardContent className="p-6 space-y-5 bg-slate-50/20">
              {/* Toggle activo/inactivo */}
              <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 border border-slate-100 shadow-sm">
                <div>
                  <p className="text-sm font-bold text-slate-800">Estado</p>
                  <p className="text-xs text-slate-400 mt-0.5">{configBienvenida.activo ? "Los nuevos socios reciben el sello al registrarse" : "No se entrega sello al registrarse"}</p>
                </div>
                <button
                  onClick={() => setConfigBienvenida(c => ({ ...c, activo: !c.activo }))}
                  className="shrink-0 transition-transform active:scale-95"
                >
                  {configBienvenida.activo
                    ? <ToggleRight className="w-10 h-10 text-emerald-500" />
                    : <ToggleLeft className="w-10 h-10 text-slate-300" />}
                </button>
              </div>

              {/* Cantidad */}
              <div className={`bg-white rounded-2xl px-5 py-4 border border-slate-100 shadow-sm space-y-3 transition-opacity ${!configBienvenida.activo ? "opacity-40 pointer-events-none" : ""}`}>
                <p className="text-sm font-bold text-slate-800">Cantidad de sellos</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConfigBienvenida(c => ({ ...c, cantidad: Math.max(1, c.cantidad - 1) }))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-600 text-lg flex items-center justify-center transition-colors"
                  >−</button>
                  <span className="w-12 text-center text-2xl font-black text-slate-800">{configBienvenida.cantidad}</span>
                  <button
                    onClick={() => setConfigBienvenida(c => ({ ...c, cantidad: Math.min(10, c.cantidad + 1) }))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 font-black text-slate-600 text-lg flex items-center justify-center transition-colors"
                  >+</button>
                  <span className="text-xs text-slate-400 font-medium ml-1">máx. 10</span>
                </div>
              </div>

              <Button
                onClick={saveConfigBienvenida}
                disabled={savingConfig}
                className="w-full h-11 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
              >
                {savingConfig ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Settings className="w-4 h-4 mr-2" />}
                Guardar configuración
              </Button>
            </CardContent>
          </Card>

          {/* T6. PROGRAMA DE REFERIDOS */}
          <Card className="border-none shadow-xl shadow-violet-500/10 rounded-3xl bg-white overflow-hidden outline outline-1 outline-violet-100 md:col-span-2">
            <div className="bg-violet-50/50 p-6 border-b border-violet-100/50 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-violet-600">
                  <Share2 className="w-5 h-5" />
                  <h3 className="font-bold text-lg">Programa de Referidos</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadReferralStats}
                  disabled={loadingReferrals}
                  className="rounded-xl h-9 px-3 text-xs font-bold border-violet-200 text-violet-600 hover:bg-violet-50"
                >
                  {loadingReferrals ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500 font-medium">Referidos pendientes de activación y estadísticas del programa.</p>
            </div>
            <CardContent className="p-6 space-y-5 bg-slate-50/20">
              {/* Contadores */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-center">
                  <p className="text-3xl font-black text-amber-600">{referralPending.length}</p>
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mt-1">Esperando 1ª compra</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-center">
                  <p className="text-3xl font-black text-emerald-600">{referralCompleted}</p>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-1">Completados</p>
                </div>
              </div>

              {/* Lista de pendientes */}
              {loadingReferrals ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                  <p className="text-xs text-slate-400 font-bold">Cargando...</p>
                </div>
              ) : referralPending.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No hay referidos pendientes</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendientes (esperando 1ª compra real)</p>
                  {referralPending.map((r: any) => {
                    const fecha = r.creadoEn?.toDate ? r.creadoEn.toDate() : r.creadoEn ? new Date(r.creadoEn) : null;
                    const expira = r.expiresAt ? new Date(r.expiresAt) : null;
                    const diasRestantes = expira ? Math.ceil((expira.getTime() - Date.now()) / 86400000) : null;
                    return (
                      <div key={r.id} className="bg-white rounded-xl px-4 py-3 border border-slate-100 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">
                            <span className="text-violet-600">{r.referrerName || "—"}</span>
                            <span className="text-slate-400 font-normal"> refirió a </span>
                            {r.newUserName || "—"}
                          </p>
                          {fecha && (
                            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {fecha.toLocaleDateString("es-CL")}
                              {diasRestantes !== null && (
                                <span className={`ml-1 font-bold ${diasRestantes <= 10 ? "text-red-400" : "text-slate-400"}`}>
                                  · vence en {diasRestantes}d
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-600 px-2 py-1 rounded-full">
                          Pendiente
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* T5. RECÁLCULO SOCIOS CAPTADOS */}
          <Card className="border-none shadow-xl shadow-blue-500/10 rounded-3xl bg-white overflow-hidden outline outline-1 outline-blue-100 md:col-span-2">
            <div className="bg-blue-50/50 p-6 border-b border-blue-100/50 flex flex-col gap-2">
              <div className="flex items-center gap-3 text-blue-600">
                <Users className="w-5 h-5" />
                <h3 className="font-bold text-lg">Socios Captados por Emprendedor</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Recalcula el contador "Socios captados" de cada emprendedor leyendo los registros REFERIDO en system_logs.
                Ejecutar una vez para corregir datos históricos; de ahora en adelante se actualiza automáticamente.
              </p>
            </div>
            <CardContent className="p-6 space-y-4 bg-slate-50/20">
              <Button
                onClick={recalcularSociosCaptados}
                disabled={recalcSocios}
                className="w-full h-11 rounded-xl font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
              >
                {recalcSocios
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Recalculando...</>
                  : <><RefreshCw className="w-4 h-4 mr-2" />Recalcular Socios Captados</>
                }
              </Button>
              {recalcSociosResult && (
                <p className="text-xs text-slate-500 font-mono bg-slate-100 rounded-xl px-4 py-3 break-all">
                  {recalcSociosResult}
                </p>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

    </main>

    {/* Modal de transacciones pendientes */}
    {showPendingModal && (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-6"
        onClick={() => setShowPendingModal(false)}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                <Hourglass className="w-5 h-5" />
              </div>
              <div>
                <p className="font-black text-slate-800 text-lg leading-tight">Handshakes Pendientes</p>
                <p className="text-xs text-slate-400 font-medium">Transacciones a la espera de confirmación del emprendedor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchPendingStamps()}
                disabled={loadingPending}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPending ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setShowPendingModal(false)}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-7 py-5">
            {loadingPending ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Consultando...</p>
              </div>
            ) : pendingStamps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                  <CheckCheck className="w-7 h-7" />
                </div>
                <p className="font-black text-slate-700 text-base">Todo al día</p>
                <p className="text-sm text-slate-400">No hay transacciones pendientes en este momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingStamps.map((stamp) => {
                  const now = Date.now();
                  const createdMs = stamp.createdAt ?? now;
                  const elapsedSec = Math.floor((now - createdMs) / 1000);
                  const remainingSec = Math.max(0, 300 - elapsedSec);
                  const isExpiring = remainingSec < 60;
                  const elapsedLabel = elapsedSec < 60
                    ? `hace ${elapsedSec}s`
                    : `hace ${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
                  const remainingLabel = remainingSec > 0
                    ? `${Math.floor(remainingSec / 60)}m ${remainingSec % 60}s restantes`
                    : "Expirado";

                  const isVendorProcessing = stamp.status === "vendor_processing";

                  return (
                    <div
                      key={stamp.id}
                      className={`rounded-2xl border p-4 flex flex-col gap-3 ${
                        isExpiring
                          ? "border-red-200 bg-red-50/50"
                          : isVendorProcessing
                          ? "border-blue-200 bg-blue-50/50"
                          : "border-slate-100 bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isVendorProcessing ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                          }`}>
                            {isVendorProcessing
                              ? <Store className="w-4 h-4" />
                              : <Users className="w-4 h-4" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-800 text-sm truncate">{stamp.userName}</p>
                            <p className="text-xs text-slate-400 font-medium truncate">
                              {stamp.vendorName ? `Local: ${stamp.vendorName}` : "Vendedor sin nombre"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border-0 ${
                              isVendorProcessing
                                ? "bg-blue-100 text-blue-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {isVendorProcessing ? "En proceso" : "Esperando"}
                          </Badge>
                          {stamp.monto != null && (
                            <span className="text-xs font-black text-slate-700">
                              ${stamp.monto.toLocaleString("es-CL")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-slate-400">{elapsedLabel}</span>
                        <div className="flex items-center gap-1.5">
                          <ArrowRight className={`w-3 h-3 ${isExpiring ? "text-red-400" : "text-slate-300"}`} />
                          <span className={isExpiring ? "text-red-500 font-black" : "text-slate-400"}>
                            {remainingLabel}
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isExpiring ? "bg-red-400" : isVendorProcessing ? "bg-blue-400" : "bg-orange-400"
                          }`}
                          style={{ width: `${Math.min(100, (remainingSec / 300) * 100)}%` }}
                        />
                      </div>

                      <p className="text-[10px] text-slate-400 font-medium">
                        {stamp.initiatedBy === "vendor"
                          ? "Iniciado por emprendedor (escaneó QR del socio)"
                          : "Iniciado por socio (escaneó QR del local)"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loadingPending && pendingStamps.length > 0 && (
            <div className="px-7 py-4 border-t border-slate-100 shrink-0">
              <p className="text-xs text-slate-400 font-medium text-center">
                {pendingStamps.length} transacci{pendingStamps.length === 1 ? "ón" : "ones"} activa{pendingStamps.length !== 1 ? "s" : ""} · Los handshakes expiran a los 5 minutos
              </p>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Modal de confirmación de eliminación */}
    {deleteConfirmUser && (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-6"
        onClick={() => setDeleteConfirmUser(null)}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full space-y-5 animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 text-red-600">
            <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black text-slate-800 text-base">Eliminar usuario</p>
              <p className="text-xs text-slate-400 font-medium">Esta acción no se puede deshacer</p>
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
            <p className="text-sm font-bold text-slate-800">{deleteConfirmUser.nombre}</p>
            <p className="text-xs text-slate-400">{deleteConfirmUser.email}</p>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Se eliminarán sus datos de Firestore <strong>y</strong> su acceso de inicio de sesión de forma permanente.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirmUser(null)}
              className="flex-1 h-11 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDeleteUser}
              className="flex-1 h-11 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-black transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
