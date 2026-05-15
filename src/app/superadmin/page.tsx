"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection, collectionGroup, getDocs, query, orderBy, limit, where,
} from "firebase/firestore";
import { Loader2, ShieldAlert, RefreshCw, AlertTriangle, Users, Store, Stamp, DollarSign, Activity } from "lucide-react";

import { SUPERADMIN_EMAIL } from "@/lib/constants";

function fmtCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(raw: any) {
  if (!raw) return "—";
  const d = typeof raw === "string" ? new Date(raw) : raw?.toDate?.() ?? new Date(raw);
  return d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

interface Metrics {
  totalUsuarios: number;
  totalVendors: number;
  totalSellosEntregados: number;
  totalSellosRecibidos: number;
  volumenTransado: number;
}

interface TxRow {
  id: string;
  fecha: any;
  clienteNombre: string;
  monto: number;
  vendorId: string;
}

interface IncompleteVendor {
  id: string;
  businessName: string;
  email?: string;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [incompleteVendors, setIncompleteVendors] = useState<IncompleteVendor[]>([]);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  // ── Verificación de identidad ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace("/");
        return;
      }
      const email = (user.email ?? "").trim().toLowerCase();
      if (email !== SUPERADMIN_EMAIL) {
        router.replace("/");
        return;
      }
      setAuthorized(true);
      setAuthChecked(true);
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (authorized) loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  // ── Carga de datos ─────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadMetrics(), loadTransactions(), loadIncompleteVendors()]);
      setLastLoaded(new Date());
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    const [usuariosSnap, vendorsSnap] = await Promise.all([
      getDocs(collection(db, "usuarios")),
      getDocs(collection(db, "entrepreneur_profiles")),
    ]);

    let sellosEntregados = 0;
    let sellosRecibidos = 0;

    usuariosSnap.docs.forEach((d) => {
      const data = d.data();
      sellosEntregados += data.sellosEntregadosHistorico || 0;
      sellosRecibidos += data.comprasRealizadas || 0;
    });

    // Volumen transado: suma de montos en ventas_registradas (collection group)
    let volumen = 0;
    try {
      const ventasSnap = await getDocs(
        query(collectionGroup(db, "ventas_registradas"), limit(500))
      );
      ventasSnap.docs.forEach((d) => {
        volumen += d.data().monto || 0;
      });
    } catch {
      // collectionGroup puede requerir índice — ignorar si falla
    }

    setMetrics({
      totalUsuarios: usuariosSnap.size,
      totalVendors: vendorsSnap.size,
      totalSellosEntregados: sellosEntregados,
      totalSellosRecibidos: sellosRecibidos,
      volumenTransado: volumen,
    });
  };

  const loadTransactions = async () => {
    try {
      const snap = await getDocs(
        query(collectionGroup(db, "ventas_registradas"), orderBy("fecha", "desc"), limit(20))
      );
      setTransactions(
        snap.docs.map((d) => {
          const data = d.data();
          const pathParts = d.ref.path.split("/");
          const vendorId = pathParts[1] ?? "?";
          return {
            id: d.id,
            fecha: data.fecha,
            clienteNombre: data.clienteNombre || "Anónimo",
            monto: data.monto || 0,
            vendorId,
          };
        })
      );
    } catch {
      // Si el collection group no tiene índice, ignorar
    }
  };

  const loadIncompleteVendors = async () => {
    const snap = await getDocs(collection(db, "entrepreneur_profiles"));
    const incomplete: IncompleteVendor[] = snap.docs
      .map((d) => {
        const data = d.data();
        const name = (data.businessName || data.nombre || "").trim();
        return { id: d.id, businessName: name, email: data.email };
      })
      .filter((v) => !v.businessName || v.businessName === "—");

    setIncompleteVendors(incomplete);
  };

  // ── Estados de carga / acceso ──────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!authorized) return null;

  const ANOMALY_THRESHOLD = 100_000;

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-slate-100 font-mono pb-20">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0D0D14] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <div>
              <h1 className="text-sm font-bold text-white tracking-widest uppercase">
                SUPERADMIN — MODO DIOS
              </h1>
              <p className="text-[10px] text-slate-500">
                Club Patio Curauma · Acceso Restringido
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastLoaded && (
              <span className="text-[10px] text-slate-600 hidden sm:block">
                {lastLoaded.toLocaleTimeString("es-CL")}
              </span>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-[11px] font-bold text-slate-400 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Recargar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
        {loading && !metrics ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : metrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard icon={<Users className="w-4 h-4" />} label="Usuarios registrados" value={metrics.totalUsuarios.toLocaleString("es-CL")} color="emerald" />
            <KpiCard icon={<Store className="w-4 h-4" />} label="Emprendedores activos" value={metrics.totalVendors.toLocaleString("es-CL")} color="blue" />
            <KpiCard icon={<Stamp className="w-4 h-4" />} label="Sellos entregados (histórico)" value={metrics.totalSellosEntregados.toLocaleString("es-CL")} color="amber" />
            <KpiCard icon={<Stamp className="w-4 h-4" />} label="Sellos recibidos (clientes)" value={metrics.totalSellosRecibidos.toLocaleString("es-CL")} color="purple" />
            <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Volumen transado total" value={metrics.volumenTransado > 0 ? fmtCLP(metrics.volumenTransado) : "Sin datos"} color="green" wide />
          </div>
        )}

        {/* ── Monitor de Transacciones en Vivo ───────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Monitor de Transacciones (últimas 20)
            </h2>
            {transactions.some(t => t.monto > ANOMALY_THRESHOLD) && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-red-900/50 text-red-400 uppercase tracking-widest">
                ⚠ Anomalías detectadas
              </span>
            )}
          </div>

          {transactions.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-slate-600 text-xs">
              Sin datos — puede requerir índice compuesto en Firestore
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] text-slate-600 uppercase tracking-widest">
                      <th className="text-left px-4 py-3">Fecha/Hora</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Local (ID)</th>
                      <th className="text-left px-4 py-3">Cliente</th>
                      <th className="text-right px-4 py-3">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const isAnomaly = tx.monto > ANOMALY_THRESHOLD;
                      return (
                        <tr
                          key={tx.id}
                          className={`border-b border-white/[0.03] ${isAnomaly ? "bg-red-900/20" : "hover:bg-white/[0.02]"}`}
                        >
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                            {fmtDate(tx.fecha)}
                          </td>
                          <td className="px-4 py-3 text-slate-500 hidden sm:table-cell font-mono text-[10px]">
                            {tx.vendorId.substring(0, 8)}…
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {tx.clienteNombre}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold tabular-nums ${isAnomaly ? "text-red-400" : tx.monto > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                            {tx.monto > 0 ? fmtCLP(tx.monto) : "—"}
                            {isAnomaly && <span className="ml-1 text-red-500">⚠</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ── Health Check de Locales ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Auditoría de Locales — Configuración Incompleta
            </h2>
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-900/40 text-amber-400">
              {incompleteVendors.length} afectados
            </span>
          </div>

          {incompleteVendors.length === 0 ? (
            <div className="rounded-xl border border-emerald-900/30 bg-emerald-900/10 p-6 text-center text-emerald-600 text-xs">
              ✓ Todos los locales tienen nombre configurado
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] divide-y divide-white/[0.04]">
              {incompleteVendors.map((v) => (
                <div key={v.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 truncate font-mono">{v.id}</p>
                    <p className="text-[10px] text-slate-600">
                      {v.businessName || "(sin nombre)"}{v.email ? ` · ${v.email}` : ""}
                    </p>
                  </div>
                  <span className="text-[9px] text-amber-600 font-bold bg-amber-900/30 px-2 py-0.5 rounded">
                    SIN NOMBRE
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { border: string; text: string; bg: string }> = {
  emerald: { border: "border-emerald-900/50", text: "text-emerald-400", bg: "bg-emerald-900/10" },
  blue:    { border: "border-blue-900/50",    text: "text-blue-400",    bg: "bg-blue-900/10"    },
  amber:   { border: "border-amber-900/50",   text: "text-amber-400",   bg: "bg-amber-900/10"   },
  purple:  { border: "border-purple-900/50",  text: "text-purple-400",  bg: "bg-purple-900/10"  },
  green:   { border: "border-green-900/50",   text: "text-green-400",   bg: "bg-green-900/10"   },
};

function KpiCard({
  icon, label, value, color, wide,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  wide?: boolean;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.emerald;
  return (
    <div
      className={`rounded-xl border ${c.border} ${c.bg} p-4 space-y-2 ${wide ? "col-span-2 md:col-span-1" : ""}`}
    >
      <div className={`flex items-center gap-1.5 ${c.text}`}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-2xl font-black tabular-nums ${c.text}`}>{value}</p>
    </div>
  );
}
