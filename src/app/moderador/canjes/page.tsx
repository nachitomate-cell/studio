"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection, onSnapshot, query, orderBy, limit, getDoc, doc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  Loader2, ChevronLeft, Download, Search, Gift, CheckCircle2, Clock, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";


const MASTER_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "ignaciiio.mate@gmail.com";
const PAGE_SIZE = 20;

interface CanjeEntry {
  id: string;
  clienteNombre: string;
  clienteId: string;
  premioNombre: string;
  premioIcono: string;
  vendorNombre: string;
  vendorId: string;
  codigo: string;
  sellosDescontados: number;
  status: "pending" | "used" | "expired";
  creadoEn: any;
  expiraEn: string;
}

function formatFecha(val: any): string {
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
        <Clock className="w-3 h-3" /> Pendiente
      </span>
    );
  }
  if (status === "used") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" /> Usado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
      <XCircle className="w-3 h-3" /> Expirado
    </span>
  );
}

function KpiCard({ label, value, color = "#D3B673" }: { label: string; value: string | number; color?: string }) {
  return (
    <Card className="border-none shadow-md rounded-3xl bg-white">
      <CardContent className="p-5">
        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color }}>{label}</p>
        <p className="text-2xl font-black text-slate-800">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function ModeradorCanjesPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [canjes, setCanjes] = useState<CanjeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [clienteFilter, setClienteFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setAuthLoading(false); router.replace("/"); return; }

      if (user.email === MASTER_EMAIL) {
        setAuthorized(true); setAuthLoading(false); return;
      }

      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if (snap.exists()) {
          const rol = snap.data().rol as string;
          const roles: string[] = Array.isArray(snap.data().roles) ? snap.data().roles : [];
          const isAllowed = ["moderador", "admin", "director", "director_patio"].includes(rol)
            || roles.some((r) => ["moderador", "admin", "director", "director_patio"].includes(r));
          if (isAllowed) { setAuthorized(true); } else { router.replace("/"); }
        } else {
          router.replace("/");
        }
      } catch { router.replace("/"); }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // ── Suscripción a canjes ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!authorized) return;
    setLoading(true);

    const q = query(collection(db, "canjes"), orderBy("creadoEn", "desc"), limit(500));
    const unsub = onSnapshot(q, (snap) => {
      setCanjes(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as CanjeEntry))
      );
      setLoading(false);
    }, (err) => {
      console.error("[ModeradorCanjes]", err);
      setLoading(false);
    });
    return () => unsub();
  }, [authorized]);

  // ── Filtrado ──────────────────────────────────────────────────────────────────
  const filtered = canjes.filter((c) => {
    if (estadoFilter && c.status !== estadoFilter) return false;
    if (clienteFilter && !c.clienteNombre.toLowerCase().includes(clienteFilter.toLowerCase())) return false;
    if (vendorFilter && !c.vendorNombre.toLowerCase().includes(vendorFilter.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hayFiltros = clienteFilter || vendorFilter || estadoFilter;

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const totalCanjes = canjes.length;
  const usados = canjes.filter((c) => c.status === "used").length;
  const pendientes = canjes.filter((c) => c.status === "pending").length;

  // ── Exportar Excel ─────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = filtered.map((c) => ({
      Fecha: formatFecha(c.creadoEn),
      Cliente: c.clienteNombre,
      Premio: c.premioNombre,
      Local: c.vendorNombre,
      Código: c.codigo,
      Sellos: c.sellosDescontados,
      Estado: c.status === "used" ? "Usado" : c.status === "pending" ? "Pendiente" : "Expirado",
      Expira: c.expiraEn ? new Date(c.expiraEn).toLocaleDateString("es-CL") : "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 24 }, { wch: 24 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Canjes");
    XLSX.writeFile(wb, `canjes_premios_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/moderador">
            <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Canjes de Premios
            </h1>
            <p className="text-sm text-slate-400 font-medium">Historial completo de canjes</p>
          </div>
          <Button
            onClick={exportExcel}
            variant="outline"
            className="rounded-2xl h-10 px-4 gap-2 font-bold text-sm border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary transition-all whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="Total canjes" value={totalCanjes} color="#D3B673" />
          <KpiCard label="Usados" value={usados} color="#10b981" />
          <KpiCard label="Pendientes" value={pendientes} color="#f59e0b" />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</label>
            <select
              value={estadoFilter}
              onChange={(e) => { setEstadoFilter(e.target.value); setCurrentPage(1); }}
              className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-primary"
            >
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="used">Usado</option>
              <option value="expired">Expirado</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Buscar cliente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Nombre del cliente..."
                value={clienteFilter}
                onChange={(e) => { setClienteFilter(e.target.value); setCurrentPage(1); }}
                className="pl-9 h-10 rounded-xl border-slate-200 text-sm font-medium"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Buscar local</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Nombre del local..."
                value={vendorFilter}
                onChange={(e) => { setVendorFilter(e.target.value); setCurrentPage(1); }}
                className="pl-9 h-10 rounded-xl border-slate-200 text-sm font-medium"
              />
            </div>
          </div>
          {hayFiltros && (
            <Button
              variant="ghost"
              onClick={() => { setClienteFilter(""); setVendorFilter(""); setEstadoFilter(""); setCurrentPage(1); }}
              className="h-10 text-slate-400 hover:text-slate-600 text-xs font-bold rounded-xl"
            >
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Tabla */}
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando canjes...</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-500">
                  {filtered.length} {filtered.length === 1 ? "canje" : "canjes"}
                  {hayFiltros ? " con filtros aplicados" : " en total"}
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Tiempo real
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs text-slate-400 uppercase font-black tracking-wider border-b-2 border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Premio</th>
                      <th className="px-6 py-4">Local</th>
                      <th className="px-6 py-4">Código</th>
                      <th className="px-6 py-4">Sellos</th>
                      <th className="px-6 py-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center text-slate-300 font-bold">
                          Sin canjes para los filtros seleccionados
                        </td>
                      </tr>
                    ) : (
                      paginated.map((canje) => (
                        <tr key={canje.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 text-slate-400 font-medium whitespace-nowrap text-xs">
                            {formatFecha(canje.creadoEn)}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800">{canje.clienteNombre}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{canje.premioIcono || "🎁"}</span>
                              <span className="font-medium text-slate-700">{canje.premioNombre}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-medium">{canje.vendorNombre}</td>
                          <td className="px-6 py-4">
                            <span className="font-black tracking-widest text-primary text-sm">{canje.codigo}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                              -{canje.sellosDescontados}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={canje.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-400 font-bold">
                    Mostrando {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
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
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
