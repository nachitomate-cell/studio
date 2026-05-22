"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, RefreshCw } from "lucide-react";
import type { AIInsight } from "@/components/SynapTechAI";

interface Insight {
  emoji: string;
  title: string;
  body: string;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateInsights(userData: any, locals?: LocalBasic[]): Insight[] {
  const sellos = userData?.comprasRealizadas || 0;
  const tickets = userData?.ticketsSorteo || 0;
  const historicos = userData?.sellosHistoricos || sellos;

  const insights: Insight[] = [];

  // Slot 1: basado en sellos actuales (2-3 variantes por rango)
  if (sellos === 0) {
    insights.push(
      pick<Insight>([
        {
          emoji: "🎯",
          title: "Comienza tu viaje",
          body: "Aún no has acumulado sellos. Visita cualquier local aliado y pide al vendedor que escanee tu QR para empezar.",
        },
        {
          emoji: "🚀",
          title: "¡Tu primera visita te espera!",
          body: "Cada visita a un local del Patio suma un sello. Con 5 sellos ya puedes canjear tu primera recompensa.",
        },
      ])
    );
  } else if (sellos < 5) {
    const left = 5 - sellos;
    insights.push(
      pick<Insight>([
        {
          emoji: "⚡",
          title: `${left} ${left === 1 ? "sello" : "sellos"} para tu próximo premio`,
          body: `Estás a ${left} ${left === 1 ? "visita" : "visitas"} de canjear una recompensa. ¡Aprovecha hoy!`,
        },
        {
          emoji: "🔥",
          title: "¡Casi en la meta!",
          body: `Solo te ${left === 1 ? "falta 1 sello" : `faltan ${left} sellos`}. Visita cualquier local aliado para completar tu tarjeta.`,
        },
        {
          emoji: "📈",
          title: "Progreso detectado",
          body: `Llevas ${sellos} ${sellos === 1 ? "sello" : "sellos"} acumulados. A este ritmo podrías canjear tu primer premio muy pronto.`,
        },
      ])
    );
  } else {
    insights.push(
      pick<Insight>([
        {
          emoji: "🎁",
          title: "¡Premio disponible!",
          body: `Con ${sellos} sellos puedes canjear ahora mismo. Ve a "Mis Premios" antes de que pasen más días.`,
        },
        {
          emoji: "🏅",
          title: "Saldo de sellos activo",
          body: `Tienes ${sellos} sellos listos para canjear. Los socios que canjean seguido acumulan más rápido en el siguiente ciclo.`,
        },
        {
          emoji: "✅",
          title: "Meta alcanzada",
          body: `¡Listo para canjear! Dirígete a "Mis Premios" y elige la recompensa que más te guste con tus ${sellos} sellos.`,
        },
      ])
    );
  }

  // Slot 2: tips de actividad y comportamiento (pool aleatorio)
  const activityPool: Insight[] = [
    {
      emoji: "📊",
      title: "Patrón de visitas detectado",
      body: "Los miércoles y jueves tienen menor afluencia en el mall — ideal para atención personalizada y sin filas.",
    },
    {
      emoji: "🗓️",
      title: "Mejor momento para visitar",
      body: "Los horarios de mañana (10:00–13:00) son los más tranquilos. Aprovecha para conocer locales nuevos sin aglomeraciones.",
    },
    {
      emoji: "💡",
      title: "Tip de acumulación",
      body: "Los socios que visitan al menos 2 locales diferentes por semana acumulan sus sellos hasta 3 veces más rápido.",
    },
    {
      emoji: "🔍",
      title: "Explora locales nuevos",
      body: "Hay locales en el Patio que quizás aún no conoces. Cada visita nueva es una oportunidad extra de sumar sello.",
    },
    {
      emoji: "🌟",
      title: "Socios activos ganan más",
      body: "Los socios con mayor actividad acceden primero a promociones exclusivas y sorteos especiales del Club.",
    },
    {
      emoji: "📍",
      title: "Actividad en el Patio",
      body: "Las tardes de viernes y sábados concentran la mayor cantidad de promociones activas entre los locales aliados.",
    },
  ];
  insights.push(pick(activityPool));

  // Slot 3: basado en tickets/historial con pool aleatorio
  const loyaltyPool: Insight[] = [];

  if (tickets > 0) {
    loyaltyPool.push(
      {
        emoji: "🎰",
        title: `${tickets} ${tickets === 1 ? "ticket" : "tickets"} en el sorteo`,
        body: "Cada sello nuevo que acumulas incrementa tus chances de ganar. ¡Sigue visitando para multiplicar tus oportunidades!",
      },
      {
        emoji: "🍀",
        title: "¡Estás en el sorteo!",
        body: `Tus ${tickets} ${tickets === 1 ? "ticket participa" : "tickets participan"} actualmente. Acumula más sellos para sumar más chances antes del próximo sorteo.`,
      }
    );
  }

  if (historicos >= 10) {
    loyaltyPool.push(
      {
        emoji: "🏆",
        title: "Socio destacado",
        body: `Has acumulado ${historicos} sellos históricos. Estás entre los miembros más activos del Club Patio Curauma.`,
      },
      {
        emoji: "💎",
        title: "Fidelidad reconocida",
        body: `Con ${historicos} sellos en tu historial, tu nivel de fidelidad es de los más altos del club. ¡Sigue así!`,
      }
    );
  }

  // Siempre disponibles como fallback
  loyaltyPool.push(
    {
      emoji: "✨",
      title: "Beneficio exclusivo para socios",
      body: "Como miembro del Club tienes acceso anticipado a nuevas promociones y ofertas antes que el público general.",
    },
    {
      emoji: "🎯",
      title: "Mantén el ritmo",
      body: "La constancia es clave. Socios que visitan regularmente el Patio acumulan sellos todo el año y acceden a más premios.",
    },
    {
      emoji: "🛍️",
      title: "Descuentos por temporada",
      body: "El Club activa promociones especiales en fechas clave del año. Estar activo como socio es la mejor forma de no perdérselas.",
    }
  );

  insights.push(pick(loyaltyPool));

  // Slot 4: recomendación de local aleatorio
  if (locals && locals.length > 0) {
    const local = pick(locals);
    const intros = [
      "Te recomendamos visitar",
      "Hoy es un buen día para conocer",
      "¿Ya visitaste",
    ];
    const intro = pick(intros);
    const closing = intro.startsWith("¿Ya visitaste")
      ? `${local.name}? ${local.description ? local.description.slice(0, 60) + (local.description.length > 60 ? "…" : "") : "¡Podría sorprenderte!"}`
      : `${local.name}${local.category ? ` (${local.category})` : ""}. ${local.description ? local.description.slice(0, 60) + (local.description.length > 60 ? "…" : "") : "Cada visita suma un sello."}`;
    insights.push({
      emoji: "📍",
      title: "Local recomendado para ti",
      body: `${intro.startsWith("¿") ? "" : intro + " "}${closing}`,
    });
  }

  return insights;
}

interface LocalBasic {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userData: any;
  insights?: AIInsight[];
  locals?: LocalBasic[];
}

export function AIAssistantModal({ isOpen, onClose, userData, insights: externalInsights, locals }: Props) {
  const [phase, setPhase] = useState<"loading" | "done">("loading");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const isSynaptech = Boolean(externalInsights);

  useEffect(() => {
    if (!isOpen) return;
    if (isSynaptech) { setPhase("done"); return; }
    setPhase("loading");
    const t = setTimeout(() => {
      setInsights(generateInsights(userData, locals));
      setPhase("done");
    }, 1800);
    return () => clearTimeout(t);
  }, [isOpen, refreshKey, userData, isSynaptech]);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes aiDot {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-6px); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-[300] flex items-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg mx-auto bg-white rounded-t-[28px] overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
          style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #6D28D9 0%, #4F46E5 50%, #0EA5E9 100%)",
              padding: "16px 20px 16px",
              flexShrink: 0,
            }}
          >
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p
                    className="font-black uppercase tracking-[3px]"
                    style={{ fontSize: "9px", color: "rgba(255,255,255,0.6)" }}
                  >
                    {isSynaptech ? "SynapTech AI" : "Club Patio Curauma"}
                  </p>
                  <h2 className="text-lg font-black text-white leading-tight">
                    {isSynaptech ? "Tu Resumen Inteligente" : "Asistente IA"}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {phase === "done" && (
                  <button
                    onClick={() => setRefreshKey((k) => k + 1)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
                    style={{ background: "rgba(255,255,255,0.2)" }}
                    aria-label="Nuevo análisis"
                  >
                    <RefreshCw className="w-4 h-4 text-white" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
                  style={{ background: "rgba(255,255,255,0.2)" }}
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            <div
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span
                className="font-bold tracking-wide"
                style={{ fontSize: "9px", color: "rgba(255,255,255,0.8)" }}
              >
                {isSynaptech ? "Motor analítico de SynapTech AI" : "Powered by IA · Personalizado para ti"}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
            {phase === "loading" ? (
              <div className="py-12 flex flex-col items-center gap-5">
                <div className="flex gap-2 items-center">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        background: "#6D28D9",
                        animation: "aiDot 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-sm font-medium text-slate-500 text-center">
                  Analizando tu perfil de socio…
                </p>
              </div>
            ) : isSynaptech ? (
              (externalInsights ?? []).map((ins, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2"
                  style={{
                    background: "#F8F7FF",
                    border: "1px solid #EDE9FE",
                    animationDelay: `${i * 100}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <span className="text-2xl shrink-0 mt-0.5">{ins.icon}</span>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{ins.text}</p>
                </div>
              ))
            ) : (
              insights.map((insight, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2"
                  style={{
                    background: "#F8F7FF",
                    border: "1px solid #EDE9FE",
                    animationDelay: `${i * 120}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <span className="text-2xl shrink-0 mt-0.5">{insight.emoji}</span>
                  <div>
                    <p className="font-black text-slate-800 text-sm leading-tight mb-1">
                      {insight.title}
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">{insight.body}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-8 pt-2 shrink-0">
            <p className="text-center font-medium text-slate-300" style={{ fontSize: "9px" }}>
              {isSynaptech
                ? "Motor analítico de SynapTech AI · Conclusiones basadas en los datos cargados."
                : "Análisis generado por inteligencia artificial · Club Patio Curauma"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
