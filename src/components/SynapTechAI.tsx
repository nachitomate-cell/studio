"use client";

import { Sparkles, Loader2 } from "lucide-react";

export interface AIInsight {
  icon: string;
  text: string;
  type?: "positive" | "warning" | "alert" | "neutral";
}

interface SynapTechAIPanelProps {
  insights: AIInsight[];
  title?: string;
  loading?: boolean;
}

const TYPE_STYLE: Record<string, string> = {
  positive: "text-emerald-700",
  warning: "text-amber-700",
  alert: "text-red-700",
  neutral: "text-slate-700",
};

export function SynapTechAIPanel({
  insights,
  title = "Análisis IA",
  loading = false,
}: SynapTechAIPanelProps) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1.5px solid rgba(139,92,246,0.25)" }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: "linear-gradient(90deg,#7C3AED 0%,#4F46E5 100%)" }}
      >
        <Sparkles className="w-3.5 h-3.5 text-white/80 shrink-0" />
        <p className="text-[11px] font-black text-white uppercase tracking-widest flex-1">{title}</p>
        <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">SynapTech</span>
      </div>

      {/* Body */}
      <div className="bg-white px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 py-1">
            <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
            <p className="text-xs text-slate-400">Procesando datos…</p>
          </div>
        ) : insights.length === 0 ? (
          <p className="text-xs text-slate-400 py-1">Sin suficientes datos para generar conclusiones.</p>
        ) : (
          insights.map((ins, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-base leading-none shrink-0 mt-px">{ins.icon}</span>
              <p className={`text-xs leading-relaxed ${TYPE_STYLE[ins.type ?? "neutral"]}`}>
                {ins.text}
              </p>
            </div>
          ))
        )}

        {/* Watermark */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
          <Sparkles className="w-2.5 h-2.5 text-violet-300 shrink-0" />
          <p className="text-[9px] text-slate-300 font-medium leading-none">
            Motor analítico de SynapTech AI · Conclusiones basadas en los datos cargados.
          </p>
        </div>
      </div>
    </div>
  );
}
