"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Copy, Check, Bell, MapPin, UserX, Gift, Star,
  Zap, Trophy, Clock, ChevronLeft, Search,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

type CategoriaId =
  | "geocerca" | "inactivos" | "cerca_premio"
  | "bienvenida" | "promo" | "sorteo" | "urgente" | "sello";

interface NotifTemplate {
  id: string;
  titulo: string;
  cuerpo: string;
  condicion: string;
  categoria: CategoriaId;
  cta: string;
}

// ── Categoria config ───────────────────────────────────────────────────────────

const CATEGORIA_CFG: Record<CategoriaId, {
  label: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  Icon: LucideIcon;
}> = {
  geocerca:     { label: "Geocerca",         color: "#34d399", bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.28)",  glow: "rgba(52,211,153,0.07)",  Icon: MapPin  },
  inactivos:    { label: "Inactivos",        color: "#fb923c", bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.28)",  glow: "rgba(251,146,60,0.07)",  Icon: UserX   },
  cerca_premio: { label: "Cerca del Premio", color: "#fbbf24", bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.28)",  glow: "rgba(251,191,36,0.07)",  Icon: Gift    },
  bienvenida:   { label: "Bienvenida",       color: "#818cf8", bg: "rgba(129,140,248,0.10)", border: "rgba(129,140,248,0.28)", glow: "rgba(129,140,248,0.07)", Icon: Star    },
  promo:        { label: "Promoción",        color: "#4ead1f", bg: "rgba(78,173,31,0.10)",   border: "rgba(78,173,31,0.28)",   glow: "rgba(78,173,31,0.07)",   Icon: Zap     },
  sorteo:       { label: "Sorteo",           color: "#e879f9", bg: "rgba(232,121,249,0.10)", border: "rgba(232,121,249,0.28)", glow: "rgba(232,121,249,0.07)", Icon: Trophy  },
  urgente:      { label: "Urgente",          color: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.28)", glow: "rgba(248,113,113,0.07)", Icon: Clock   },
  sello:        { label: "Sello Ganado",     color: "#38bdf8", bg: "rgba(56,189,248,0.10)",  border: "rgba(56,189,248,0.28)",  glow: "rgba(56,189,248,0.07)",  Icon: Bell    },
};

const FILTROS: { id: "todos" | CategoriaId; label: string }[] = [
  { id: "todos",        label: "Todos"           },
  { id: "geocerca",     label: "Geocerca"         },
  { id: "inactivos",    label: "Inactivos"        },
  { id: "cerca_premio", label: "Cerca del Premio" },
  { id: "bienvenida",   label: "Bienvenida"       },
  { id: "promo",        label: "Promoción"        },
  { id: "sorteo",       label: "Sorteo"           },
  { id: "urgente",      label: "Urgente"          },
  { id: "sello",        label: "Sello Ganado"     },
];

// ── Plantillas mock ────────────────────────────────────────────────────────────

const TEMPLATES: NotifTemplate[] = [
  {
    id: "geo-1",
    titulo: "📍 ¡Estás cerca de Patio Curauma!",
    cuerpo: "Detectamos que estás a pocos pasos. ¡Entra y suma tu sello de hoy con tus emprendedores favoritos! 💛",
    condicion: "Usuario dentro del radio de 500 m de la geocerca",
    categoria: "geocerca",
    cta: "Ir al Patio",
  },
  {
    id: "geo-2",
    titulo: "🛍️ ¡Patio Curauma te espera cerca!",
    cuerpo: "Estás pasando por aquí, ¿por qué no entras? Hoy puedes sumar un sello más y acercarte a tu próximo premio.",
    condicion: "Usuario a menos de 1 km (mensaje alternativo de geocerca)",
    categoria: "geocerca",
    cta: "Ver mapa",
  },
  {
    id: "inac-1",
    titulo: "🕐 ¡Te echamos de menos en el Patio!",
    cuerpo: "Llevas 2 semanas sin visitarnos. Tus emprendedores favoritos tienen novedades esperándote. ¡Ven hoy! 💛",
    condicion: "Sin visitas en los últimos 14 días",
    categoria: "inactivos",
    cta: "Volver al Patio",
  },
  {
    id: "inac-2",
    titulo: "⚠️ ¡Un mes sin verte en Club Patio!",
    cuerpo: "¿Todo bien? Han pasado 30 días y te echamos de menos. Vuelve, te esperamos con los brazos abiertos. 💛",
    condicion: "Sin visitas en los últimos 30+ días (re-engagement crítico)",
    categoria: "inactivos",
    cta: "Quiero volver",
  },
  {
    id: "prem-1",
    titulo: "🔥 ¡Te falta 1 sello para ganar tu premio!",
    cuerpo: "Estás a un paso de conseguirlo. Visita Patio Curauma HOY y reclama tu recompensa. ¡No dejes escapar esto! 🎁",
    condicion: "9 sellos acumulados — falta 1 para completar tarjeta",
    categoria: "cerca_premio",
    cta: "Ver mi progreso",
  },
  {
    id: "prem-2",
    titulo: "⚡ ¡Solo 3 sellos más y ganas tu regalo!",
    cuerpo: "Estás casi ahí. Visita a tus emprendedores favoritos en Patio Curauma y acelera tu camino al premio. 💛",
    condicion: "7 sellos acumulados — faltan 3",
    categoria: "cerca_premio",
    cta: "Ver mi progreso",
  },
  {
    id: "prem-3",
    titulo: "☕ ¡Tu café gratis te espera en el Patio!",
    cuerpo: "Acumulaste 5 sellos y puedes canjear un café GRATIS en el bazar Patio Curauma. ¡Ven a disfrutarlo! ☕",
    condicion: "5–6 sellos acumulados — elegible para canje de café",
    categoria: "cerca_premio",
    cta: "Canjear café",
  },
  {
    id: "bien-1",
    titulo: "🌟 ¡Bienvenido/a a Club Patio Curauma!",
    cuerpo: "Acabas de unirte a nuestra comunidad. Tu primer sello es un regalo 🎁. ¡Ven a buscarlo a Patio Curauma y comienza tu aventura!",
    condicion: "Usuario recién registrado (primer ingreso a la app)",
    categoria: "bienvenida",
    cta: "Comenzar",
  },
  {
    id: "promo-1",
    titulo: "🎉 ¡Sellos dobles esta semana en Patio!",
    cuerpo: "Del miércoles al domingo, cada compra en Patio Curauma vale el doble de sellos. ¡Aprovecha y acelera tu camino al premio! 💛",
    condicion: "Campaña especial — todos los socios activos",
    categoria: "promo",
    cta: "Ver beneficios",
  },
  {
    id: "promo-2",
    titulo: "✨ Beneficio exclusivo Club Patio + Fronza",
    cuerpo: "Tus compras en Patio Curauma desbloquean promociones especiales con Fronza. ¡Compra local y vive la experiencia Club Patio!",
    condicion: "Segmento general / todos los socios",
    categoria: "promo",
    cta: "Ver más",
  },
  {
    id: "sort-1",
    titulo: "🎟️ ¡Tus tickets de sorteo te esperan!",
    cuerpo: "Tienes tickets activos en el sorteo de Club Patio. Recuerda que puedes ganar premios increíbles. ¡Mucha suerte! 🍀",
    condicion: "Usuarios con 1+ tickets de sorteo activos",
    categoria: "sorteo",
    cta: "Ver sorteo",
  },
  {
    id: "urg-1",
    titulo: "🚨 ¡Última oportunidad! Oferta termina hoy",
    cuerpo: "La promoción especial de Patio Curauma vence esta noche a las 20:00 hrs. ¡Date prisa y no te la pierdas! ⏰",
    condicion: "Campaña urgente de día único — todos los socios activos",
    categoria: "urgente",
    cta: "Ver oferta",
  },
  {
    id: "sell-1",
    titulo: "✅ ¡Sello registrado en Club Patio!",
    cuerpo: "Tu visita quedó registrada. Sigue acumulando y pronto tendrás tu recompensa. ¡Gracias por preferirnos! 💛",
    condicion: "Tras escaneo exitoso de QR (confirmación handshake)",
    categoria: "sello",
    cta: "Ver mis sellos",
  },
];

// ── CopyButton ─────────────────────────────────────────────────────────────────

function CopyButton({ titulo, cuerpo }: { titulo: string; cuerpo: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = `${titulo}\n\n${cuerpo}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [titulo, cuerpo]);

  return (
    <motion.button
      onClick={handleCopy}
      whileTap={{ scale: 0.9 }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 outline-none"
      style={{
        background: copied ? "rgba(78,173,31,0.15)" : "rgba(255,255,255,0.06)",
        color:      copied ? "#4ead1f"               : "rgba(255,255,255,0.42)",
        border:     `1px solid ${copied ? "rgba(78,173,31,0.35)" : "rgba(255,255,255,0.1)"}`,
        transition: "background 0.25s, color 0.25s, border-color 0.25s",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "check" : "copy"}
          initial={{ scale: 0.55, opacity: 0 }}
          animate={{ scale: 1,    opacity: 1 }}
          exit={   { scale: 0.55, opacity: 0 }}
          transition={{ duration: 0.13, ease: "easeOut" }}
          className="flex items-center gap-1.5"
        >
          {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
          {copied ? "¡Copiado!" : "Copiar"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

// ── NotifCard ─────────────────────────────────────────────────────────────────

function NotifCard({ t, index }: { t: NotifTemplate; index: number }) {
  const cfg = CATEGORIA_CFG[t.categoria];
  const Icon = cfg.Icon;
  const delay = Math.min(index * 0.045, 0.3);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={   { opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{
        layout:  { type: "spring", bounce: 0.18, duration: 0.5 },
        opacity: { duration: 0.22, delay },
        y:       { duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] },
        scale:   { duration: 0.22, delay },
      }}
      className="group relative flex flex-col gap-3.5 rounded-2xl p-5 overflow-hidden"
      style={{
        background:    "rgba(255,255,255,0.028)",
        border:        "1px solid rgba(255,255,255,0.08)",
        backdropFilter:"blur(16px)",
      }}
    >
      {/* Ambient glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 110% 70% at 5% 5%, ${cfg.glow}, transparent 60%)`,
          transition: "opacity 0.4s ease",
        }}
      />
      {/* Top-edge accent line */}
      <div
        className="absolute top-0 left-6 right-6 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${cfg.color}40, transparent)`,
          opacity: 0.6,
        }}
      />

      {/* Row 1: Badge + Copy */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          <Icon size={10} strokeWidth={2.5} />
          {cfg.label}
        </span>
        <CopyButton titulo={t.titulo} cuerpo={t.cuerpo} />
      </div>

      {/* Título */}
      <h3 className="relative z-10 text-[13px] font-bold leading-snug text-white/90">
        {t.titulo}
      </h3>

      {/* Cuerpo */}
      <p className="relative z-10 text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.48)" }}>
        {t.cuerpo}
      </p>

      {/* Divider */}
      <div className="relative z-10 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }} />

      {/* Meta */}
      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-start gap-2.5">
          <span
            className="text-[9.5px] font-semibold uppercase tracking-widest mt-px shrink-0 w-16"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            Condición
          </span>
          <span className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
            {t.condicion}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className="text-[9.5px] font-semibold uppercase tracking-widest shrink-0 w-16"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            CTA
          </span>
          <span
            className="text-[11px] font-semibold"
            style={{ color: cfg.color, opacity: 0.85 }}
          >
            {t.cta}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlantillasPage() {
  const [filtro, setFiltro]   = useState<"todos" | CategoriaId>("todos");
  const [search, setSearch]   = useState("");
  const router                = useRouter();

  const filtered = TEMPLATES.filter((t) => {
    const matchesFiltro  = filtro === "todos" || t.categoria === filtro;
    const q              = search.toLowerCase().trim();
    const matchesSearch  =
      !q ||
      t.titulo.toLowerCase().includes(q)    ||
      t.cuerpo.toLowerCase().includes(q)    ||
      t.condicion.toLowerCase().includes(q) ||
      t.cta.toLowerCase().includes(q);
    return matchesFiltro && matchesSearch;
  });

  return (
    <div className="min-h-screen" style={{ background: "#07090f", color: "#f1f5f9" }}>

      {/* ── Sticky header ── */}
      <motion.header
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1,  y: 0   }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-30"
        style={{
          background:    "rgba(7,9,15,0.88)",
          backdropFilter:"blur(28px)",
          borderBottom:  "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-xl outline-none hover:bg-white/10 transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}
          >
            <ChevronLeft size={17} strokeWidth={2.5} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-[13.5px] font-bold tracking-tight text-white leading-tight">
              Plantillas de Notificación
            </h1>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {filtered.length} plantilla{filtered.length !== 1 ? "s" : ""}
              {" · "}Club Patio Curauma
            </p>
          </div>

          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 tracking-wide"
            style={{
              background: "rgba(78,173,31,0.13)",
              color:      "#4ead1f",
              border:     "1px solid rgba(78,173,31,0.22)",
            }}
          >
            REPOSITORIO
          </span>
        </div>
      </motion.header>

      <div className="max-w-3xl mx-auto px-4 py-7 space-y-5">

        {/* ── Search ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1,  y: 0  }}
          transition={{ delay: 0.08, duration: 0.3 }}
          className="relative"
        >
          <Search
            size={13}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "rgba(255,255,255,0.25)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, mensaje o condición…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] outline-none"
            style={{
              background:   "rgba(255,255,255,0.05)",
              border:       "1px solid rgba(255,255,255,0.09)",
              color:        "rgba(255,255,255,0.82)",
              caretColor:   "#4ead1f",
            }}
          />
        </motion.div>

        {/* ── Filtros ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.14, duration: 0.3 }}
          className="flex gap-2 overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: "none" }}
        >
          {FILTROS.map((f) => {
            const active = filtro === f.id;
            const catCfg = f.id !== "todos" ? CATEGORIA_CFG[f.id as CategoriaId] : null;
            return (
              <motion.button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                whileTap={{ scale: 0.93 }}
                className="shrink-0 px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold outline-none"
                style={
                  active && catCfg
                    ? { background: catCfg.bg,              color: catCfg.color, border: `1px solid ${catCfg.border}` }
                    : active
                    ? { background: "rgba(78,173,31,0.15)", color: "#4ead1f",    border: "1px solid rgba(78,173,31,0.32)" }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.38)", border: "1px solid rgba(255,255,255,0.09)" }
                }
              >
                {f.label}
              </motion.button>
            );
          })}
        </motion.div>

        {/* ── Grid de cards ── */}
        <LayoutGroup id="plantillas-grid">
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((t, i) => (
                <NotifCard key={t.id} t={t} index={i} />
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>

        {/* ── Empty state ── */}
        <AnimatePresence>
          {filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1,  y: 0  }}
              exit={   { opacity: 0         }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center justify-center gap-3 py-20"
            >
              <Bell size={42} style={{ color: "rgba(255,255,255,0.07)" }} />
              <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.22)" }}>
                No hay plantillas para este filtro
              </p>
              {search && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setSearch("")}
                  className="text-xs font-semibold px-4 py-2 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color:      "rgba(255,255,255,0.45)",
                    border:     "1px solid rgba(255,255,255,0.09)",
                  }}
                >
                  Limpiar búsqueda
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer hint ── */}
        {filtered.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-[11px] pb-6"
            style={{ color: "rgba(255,255,255,0.15)" }}
          >
            Toca "Copiar" en cualquier tarjeta para copiar título + mensaje al portapapeles
          </motion.p>
        )}
      </div>
    </div>
  );
}
