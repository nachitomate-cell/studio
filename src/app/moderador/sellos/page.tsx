"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  collection, onSnapshot, query, orderBy, limit, getDocs, getDoc, doc, where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ref as storageRef, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import {
  Loader2, ChevronLeft, Download, Search, BarChart2,
  TrendingUp, Store, Star, Stamp, Gift, Undo2,
  Trophy, X, RefreshCw, ShoppingBag, Repeat2, Receipt, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";


import { ADMIN_EMAIL as MASTER_EMAIL } from "@/lib/constants";
const PAGE_SIZE = 20;

// Nombres genéricos que indican que el registro no tiene nombre real
const GENERIC_NAMES = new Set(["miembro del club", "miembro", "desconocido", ""]);

interface LogEntry {
  id: string;
  usuario: string;
  usuarioId: string;
  vendedorId: string;
  accion: string;
  fecha: string;
  tipo: string;
  metodo?: string;
  monto?: number;
  numSellos?: number;
  anulada?: boolean;
  boletaPath?: string;
  usuarioResuelto?: string;
}

interface VendorInfo {
  id: string;
  nombre: string;
}

function formatFecha(fecha: string): { fecha: string; hora: string } {
  try {
    const d = new Date(fecha);
    return {
      fecha: d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }),
      hora: d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
    };
  } catch {
    return { fecha, hora: "" };
  }
}

function formatFechaCompleta(fecha: string): string {
  const { fecha: f, hora: h } = formatFecha(fecha);
  return `${f} · ${h}`;
}

function formatMonto(monto?: number): string {
  if (!monto || monto === 0) return "No registrado";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(monto);
}

function MontoCell({ monto, metodo }: { monto?: number; metodo?: string }) {
  if (monto && monto > 0) {
    return (
      <span className="font-medium text-slate-700">
        {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(monto)}
      </span>
    );
  }
  // Sellos del sistema: no hay compra asociada
  if (metodo === "BIENVENIDA" || metodo === "SISTEMA" || metodo === "REFERIDO" || metodo === "PERFIL_COMPLETO") {
    return <span className="text-slate-300 font-medium">—</span>;
  }
  // VENDOR_SCAN: emprendedor escaneó al cliente manualmente sin ingresar monto
  if (metodo === "VENDOR_SCAN") {
    return (
      <span className="text-amber-600 text-xs font-medium" title="El emprendedor usó el escáner manual y no ingresó monto de boleta">
        Sin monto · escáner manual
      </span>
    );
  }
  // HANDSHAKE / CLIENT_SCAN / otros: el emprendedor confirmó en caja sin ingresar monto
  return (
    <span className="text-amber-600 text-xs font-medium" title="El emprendedor confirmó el sello en el Panel de Validación sin ingresar el monto de la boleta">
      Sin monto · no ingresado en caja
    </span>
  );
}

function EstadoBadge({ tipo }: { tipo: string }) {
  if (tipo === "FIDELIZACION") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
        Confirmado
      </span>
    );
  }
  if (tipo === "SELLO_RECHAZADO") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
        Rechazado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
      Expirado
    </span>
  );
}

// Etiqueta del local / método — reutilizada en tabla (desktop) y tarjetas (móvil)
function LocalLabel({ log, vendors }: { log: LogEntry; vendors: Record<string, string> }) {
  if (log.metodo === "BIENVENIDA")
    return <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-full">🎁 Sello de Bienvenida</span>;
  if (log.metodo === "SISTEMA")
    return <span className="inline-flex items-center gap-1 text-blue-600 font-bold text-xs bg-blue-50 px-2 py-1 rounded-full">⚡ Bono de Login</span>;
  if (log.metodo === "REFERIDO")
    return <span className="inline-flex items-center gap-1 text-violet-600 font-bold text-xs bg-violet-50 px-2 py-1 rounded-full">🔗 Registro Referido · {vendors[log.vendedorId] || log.vendedorId || "—"}</span>;
  if (log.metodo === "PERFIL_COMPLETO")
    return <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-xs bg-amber-50 px-2 py-1 rounded-full">✅ Perfil Completado</span>;
  return <>{vendors[log.vendedorId] || log.vendedorId || "—"}</>;
}

function SellosBadge({ log }: { log: LogEntry }) {
  const n = log.numSellos ?? 1;
  if (log.anulada) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-400 line-through">
        -{n} {n === 1 ? "sello" : "sellos"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
      +{n} {n === 1 ? "sello" : "sellos"}
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color = "#D3B673",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <Card className="border-none shadow-md rounded-2xl md:rounded-3xl bg-white">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-3 md:gap-4">
          <div
            className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}18`, color }}
          >
            <Icon className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5 md:mb-1 leading-tight">
              {label}
            </p>
            <p className="text-base md:text-xl font-black text-slate-800 truncate leading-tight">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ModeradorSellosPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [vendors, setVendors] = useState<Record<string, string>>({});
  const [vendorList, setVendorList] = useState<VendorInfo[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // Boletas (Fase 5: auditoría). Map logId → URL resuelta de Storage (staff).
  const [boletaUrls, setBoletaUrls] = useState<Record<string, string>>({});
  const [boletaModal, setBoletaModal] = useState<string | null>(null);

  // Cache de nombres resueltos por userId
  const nameCache = useRef<Record<string, string>>({});

  // Filtros
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  // Filtra por tipo de comercio: "" todos · "asociado" solo comercios asociados (boleta auto-servicio)
  // · "emprendedor" solo emprendedores (handshake/vendor-scan/cliente-scan).
  const [tipoComercioFilter, setTipoComercioFilter] = useState("");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);

  // Conteo preciso por vendor (sin limit, sin anulados) cuando hay filtro activo
  const [vendorAccurateCount, setVendorAccurateCount] = useState<number | null>(null);

  // Modal stats por local
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsLocales, setStatsLocales] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState({
    totalSellos: 0,
    totalVentas: 0,
    localActivo: "",
    localActivoId: "",
    clienteFrecuente: "",
  });

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthLoading(false);
        router.replace("/");
        return;
      }

      if (user.email === MASTER_EMAIL) {
        setAuthorized(true);
        setAuthLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if (snap.exists()) {
          const rol = snap.data().rol as string;
          if (["moderador", "admin", "director", "director_patio"].includes(rol)) {
            setAuthorized(true);
          } else {
            router.replace("/");
          }
        } else {
          router.replace("/");
        }
      } catch {
        router.replace("/");
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Cargar vendedores para el dropdown ─────────────────────────────────────
  useEffect(() => {
    if (!authorized) return;
    Promise.all([
      getDocs(collection(db, "entrepreneur_profiles")),
      getDocs(query(collection(db, "usuarios"), where("rol", "==", "emprendedor"))),
    ])
      .then(([profilesSnap, usuariosSnap]) => {
        const list: VendorInfo[] = [];
        const map: Record<string, string> = {};
        profilesSnap.forEach((d) => {
          const data = d.data();
          const nombre = data.businessName || data.nombre || d.id;
          list.push({ id: d.id, nombre });
          map[d.id] = nombre;
        });
        // Emprendedores sin perfil en entrepreneur_profiles
        usuariosSnap.forEach((d) => {
          if (map[d.id]) return;
          const data = d.data();
          const nombre = data.nombreTienda || data.businessName || data.nombre || d.id;
          list.push({ id: d.id, nombre });
          map[d.id] = nombre;
        });
        setVendorList(list.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setVendors(map);
      })
      .catch(() => {});
  }, [authorized]);

  // ── Resolver nombre de usuario si es genérico ──────────────────────────────
  const resolveUserName = async (entry: LogEntry): Promise<string> => {
    const raw = entry.usuario || "";
    if (!GENERIC_NAMES.has(raw.toLowerCase())) return raw;

    const uid = entry.usuarioId;
    if (!uid) return `Usuario #${raw.slice(-4) || "???"}`;

    if (nameCache.current[uid]) return nameCache.current[uid];

    try {
      const snap = await getDoc(doc(db, "usuarios", uid));
      if (snap.exists()) {
        const nombre = snap.data().nombre || snap.data().correo;
        if (nombre) {
          nameCache.current[uid] = nombre;
          return nombre;
        }
      }
    } catch { /* silencioso */ }

    const fallback = `Usuario #${uid.slice(-4)}`;
    nameCache.current[uid] = fallback;
    return fallback;
  };

  // ── Suscripción en tiempo real a system_logs ───────────────────────────────
  useEffect(() => {
    if (!authorized) return;
    setLogsLoading(true);

    const q = query(
      collection(db, "system_logs"),
      orderBy("fecha", "desc"),
      limit(500)
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const rawData: LogEntry[] = snap.docs
          .map((d) => ({
            id: d.id,
            usuario: d.data().usuario || "",
            usuarioId: d.data().usuarioId || "",
            vendedorId: d.data().vendedorId || "",
            accion: d.data().accion || "",
            fecha: d.data().fecha || "",
            tipo: d.data().tipo || "",
            metodo: d.data().metodo,
            monto: d.data().monto,
            numSellos: d.data().numSellos,
            anulada: d.data().anulada === true,
            boletaPath: d.data().boletaPath || undefined,
          }))
          .filter((l) => l.tipo === "FIDELIZACION" || l.tipo === "SELLO_RECHAZADO");

        // Resolver nombres genéricos en paralelo
        const resolved = await Promise.all(
          rawData.map(async (entry) => ({
            ...entry,
            usuarioResuelto: await resolveUserName(entry),
          }))
        );

        setLogs(resolved);
        computeKpis(resolved);
        setLogsLoading(false);
      },
      (err) => {
        console.error("[RegistroSellos] onSnapshot error:", err);
        setLogsLoading(false);
      }
    );

    return () => unsub();
  }, [authorized]);

  // ── Resolver URLs de boletas (solo staff puede leerlas en Storage) ──────────
  useEffect(() => {
    const pendientes = logs.filter(
      (l) => l.metodo === "CLIENT_BOLETA" && l.boletaPath && !boletaUrls[l.id]
    );
    if (pendientes.length === 0) return;
    let cancelado = false;
    (async () => {
      const entradas = await Promise.all(
        pendientes.map(async (l) => {
          try {
            const url = await getDownloadURL(storageRef(storage, l.boletaPath!));
            return [l.id, url] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelado) return;
      setBoletaUrls((prev) => {
        const next = { ...prev };
        entradas.forEach((e) => { if (e) next[e[0]] = e[1]; });
        return next;
      });
    })();
    return () => { cancelado = true; };
  }, [logs, boletaUrls]);

  // ── Conteo preciso por vendor (onSnapshot sin limit, excluye anulados) ───────
  useEffect(() => {
    if (!authorized || !vendorFilter) {
      setVendorAccurateCount(null);
      return;
    }
    const unsub = onSnapshot(
      query(
        collection(db, "system_logs"),
        where("vendedorId", "==", vendorFilter),
        where("tipo", "==", "FIDELIZACION")
      ),
      (snap) => {
        const total = snap.docs.reduce((sum, d) => {
          const data = d.data();
          if (data.anulada) return sum;
          return sum + (data.numSellos ?? 1);
        }, 0);
        setVendorAccurateCount(total);
      },
      () => { setVendorAccurateCount(null); }
    );
    return () => unsub();
  }, [authorized, vendorFilter]);

  // ── Calcular KPIs del mes actual ───────────────────────────────────────────
  function computeKpis(data: LogEntry[]) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const thisMonth = data.filter(
      (l) => l.tipo === "FIDELIZACION" && l.fecha >= startOfMonth && !l.anulada
    );

    const totalSellos = thisMonth.reduce((sum, l) => sum + (l.numSellos ?? 1), 0);
    const totalVentas = thisMonth.reduce((sum, l) => sum + (l.monto || 0), 0);

    const byVendor: Record<string, number> = {};
    thisMonth.forEach((l) => {
      if (l.vendedorId) byVendor[l.vendedorId] = (byVendor[l.vendedorId] || 0) + 1;
    });
    const topVendorEntry = Object.entries(byVendor).sort((a, b) => b[1] - a[1])[0];
    const localActivoId = topVendorEntry?.[0] || "";

    const byClient: Record<string, { count: number; nombre: string }> = {};
    thisMonth.forEach((l) => {
      if (l.usuarioId) {
        const nombre = l.usuarioResuelto || l.usuario;
        if (!byClient[l.usuarioId]) byClient[l.usuarioId] = { count: 0, nombre };
        byClient[l.usuarioId].count++;
      }
    });
    const topClient = Object.entries(byClient).sort((a, b) => b[1].count - a[1].count)[0];

    setKpis({
      totalSellos,
      totalVentas,
      localActivo: "",
      localActivoId,
      clienteFrecuente: topClient?.[1].nombre || "—",
    });
  }

  // ── Filtrado y paginación (client-side) ────────────────────────────────────
  const filtered = logs.filter((l) => {
    if (desde && l.fecha < desde) return false;
    if (hasta && l.fecha > hasta + "T23:59:59") return false;
    if (vendorFilter && l.vendedorId !== vendorFilter) return false;
    if (estadoFilter) {
      if (estadoFilter === "confirmado" && l.tipo !== "FIDELIZACION") return false;
      if (estadoFilter === "rechazado" && l.tipo !== "SELLO_RECHAZADO") return false;
      if (estadoFilter === "expirado" && l.tipo === "FIDELIZACION") return false;
    }
    if (tipoComercioFilter === "asociado" && l.metodo !== "CLIENT_BOLETA") return false;
    if (tipoComercioFilter === "emprendedor" && l.metodo === "CLIENT_BOLETA") return false;
    const nombre = (l.usuarioResuelto || l.usuario).toLowerCase();
    if (clienteFilter && !nombre.includes(clienteFilter.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // ── Stats por local ────────────────────────────────────────────────────────
  const fetchStatsLocales = async () => {
    setLoadingStats(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sin sesión");
      const res = await fetch("/api/admin/stats-locales", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { locales } = await res.json();
      setStatsLocales(locales ?? []);
    } catch {
      setStatsLocales([]);
    } finally {
      setLoadingStats(false);
    }
  };

  // ── Exportar Excel ─────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const hoy = new Date().toISOString().slice(0, 10);
    const rows = filtered.map((l) => {
      const dt = formatFecha(l.fecha);
      const estado =
        l.tipo === "FIDELIZACION" ? "Confirmado" :
        l.tipo === "SELLO_RECHAZADO" ? "Rechazado" : "Expirado";
      return {
        Fecha: dt.fecha,
        Hora: dt.hora,
        Cliente: l.usuarioResuelto || l.usuario,
        "RUT/Tel": l.usuarioId,
        Local: l.metodo === "BIENVENIDA" ? "Sello de Bienvenida" : l.metodo === "SISTEMA" ? "Bono de Login" : l.metodo === "REFERIDO" ? `Registro Referido · ${vendors[l.vendedorId] || l.vendedorId || "—"}` : l.metodo === "PERFIL_COMPLETO" ? "Perfil Completado" : vendors[l.vendedorId] || l.vendedorId || "—",
        Monto: l.monto && l.monto > 0 ? l.monto : 0,
        Sellos: `+${l.numSellos ?? 1}`,
        Estado: estado,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    // Ancho de columnas
    ws["!cols"] = [
      { wch: 18 }, { wch: 8 }, { wch: 28 }, { wch: 20 },
      { wch: 24 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sellos");
    XLSX.writeFile(wb, `sellos_patiocurauma_${hoy}.xlsx`);
  };

  // ── Limpieza masiva de boletas antiguas ─────────────────────────────────────
  const [limpiando, setLimpiando] = useState(false);

  const handleLimpiarBoletas = async () => {
    if (!confirm("¿Borrar las fotos de boletas con más de 90 días?\n\nSe conserva el registro de auditoría en el historial; solo se libera el almacenamiento de las imágenes. Esta acción no se puede deshacer.")) return;
    setLimpiando(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Sin sesión activa");
      const res = await fetch("/api/admin/limpiar-boletas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ olderThanDays: 90 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      alert(`Limpieza completa: ${data.borradas} boleta(s) eliminada(s) de ${data.encontradas} con más de ${data.olderThanDays} días.`);
    } catch (e: any) {
      alert("Error al limpiar boletas: " + e.message);
    } finally {
      setLimpiando(false);
    }
  };

  // ── Anular Sello ───────────────────────────────────────────────────────────
  const [anulandoId, setAnulandoId] = useState<string | null>(null);

  const handleAnularSello = async (log: LogEntry) => {
    const n = log.numSellos ?? 1;
    if (!confirm(`¿Anular ${n} ${n === 1 ? "sello" : "sellos"} de "${log.usuarioResuelto || log.usuario}" del ${formatFechaCompleta(log.fecha)}?\n\nEsto restará ${n} ${n === 1 ? "sello" : "sellos"} al cliente, actualizará Google Wallet y eliminará la boleta si existe. Esta acción queda registrada en auditoría.`)) return;

    setAnulandoId(log.id);
    const boletaPath = log.boletaPath; // capturar antes de que el log se actualice
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Sin sesión activa");
      const token = await currentUser.getIdToken();

      const res = await fetch("/api/admin/anular-sello", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ logId: log.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");

      // Eliminar la foto de la boleta de Storage (staff puede borrar). Best-effort.
      if (boletaPath) {
        deleteObject(storageRef(storage, boletaPath)).catch(() => {/* ya no existe o sin permiso */});
        setBoletaUrls((prev) => { const next = { ...prev }; delete next[log.id]; return next; });
      }
      // El onSnapshot actualizará el resto del estado automáticamente
    } catch (err: any) {
      alert(`Error al anular sello: ${err.message}`);
    } finally {
      setAnulandoId(null);
    }
  };

  const resetFiltros = () => {
    setDesde("");
    setHasta("");
    setVendorFilter("");
    setClienteFilter("");
    setEstadoFilter("");
    setTipoComercioFilter("");
    setCurrentPage(1);
  };

  const hayFiltros = desde || hasta || vendorFilter || clienteFilter || estadoFilter || tipoComercioFilter;

  // ── Render: loading / no autorizado ───────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
      </div>
    );
  }

  if (!authorized) return null;

  const localActivoNombre = kpis.localActivoId
    ? vendors[kpis.localActivoId] || kpis.localActivoId
    : "—";

  const totalVentasFormatted =
    kpis.totalVentas > 0
      ? new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(
          kpis.totalVentas
        )
      : "$0";

  // ── Render principal ────────────────────────────────────────────────────────
  return (
    <>
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header sticky */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          {/* Fila título */}
          <div className="flex items-center gap-3">
            <Link href="/moderador">
              <button className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0">
                <ChevronLeft className="w-5 h-5" />
              </button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Registro de Sellos
              </h1>
              <p className="text-xs md:text-sm text-slate-400 font-medium truncate">
                Historial completo de transacciones
              </p>
            </div>
          </div>

          {/* Fila acciones — scroll horizontal en móvil */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
            <Link href="/moderador/canjes" className="shrink-0">
              <Button
                variant="outline"
                className="rounded-2xl h-9 md:h-10 px-3 md:px-4 gap-1.5 md:gap-2 font-bold text-xs md:text-sm border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap"
              >
                <Gift className="w-4 h-4" />
                Ver Canjes
              </Button>
            </Link>
            <Button
              onClick={() => { setShowStatsModal(true); fetchStatsLocales(); }}
              variant="outline"
              className="shrink-0 rounded-2xl h-9 md:h-10 px-3 md:px-4 gap-1.5 md:gap-2 font-bold text-xs md:text-sm border-amber-200 text-amber-600 hover:border-amber-400 hover:bg-amber-50 transition-all whitespace-nowrap"
            >
              <Trophy className="w-4 h-4" />
              Top Clientes
            </Button>
            <Button
              onClick={exportExcel}
              variant="outline"
              className="shrink-0 rounded-2xl h-9 md:h-10 px-3 md:px-4 gap-1.5 md:gap-2 font-bold text-xs md:text-sm border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span className="md:hidden">Excel</span>
              <span className="hidden md:inline">Exportar Excel</span>
            </Button>
            <Button
              onClick={handleLimpiarBoletas}
              disabled={limpiando}
              variant="outline"
              title="Borrar fotos de boletas con más de 90 días (conserva el registro)"
              className="shrink-0 rounded-2xl h-9 md:h-10 px-3 md:px-4 gap-1.5 md:gap-2 font-bold text-xs md:text-sm border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-500 transition-all whitespace-nowrap"
            >
              {limpiando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span className="hidden md:inline">Limpiar boletas</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-8 space-y-5 md:space-y-8">

        {/* ── KPI Cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <KpiCard
            label="Sellos este mes"
            value={kpis.totalSellos}
            icon={Stamp}
            color="#D3B673"
          />
          <KpiCard
            label="Ventas registradas"
            value={totalVentasFormatted}
            icon={TrendingUp}
            color="#10b981"
          />
          <KpiCard
            label="Local más activo"
            value={localActivoNombre}
            icon={Store}
            color="#6366f1"
          />
          <KpiCard
            label="Cliente frecuente"
            value={kpis.clienteFrecuente}
            icon={Star}
            color="#f59e0b"
          />
        </div>

        {/* ── Filtros ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Desde
            </label>
            <input
              type="date"
              value={desde}
              onChange={(e) => { setDesde(e.target.value); setCurrentPage(1); }}
              className="h-11 md:h-10 w-full px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Hasta
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => { setHasta(e.target.value); setCurrentPage(1); }}
              className="h-11 md:h-10 w-full px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1 col-span-2 md:col-auto">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Local / Vendedor
            </label>
            <select
              value={vendorFilter}
              onChange={(e) => { setVendorFilter(e.target.value); setCurrentPage(1); }}
              className="h-11 md:h-10 w-full px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">Todos los locales</option>
              {vendorList.map((v) => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2 md:col-auto">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Estado
            </label>
            <select
              value={estadoFilter}
              onChange={(e) => { setEstadoFilter(e.target.value); setCurrentPage(1); }}
              className="h-11 md:h-10 w-full px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">Todos</option>
              <option value="confirmado">Confirmado</option>
              <option value="rechazado">Rechazado</option>
              <option value="expirado">Expirado</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2 md:col-auto">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Tipo de comercio
            </label>
            <select
              value={tipoComercioFilter}
              onChange={(e) => { setTipoComercioFilter(e.target.value); setCurrentPage(1); }}
              className="h-11 md:h-10 w-full px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">Todos</option>
              <option value="asociado">Comercios asociados (con boleta)</option>
              <option value="emprendedor">Emprendedores (QR / handshake)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2 md:flex-1 md:min-w-[180px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Buscar cliente
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Nombre del cliente..."
                value={clienteFilter}
                onChange={(e) => { setClienteFilter(e.target.value); setCurrentPage(1); }}
                className="pl-9 h-11 md:h-10 rounded-xl border-slate-200 text-sm font-medium"
              />
            </div>
          </div>
          {hayFiltros && (
            <Button
              variant="ghost"
              onClick={resetFiltros}
              className="col-span-2 md:col-auto h-10 text-slate-400 hover:text-slate-600 text-xs font-bold rounded-xl"
            >
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* ── Tabla ─────────────────────────────────────────────────────── */}
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
          {logsLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Cargando registros en tiempo real...
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 md:px-6 py-3.5 md:py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <p className="text-xs md:text-sm font-bold text-slate-500 min-w-0">
                  {vendorAccurateCount !== null
                    ? <>{vendorAccurateCount} {vendorAccurateCount === 1 ? "sello" : "sellos"} <span className="text-slate-300 font-medium hidden sm:inline">(sin anulados · total histórico)</span></>
                    : <>{filtered.length}{" "}{filtered.length === 1 ? "registro" : "registros"}<span className="hidden sm:inline">{hayFiltros ? " con filtros aplicados" : " en total"}</span></>
                  }
                </p>
                <div className="flex items-center gap-2 text-[11px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 md:px-3 py-1.5 rounded-full shrink-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Tiempo real
                </div>
              </div>

              {/* ── Vista MÓVIL: tarjetas ─────────────────────────────────── */}
              <div className="md:hidden divide-y divide-slate-100">
                {paginated.length === 0 ? (
                  <div className="px-4 py-16 text-center text-slate-300 font-bold text-sm">
                    Sin registros para los filtros seleccionados
                  </div>
                ) : (
                  paginated.map((log) => (
                    <div key={log.id} className={`px-4 py-3.5 ${log.anulada ? "opacity-50" : ""}`}>
                      {/* Fila 1: cliente + estado */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-slate-800 text-sm truncate">
                            {log.usuarioResuelto || log.usuario || "—"}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {formatFechaCompleta(log.fecha)}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {log.anulada ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-600">
                              Anulado
                            </span>
                          ) : (
                            <EstadoBadge tipo={log.tipo} />
                          )}
                        </div>
                      </div>

                      {/* Fila 2: local */}
                      <div className="mt-2 text-sm text-slate-500 font-medium flex items-center gap-2">
                        <span className="truncate"><LocalLabel log={log} vendors={vendors} /></span>
                        {log.metodo === "CLIENT_BOLETA" && boletaUrls[log.id] && (
                          <button
                            onClick={() => setBoletaModal(boletaUrls[log.id])}
                            title="Ver boleta"
                            className="shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-slate-200"
                          >
                            <img src={boletaUrls[log.id]} alt="boleta" className="w-full h-full object-cover" />
                          </button>
                        )}
                      </div>

                      {/* Fila 3: sellos + monto + acción */}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <SellosBadge log={log} />
                          <span className="text-xs truncate">
                            <MontoCell monto={log.monto} metodo={log.metodo} />
                          </span>
                        </div>
                        {log.tipo === "FIDELIZACION" && !log.anulada && (
                          <button
                            onClick={() => handleAnularSello(log)}
                            disabled={anulandoId === log.id}
                            title="Anular sello"
                            className="shrink-0 h-9 px-3 rounded-xl flex items-center gap-1.5 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-40 text-xs font-bold"
                          >
                            {anulandoId === log.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <><Undo2 className="w-4 h-4" /> Anular</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* ── Vista ESCRITORIO: tabla ───────────────────────────────── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs text-slate-400 uppercase font-black tracking-wider border-b-2 border-slate-100 sticky top-0">
                    <tr>
                      <th className="px-6 py-4">Fecha y hora</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Local</th>
                      <th className="px-6 py-4">Sellos</th>
                      <th className="px-6 py-4">Monto</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-20 text-center text-slate-300 font-bold"
                        >
                          Sin registros para los filtros seleccionados
                        </td>
                      </tr>
                    ) : (
                      paginated.map((log) => (
                        <tr
                          key={log.id}
                          className={`hover:bg-slate-50/80 transition-colors group ${log.anulada ? "opacity-50" : ""}`}
                        >
                          <td className="px-6 py-4 text-slate-400 font-medium whitespace-nowrap text-xs">
                            {formatFechaCompleta(log.fecha)}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800">
                            {log.usuarioResuelto || log.usuario || "—"}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-medium">
                            <div className="flex items-center gap-2">
                              <LocalLabel log={log} vendors={vendors} />
                              {log.metodo === "CLIENT_BOLETA" && boletaUrls[log.id] && (
                                <button
                                  onClick={() => setBoletaModal(boletaUrls[log.id])}
                                  title="Ver boleta"
                                  className="shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-primary/40 transition"
                                >
                                  <img src={boletaUrls[log.id]} alt="boleta" className="w-full h-full object-cover" />
                                </button>
                              )}
                              {log.metodo === "CLIENT_BOLETA" && !boletaUrls[log.id] && !log.anulada && (
                                <Receipt className="w-4 h-4 text-slate-300 shrink-0" />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <SellosBadge log={log} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <MontoCell monto={log.monto} metodo={log.metodo} />
                          </td>
                          <td className="px-6 py-4">
                            {log.anulada ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-600">
                                Anulado
                              </span>
                            ) : (
                              <EstadoBadge tipo={log.tipo} />
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {log.tipo === "FIDELIZACION" && !log.anulada && (
                              <button
                                onClick={() => handleAnularSello(log)}
                                disabled={anulandoId === log.id}
                                title="Anular sello"
                                className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-40"
                              >
                                {anulandoId === log.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Undo2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-4 md:px-6 py-3 md:py-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <p className="text-[11px] md:text-xs text-slate-400 font-bold min-w-0">
                    <span className="hidden sm:inline">Mostrando{" "}</span>
                    {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} de{" "}
                    {filtered.length}
                  </p>
                  <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-xl border-slate-200 text-xs font-bold h-9 px-3"
                    >
                      Anterior
                    </Button>
                    <span className="text-xs font-black text-slate-500 px-1 md:px-2 tabular-nums">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-xl border-slate-200 text-xs font-bold h-9 px-3"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>

    {/* ── Modal Top Clientes por Local ──────────────────────────────────── */}
    {showStatsModal && (
      <div
        className="fixed inset-0 z-[300] flex items-end md:items-center justify-center md:p-6"
        onClick={() => setShowStatsModal(false)}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] md:max-h-[88vh] flex flex-col animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 md:px-7 pt-5 md:pt-7 pb-4 md:pb-5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-slate-800 text-base md:text-lg leading-tight">Top Clientes por Local</p>
                <p className="text-[11px] md:text-xs text-slate-400 font-medium">Mayor compra y cliente más frecuente · histórico</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchStatsLocales()}
                disabled={loadingStats}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loadingStats ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setShowStatsModal(false)}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-4 md:px-7 py-5 md:py-6 pb-safe">
            {loadingStats ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Calculando estadísticas...</p>
              </div>
            ) : statsLocales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                  <BarChart2 className="w-7 h-7" />
                </div>
                <p className="font-black text-slate-700 text-base">Sin datos suficientes</p>
                <p className="text-sm text-slate-400">No hay transacciones con monto registrado aún.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {statsLocales.map((local) => (
                  <div key={local.vendorId} className="rounded-2xl border border-slate-100 bg-slate-50/50 overflow-hidden">
                    {/* Nombre del local */}
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-100/70 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-slate-500" />
                        <p className="font-black text-slate-800 text-sm">{local.vendorName}</p>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {local.totalTransacciones} visita{local.totalTransacciones !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                      {/* Top Spender */}
                      <div className="px-5 py-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mayor compra acumulada</p>
                          {local.topSpender ? (
                            <>
                              <p className="font-black text-slate-800 text-sm truncate">{local.topSpender.nombre}</p>
                              <p className="text-sm font-black text-emerald-600 mt-0.5">
                                {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(local.topSpender.totalMonto)}
                              </p>
                              <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Ticket promedio: {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(local.topSpender.avgTicket)}
                                {" "}· {local.topSpender.compras} compra{local.topSpender.compras !== 1 ? "s" : ""}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-slate-400 font-medium">Sin montos registrados</p>
                          )}
                        </div>
                      </div>

                      {/* Top Frecuente */}
                      <div className="px-5 py-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 shrink-0 mt-0.5">
                          <Repeat2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cliente más frecuente</p>
                          {local.topFrecuente ? (
                            <>
                              <p className="font-black text-slate-800 text-sm truncate">{local.topFrecuente.nombre}</p>
                              <p className="text-sm font-black text-violet-600 mt-0.5">
                                {local.topFrecuente.visitas} visita{local.topFrecuente.visitas !== 1 ? "s" : ""}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-slate-400 font-medium">Sin datos</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loadingStats && statsLocales.length > 0 && (
            <div className="px-4 md:px-7 py-3 md:py-4 border-t border-slate-100 shrink-0 pb-safe">
              <p className="text-xs text-slate-400 font-medium text-center">
                {statsLocales.length} local{statsLocales.length !== 1 ? "es" : ""} con actividad · Solo incluye transacciones reales (excluye sellos de bienvenida y referidos)
              </p>
            </div>
          )}
        </div>
      </div>
    )}

    {/* ── Modal: boleta a tamaño completo ───────────────────────────────── */}
    {boletaModal && (
      <div
        className="fixed inset-0 z-[400] flex items-center justify-center p-4"
        onClick={() => setBoletaModal(null)}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <img
            src={boletaModal}
            alt="Boleta"
            className="max-w-[92vw] max-h-[88vh] rounded-2xl shadow-2xl object-contain bg-white"
          />
          <button
            onClick={() => setBoletaModal(null)}
            className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    )}
  </>
  );
}
