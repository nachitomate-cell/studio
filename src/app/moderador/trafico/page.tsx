"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ALLOWED_MOD_EMAILS, canAccessModPanel } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Loader2, ArrowLeft, TrendingUp } from "lucide-react";
import Link from "next/link";
import {
  formatCampaignName,
  hasCampaignAlias,
  loadCampaignDictionary,
  normalizeSource,
} from "@/lib/campaignMapper";

interface Visita {
  id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  userId: string | null;
  timestamp: any;
}

const COLORS = ["#C9920A", "#8DC63F", "#5BB8D4", "#6366f1", "#f43f5e", "#f97316", "#10b981", "#a855f7"];

function agruparNormalizado<T>(
  arr: T[],
  key: keyof T,
  transform: (raw?: string | null) => string,
): { name: string; visitas: number }[] {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const raw = (item[key] as string | undefined | null) ?? null;
    const k = transform(raw);
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map)
    .map(([name, visitas]) => ({ name, visitas }))
    .sort((a, b) => b.visitas - a.visitas);
}

function agrupar<T>(arr: T[], key: keyof T): { name: string; visitas: number }[] {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const k = (item[key] as string) || "(sin datos)";
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map)
    .map(([name, visitas]) => ({ name, visitas }))
    .sort((a, b) => b.visitas - a.visitas);
}

function truncarId(id: string, prefijo = 8): string {
  if (id.length <= prefijo + 3) return id;
  return `${id.slice(0, prefijo)}…`;
}

export default function TraficoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [paginaVisitas, setPaginaVisitas] = useState(0);
  const PAGE_SIZE = 5;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAccessDenied(true);
        setLoading(false);
        setTimeout(() => router.push("/"), 2000);
        return;
      }
      let allowed = ALLOWED_MOD_EMAILS.includes((user.email ?? "").trim().toLowerCase());
      if (!allowed) {
        try {
          const userSnap = await getDoc(doc(db, "usuarios", user.uid));
          allowed = canAccessModPanel(user.email, userSnap.exists() ? userSnap.data() : null);
        } catch { /* deny por default */ }
      }
      if (!allowed) {
        setAccessDenied(true);
        setLoading(false);
        setTimeout(() => router.push("/"), 2000);
        return;
      }
      await loadCampaignDictionary();
      const snap = await getDocs(query(collection(db, "utm_visitas"), orderBy("timestamp", "desc")));
      setVisitas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Visita)));
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (accessDenied) return (
    <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
      Acceso denegado. Redirigiendo…
    </div>
  );

  const porFuente = agruparNormalizado(visitas, "utm_source", normalizeSource);
  const porCampaña = agruparNormalizado(visitas, "utm_campaign", formatCampaignName);
  const porMedio = agrupar(visitas, "utm_medium");
  const usuariosUnicos = new Set(visitas.filter(v => v.userId).map(v => v.userId)).size;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/moderador">
          <button className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Tráfico y Publicidad
          </h1>
          <p className="text-xs text-slate-400 font-medium">Visitas por campaña desde links de publicidad</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total visitas", value: visitas.length, emoji: "👁️" },
          { label: "Fuentes distintas", value: porFuente.length, emoji: "📡" },
          { label: "Campañas", value: porCampaña.filter(c => c.name !== "(sin datos)").length, emoji: "📣" },
          { label: "Con usuario", value: usuariosUnicos, emoji: "👤" },
        ].map(({ label, value, emoji }) => (
          <div key={label} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <p className="text-2xl mb-1">{emoji}</p>
            <p className="text-3xl font-black text-slate-800">{value}</p>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-1">{label}</p>
          </div>
        ))}
      </div>

      {visitas.length === 0 && (
        <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-slate-100">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-black text-slate-700 text-lg">Aún no hay datos</p>
          <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
            Agrega <code className="bg-slate-100 px-1 rounded">?utm_source=instagram</code> al final de tus links de publicidad para empezar a ver estadísticas aquí.
          </p>
          <div className="mt-4 bg-slate-50 rounded-2xl p-4 text-left text-xs font-mono text-slate-500 space-y-1 max-w-md mx-auto">
            <p>Instagram:<br/><span className="text-primary break-all">https://clubpatiocurauma.synaptechspa.cl?utm_source=instagram&utm_campaign=junio2026</span></p>
            <p className="mt-2">Flyer impreso:<br/><span className="text-primary break-all">https://clubpatiocurauma.synaptechspa.cl?utm_source=flyer&utm_campaign=inauguracion</span></p>
            <p className="mt-2">WhatsApp:<br/><span className="text-primary break-all">https://clubpatiocurauma.synaptechspa.cl?utm_source=whatsapp&utm_campaign=promo_julio</span></p>
          </div>
        </div>
      )}

      {visitas.length > 0 && (
        <>
          {/* Gráfico por fuente */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h2 className="font-black text-slate-800 mb-4">Visitas por fuente</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porFuente} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(val: number) => [`${val} visitas`, "Visitas"]}
                  contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="visitas" radius={[8, 8, 0, 0]}>
                  {porFuente.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla por campaña */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <h2 className="font-black text-slate-800 mb-4">Visitas por campaña</h2>
            <div className="space-y-2">
              {porCampaña.map(({ name, visitas: count }, i) => (
                <div key={name} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-slate-700 truncate">{name}</span>
                      <span className="text-sm font-black text-slate-800 ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((count / visitas.length) * 100)}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla completa con paginación */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-slate-800">Últimas visitas</h2>
              <span className="text-xs text-slate-400 font-medium">
                {paginaVisitas * PAGE_SIZE + 1}–{Math.min((paginaVisitas + 1) * PAGE_SIZE, visitas.length)} de {visitas.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 font-bold uppercase tracking-wide border-b border-slate-100">
                    <th className="pb-2 pr-4">Fuente</th>
                    <th className="pb-2 pr-4">Medio</th>
                    <th className="pb-2 pr-4">Campaña</th>
                    <th className="pb-2">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visitas.slice(paginaVisitas * PAGE_SIZE, (paginaVisitas + 1) * PAGE_SIZE).map((v) => {
                    const campañaLegible = formatCampaignName(v.utm_campaign);
                    const mostrarIdCrudo = hasCampaignAlias(v.utm_campaign) && v.utm_campaign;
                    return (
                      <tr key={v.id}>
                        <td className="py-2 pr-4 font-bold text-slate-700">{normalizeSource(v.utm_source)}</td>
                        <td className="py-2 pr-4 text-slate-500">{v.utm_medium || "—"}</td>
                        <td className="py-2 pr-4 text-slate-500" title={v.utm_campaign || undefined}>
                          <div className="font-semibold text-slate-600">{campañaLegible}</div>
                          {mostrarIdCrudo && (
                            <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                              ID: {truncarId(v.utm_campaign)}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-slate-400">
                          {v.timestamp?.toDate
                            ? v.timestamp.toDate().toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Controles de paginación */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => setPaginaVisitas(p => Math.max(0, p - 1))}
                disabled={paginaVisitas === 0}
                className="px-4 py-1.5 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-xs font-bold text-slate-400">
                Página {paginaVisitas + 1} de {Math.ceil(visitas.length / PAGE_SIZE)}
              </span>
              <button
                onClick={() => setPaginaVisitas(p => Math.min(Math.ceil(visitas.length / PAGE_SIZE) - 1, p + 1))}
                disabled={(paginaVisitas + 1) * PAGE_SIZE >= visitas.length}
                className="px-4 py-1.5 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </>
      )}

      {/* Guía de links */}
      {visitas.length > 0 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <h2 className="font-black text-slate-800 mb-3">Cómo crear links de campaña</h2>
          <div className="space-y-2 text-xs font-mono text-slate-500">
            <p><span className="font-sans font-bold text-slate-600">Instagram:</span><br/>
              <span className="text-primary break-all">https://clubpatiocurauma.synaptechspa.cl?utm_source=instagram&utm_medium=social&utm_campaign=NOMBRE</span>
            </p>
            <p className="pt-1"><span className="font-sans font-bold text-slate-600">Flyer / volante:</span><br/>
              <span className="text-primary break-all">https://clubpatiocurauma.synaptechspa.cl?utm_source=flyer&utm_medium=print&utm_campaign=NOMBRE</span>
            </p>
            <p className="pt-1"><span className="font-sans font-bold text-slate-600">WhatsApp:</span><br/>
              <span className="text-primary break-all">https://clubpatiocurauma.synaptechspa.cl?utm_source=whatsapp&utm_medium=chat&utm_campaign=NOMBRE</span>
            </p>
          </div>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
