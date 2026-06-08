"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Sparkles, Trophy, Info, Bell, X, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PushNotifData {
  titulo: string;
  body: string;
  tipo: string;
  cta: string;
}

interface Props {
  notif: PushNotifData | null;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

// ── Per-type visual config ────────────────────────────────────────────────────

interface TipoCfg {
  label: string;
  color: string;
  heroBg: string;
  pillBg: string;
  pillBorder: string;
  ctaBg: string;
  showBanner: boolean;
  Icon: LucideIcon;
}

const TIPO_CFG: Record<string, TipoCfg> = {
  BROADCAST_URGENTE: {
    label:       "Urgente",
    color:       "#ef4444",
    heroBg:      "linear-gradient(180deg, rgba(239,68,68,0.15) 0%, transparent 100%)",
    pillBg:      "rgba(239,68,68,0.11)",
    pillBorder:  "rgba(239,68,68,0.28)",
    ctaBg:       "#ef4444",
    showBanner:  false,
    Icon:        AlertTriangle,
  },
  BROADCAST_PROMO: {
    label:       "Promoción",
    color:       "#10b981",
    heroBg:      "linear-gradient(180deg, rgba(16,185,129,0.13) 0%, transparent 100%)",
    pillBg:      "rgba(16,185,129,0.11)",
    pillBorder:  "rgba(16,185,129,0.28)",
    ctaBg:       "#10b981",
    showBanner:  true,
    Icon:        Sparkles,
  },
  BROADCAST_SORTEO: {
    label:       "Sorteo",
    color:       "#8b5cf6",
    heroBg:      "linear-gradient(180deg, rgba(139,92,246,0.17) 0%, transparent 100%)",
    pillBg:      "rgba(139,92,246,0.11)",
    pillBorder:  "rgba(139,92,246,0.28)",
    ctaBg:       "#8b5cf6",
    showBanner:  false,
    Icon:        Trophy,
  },
  BROADCAST_INFO: {
    label:       "Información",
    color:       "#3b82f6",
    heroBg:      "linear-gradient(180deg, rgba(59,130,246,0.13) 0%, transparent 100%)",
    pillBg:      "rgba(59,130,246,0.11)",
    pillBorder:  "rgba(59,130,246,0.28)",
    ctaBg:       "#3b82f6",
    showBanner:  true,
    Icon:        Info,
  },
};

const DEFAULT_CFG: TipoCfg = {
  label:       "Club Patio",
  color:       "#4ead1f",
  heroBg:      "linear-gradient(180deg, rgba(78,173,31,0.11) 0%, transparent 100%)",
  pillBg:      "rgba(78,173,31,0.10)",
  pillBorder:  "rgba(78,173,31,0.22)",
  ctaBg:       "#4ead1f",
  showBanner:  true,
  Icon:        Bell,
};

// ── Icon animations per type ──────────────────────────────────────────────────

const ICON_ANIM: Record<string, { animate: object; transition: object }> = {
  BROADCAST_URGENTE: {
    animate:    { scale: [1, 1.20, 1] },
    transition: { repeat: Infinity, duration: 1.15, ease: "easeInOut" },
  },
  BROADCAST_PROMO: {
    animate:    { rotate: [0, -16, 16, -9, 9, 0], scale: [1, 1.10, 1] },
    transition: { repeat: Infinity, duration: 2.4, repeatDelay: 0.5 },
  },
  BROADCAST_SORTEO: {
    animate:    { y: [0, -9, 0] },
    transition: { repeat: Infinity, duration: 1.65, ease: "easeInOut" },
  },
  BROADCAST_INFO: {
    animate:    { scale: [1, 1.09, 1] },
    transition: { repeat: Infinity, duration: 2.4, ease: "easeInOut" },
  },
  default: {
    animate:    { rotate: [0, 20, -20, 13, -13, 0] },
    transition: { repeat: Infinity, duration: 3.0, repeatDelay: 1.5 },
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PushNotifModal({ notif, onClose, onNavigate }: Props) {
  return (
    <AnimatePresence>
      {notif && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[300] bg-black/58 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[301] flex justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <SheetContent notif={notif} onClose={onClose} onNavigate={onNavigate} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── SheetContent ──────────────────────────────────────────────────────────────

function SheetContent({
  notif,
  onClose,
  onNavigate,
}: {
  notif: PushNotifData;
  onClose: () => void;
  onNavigate: (p: string) => void;
}) {
  const cfg  = TIPO_CFG[notif.tipo] ?? DEFAULT_CFG;
  const anim = ICON_ANIM[notif.tipo] ?? ICON_ANIM.default;
  const Icon = cfg.Icon;
  const hasCta = !!(notif.cta && notif.cta !== "/");

  return (
    <div className="w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl overflow-hidden">

      {/* ── Hero ── */}
      <div className="relative px-6 pt-3 pb-6" style={{ background: cfg.heroBg }}>

        {/* Drag handle row + close button */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="w-10 h-1 rounded-full bg-black/10" />
          <button
            onClick={onClose}
            className="absolute right-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: cfg.pillBg, color: cfg.color }}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Animated icon */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center"
            style={{
              background:  cfg.pillBg,
              border:      `1.5px solid ${cfg.pillBorder}`,
              boxShadow:   `0 8px 24px ${cfg.color}1A`,
            }}
          >
            <motion.div
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              animate={anim.animate as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              transition={anim.transition as any}
              style={{ color: cfg.color, display: "flex" }}
            >
              <Icon size={32} strokeWidth={1.75} />
            </motion.div>
          </div>

          {/* Badge */}
          <span
            className="text-[11px] font-bold px-3 py-1 rounded-full"
            style={{
              background: cfg.pillBg,
              color:      cfg.color,
              border:     `1px solid ${cfg.pillBorder}`,
            }}
          >
            {cfg.label}
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 pt-4 pb-8 space-y-3.5">

        {/* Title */}
        <h2 className="text-[19px] font-black text-slate-800 leading-snug">
          {notif.titulo}
        </h2>

        {/* Body */}
        <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">
          {notif.body}
        </p>

        {/* Tienda banner — solo tipos que invitan a visitar físicamente */}
        {cfg.showBanner && (
          <a
            href="https://maps.google.com/?q=Avenida+Universidad+134,+local+1,+Curauma,+Valparaíso"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl overflow-hidden border border-slate-100 active:opacity-75 transition-opacity mt-1"
          >
            <img
              src="/tienda.jpeg"
              alt="Patio Curauma Tienda"
              className="w-full object-cover"
              style={{ maxHeight: 140 }}
            />
            <div className="px-4 py-3 bg-slate-50 flex items-center gap-3">
              <span className="text-base">🏪</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800">
                  Visítanos en Patio Curauma Tienda
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  Av. Universidad #134, local 1 · Curauma
                </p>
              </div>
              <span
                className="text-[10px] font-bold shrink-0"
                style={{ color: cfg.color }}
              >
                Ver mapa →
              </span>
            </div>
          </a>
        )}

        {/* CTA */}
        {hasCta && (
          <button
            className="w-full h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 text-white transition-opacity active:opacity-80"
            style={{ background: cfg.ctaBg }}
            onClick={() => { onNavigate(notif.cta); onClose(); }}
          >
            <ExternalLink size={15} /> Ver más
          </button>
        )}

        {/* Cerrar */}
        <button
          onClick={onClose}
          className="w-full h-10 rounded-2xl text-sm font-semibold text-slate-400 hover:bg-slate-50 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
