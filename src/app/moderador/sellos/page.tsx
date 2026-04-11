"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection, onSnapshot, query, orderBy, limit, getDocs, getDoc, doc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  Loader2, ChevronLeft, Download, Search, BarChart2,
  TrendingUp, Store, Star, Stamp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

const MASTER_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "ignaciiio.mate@gmail.com";
const PAGE_SIZE = 20;

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
}

interface VendorInfo {
  id: string;
  nombre: string;
}

function formatFecha(fecha: string): string {
  try {
    const d = new Date(fecha);
    return (
      d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " +
      d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return fecha;
  }
}

function formatMonto(monto?: number): string {
  if (!monto || monto === 0) return "No registrado";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(monto);
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
    <Card className="border-none shadow-md rounded-3xl bg-white">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}18`, color }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              {label}
            </p>
            <p className="text-xl font-black text-slate-800 truncate leading-tight">{value}</p>
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

  // Filtros
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);

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
    getDocs(collection(db, "entrepreneur_profiles"))
      .then((snap) => {
        const list: VendorInfo[] = [];
        const map: Record<string, string> = {};
        snap.forEach((d) => {
          const data = d.data();
          const nombre = data.businessName || data.nombre || d.id;
          list.push({ id: d.id, nombre });
          map[d.id] = nombre;
        });
        setVendorList(list.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setVendors(map);
      })
      .catch(() => {});
  }, [authorized]);

  // ── Suscripción en tiempo real a system_logs ───────────────────────────────
  useEffect(() => {
    if (!authorized) return;
    setLogsLoading(true);

    // Cargamos los últimos 500 registros ordenados por fecha desc.
    // Filtramos por tipo client-side para evitar índice compuesto.
    const q = query(
      collection(db, "system_logs"),
      orderBy("fecha", "desc"),
      limit(500)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: LogEntry[] = snap.docs
          .map((d) => ({
            id: d.id,
            usuario: d.data().usuario || "Desconocido",
            usuarioId: d.data().usuarioId || "",
            vendedorId: d.data().vendedorId || "",
            accion: d.data().accion || "",
            fecha: d.data().fecha || "",
            tipo: d.data().tipo || "",
            metodo: d.data().metodo,
            monto: d.data().monto,
          }))
          .filter((l) => l.tipo === "FIDELIZACION" || l.tipo === "SELLO_RECHAZADO");

        setLogs(data);
        computeKpis(data);
        setLogsLoading(false);
      },
      (err) => {
        console.error("[RegistroSellos] onSnapshot error:", err);
        setLogsLoading(false);
      }
    );

    return () => unsub();
  }, [authorized]);

  // ── Calcular KPIs del mes actual ───────────────────────────────────────────
  function computeKpis(data: LogEntry[]) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const thisMonth = data.filter(
      (l) => l.tipo === "FIDELIZACION" && l.fecha >= startOfMonth
    );

    const totalSellos = thisMonth.length;
    const totalVentas = thisMonth.reduce((sum, l) => sum + (l.monto || 0), 0);

    // Local más activo
    const byVendor: Record<string, number> = {};
    thisMonth.forEach((l) => {
      if (l.vendedorId) byVendor[l.vendedorId] = (byVendor[l.vendedorId] || 0) + 1;
    });
    const topVendorEntry = Object.entries(byVendor).sort((a, b) => b[1] - a[1])[0];
    const localActivoId = topVendorEntry?.[0] || "";

    // Cliente más frecuente
    const byClient: Record<string, { count: number; nombre: string }> = {};
    thisMonth.forEach((l) => {
      if (l.usuarioId) {
        if (!byClient[l.usuarioId]) byClient[l.usuarioId] = { count: 0, nombre: l.usuario };
        byClient[l.usuarioId].count++;
      }
    });
    const topClient = Object.entries(byClient).sort((a, b) => b[1].count - a[1].count)[0];

    setKpis({
      totalSellos,
      totalVentas,
      localActivo: "",       // se resuelve con vendors map en el render
      localActivoId,
      clienteFrecuente: topClient?.[1].nombre || "—",
    });
  }

  // ── Filtrado y paginación (client-side) ────────────────────────────────────
  const filtered = logs.filter((l) => {
    if (desde && l.fecha < desde) return false;
    if (hasta && l.fecha > hasta + "T23:59:59") return false;
    if (vendorFilter && l.vendedorId !== vendorFilter) return false;
    if (
      clienteFilter &&
      !l.usuario.toLowerCase().includes(clienteFilter.toLowerCase())
    )
      return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // ── Exportar CSV ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = ["Fecha y hora", "Cliente", "Local", "Sellos", "Monto", "Estado"];
    const rows = filtered.map((l) => [
      `"${l.fecha}"`,
      `"${l.usuario}"`,
      `"${vendors[l.vendedorId] || l.vendedorId || "—"}"`,
      "+1 sello",
      l.monto && l.monto > 0 ? l.monto : 0,
      l.tipo === "FIDELIZACION" ? "Confirmado" : "Rechazado",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sellos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFiltros = () => {
    setDesde("");
    setHasta("");
    setVendorFilter("");
    setClienteFilter("");
    setCurrentPage(1);
  };

  const hayFiltros = desde || hasta || vendorFilter || clienteFilter;

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
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header sticky */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/moderador">
            <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Registro de Sellos
            </h1>
            <p className="text-sm text-slate-400 font-medium">
              Historial completo de transacciones
            </p>
          </div>
          <Button
            onClick={exportCSV}
            variant="outline"
            className="rounded-2xl h-10 px-4 gap-2 font-bold text-sm border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── KPI Cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Desde
            </label>
            <input
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Hasta
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Local / Vendedor
            </label>
            <select
              value={vendorFilter}
              onChange={(e) => {
                setVendorFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">Todos los locales</option>
              {vendorList.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Buscar cliente
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Nombre del cliente..."
                value={clienteFilter}
                onChange={(e) => {
                  setClienteFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-10 rounded-xl border-slate-200 text-sm font-medium"
              />
            </div>
          </div>
          {hayFiltros && (
            <Button
              variant="ghost"
              onClick={resetFiltros}
              className="h-10 text-slate-400 hover:text-slate-600 text-xs font-bold rounded-xl"
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
              {/* Cabecera de la tabla con contador */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-500">
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "registro" : "registros"}
                  {hayFiltros ? " con filtros aplicados" : " en total"}
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Tiempo real
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs text-slate-400 uppercase font-black tracking-wider border-b-2 border-slate-100 sticky top-0">
                    <tr>
                      <th className="px-6 py-4">Fecha y hora</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Local</th>
                      <th className="px-6 py-4">Sellos</th>
                      <th className="px-6 py-4">Monto</th>
                      <th className="px-6 py-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-20 text-center text-slate-300 font-bold"
                        >
                          Sin registros para los filtros seleccionados
                        </td>
                      </tr>
                    ) : (
                      paginated.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          <td className="px-6 py-4 text-slate-400 font-medium whitespace-nowrap text-xs">
                            {formatFecha(log.fecha)}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800">
                            {log.usuario}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-medium">
                            {vendors[log.vendedorId] || log.vendedorId || "—"}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                              +1 sello
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">
                            {formatMonto(log.monto)}
                          </td>
                          <td className="px-6 py-4">
                            <EstadoBadge tipo={log.tipo} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-400 font-bold">
                    Mostrando{" "}
                    {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} de{" "}
                    {filtered.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-xl border-slate-200 text-xs font-bold h-9"
                    >
                      Anterior
                    </Button>
                    <span className="text-xs font-black text-slate-500 px-2 tabular-nums">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="rounded-xl border-slate-200 text-xs font-bold h-9"
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
  );
}
