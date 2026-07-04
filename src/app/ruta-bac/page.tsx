"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { doc, increment, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, HelpCircle, Loader2, MapPin, ExternalLink, X, Share2, Wine, Navigation,
  Album, Map as MapIcon, Zap, LocateFixed, CheckCircle2, Footprints, CloudOff, Stamp, Cloud,
} from "lucide-react";
import { useBacOfflineSync } from "@/hooks/useBacOfflineSync";
import { BacLeaderboardModal } from "@/components/bac/BacLeaderboardModal";
import { BacExpressReview } from "@/components/bac/BacExpressReview";
import {
  LOCALES_BAC, instagramUrl, localInitials, haversineMeters, formatDistance,
  type LocalBac,
} from "@/data/localesBac";

const BacMap = dynamic(() => import("@/components/bac/BacMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: "#24346c" }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#FF4B91" }} />
    </div>
  ),
});

type UserPosition = { lat: number; lng: number; accuracy?: number };
type ViewMode = "album" | "map";

// ── Palette ──────────────────────────────────────────────────────────────────
const NIGHT = "#0F1B4C";
const NIGHT_DEEP = "#0F1B4C";
const NIGHT_CARD = "#1a2b5c";
const PINK = "#FF4B91";
const CREAM = "#FDF1D6";
const YELLOW = "#FFD84D";

// Retro/funky display font (Lilita One via next/font) — used for hero copy,
// counters, promo title, main buttons and stamp labels.
const FONT_DISPLAY = "var(--font-bac-display), 'Montserrat', sans-serif";

// ── Real-time hook ───────────────────────────────────────────────────────────
function useSellosBac(userId: string | null) {
  const [sellosBac, setSellosBac] = useState<Record<string, number>>({});
  const [hasSynapTechStamp, setHasSynapTechStamp] = useState(false);
  const [hasSynapTechShared, setHasSynapTechShared] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, "usuarios", userId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setSellosBac(data.sellosBac || {});
      setHasSynapTechStamp(!!data.hasSynapTechStamp);
      setHasSynapTechShared(!!data.hasSynapTechShared);
    });
    return () => unsub();
  }, [userId]);

  return { sellosBac, hasSynapTechStamp, hasSynapTechShared };
}

// ── Stamp state ──────────────────────────────────────────────────────────────
type StampState = "inactive" | "active" | "frequent";
function getStampState(n: number): StampState {
  if (n <= 0) return "inactive";
  if (n >= 3) return "frequent";
  return "active";
}

// ── Ticket-style promo banner ────────────────────────────────────────────────
function PromoSplitCard() {
  return (
    <div
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: NIGHT_CARD,
        border: `2px solid ${PINK}`,
        boxShadow: `0 8px 32px rgba(255,75,145,0.30), inset 0 0 0 1px rgba(253,241,214,0.06)`,
        minHeight: 170,
      }}
    >
      {/* Right-side brindis illustration — full color, cropped to hide the
          "Tapas por descubrir" text at the bottom by anchoring to top + zoom */}
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 overflow-hidden pointer-events-none"
        style={{ width: "42%" }}
      >
        <Image
          src="/bac/brindis-promo.png"
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 40vw, 220px"
          style={{
            objectFit: "cover",
            objectPosition: "right top",
            transform: "scale(1.28) translateY(-8%)",
          }}
        />
      </div>
      {/* Fade from card bg into illustration for seamless blend */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 pointer-events-none"
        style={{
          width: "50%",
          background: `linear-gradient(90deg, ${NIGHT_CARD} 0%, ${NIGHT_CARD}00 45%, transparent 100%)`,
        }}
      />

      {/* Left content — 60% width */}
      <div className="relative p-5 pr-[46%] flex flex-col justify-center gap-1.5" style={{ minHeight: 170 }}>
        <div
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md self-start"
          style={{ background: `${PINK}22`, border: `1px solid ${PINK}66` }}
        >
          <span style={{ fontSize: 10, lineHeight: 1 }}>🎟️</span>
          <span
            className="text-[9px] font-black uppercase tracking-[0.22em]"
            style={{ color: CREAM }}
          >
            Promo Oficial · V.02
          </span>
        </div>

        <p
          className="font-black leading-[1.05] mt-1"
          style={{
            color: CREAM,
            fontSize: 22,
            fontFamily: FONT_DISPLAY,
            letterSpacing: "-0.01em",
          }}
        >
          🍷 1 Tapa <span style={{ opacity: 0.75 }}>+</span> 1 Cóctel
        </p>

        <p
          className="font-black leading-none"
          style={{
            color: PINK,
            fontSize: 30,
            fontFamily: FONT_DISPLAY,
            textShadow: `0 0 18px ${PINK}88`,
            letterSpacing: "-0.02em",
          }}
        >
          x $6.000{" "}
          <span
            style={{ fontSize: 13, color: CREAM, opacity: 0.6, letterSpacing: 0 }}
          >
            p/p
          </span>
        </p>

        <p
          className="text-[11px] font-bold leading-snug mt-1"
          style={{ color: CREAM, opacity: 0.75 }}
        >
          Recorre <span style={{ color: YELLOW }}>Cerro Alegre</span> y{" "}
          <span style={{ color: YELLOW }}>Concepción</span>
        </p>
      </div>
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ visited, total }: { visited: number; total: number }) {
  const pct = total > 0 ? Math.round((visited / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: CREAM, opacity: 0.7 }}>
          Locales sellados
        </span>
        <span className="text-xs font-black" style={{ color: YELLOW }}>
          {visited} / {total}
        </span>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(253,241,214,0.1)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${PINK} 0%, ${YELLOW} 100%)`,
            boxShadow: `0 0 12px ${PINK}80`,
          }}
        />
      </div>
      <p className="text-[10px] font-medium text-right" style={{ color: CREAM, opacity: 0.5 }}>
        {pct}% del pasaporte completado
      </p>
    </div>
  );
}

// ── Initial avatar (no images available) ─────────────────────────────────────
function InitialAvatar({ nombre, active }: { nombre: string; active: boolean }) {
  const initials = localInitials(nombre);
  return (
    <div
      className="w-full h-full flex items-center justify-center transition-all duration-500"
      style={{
        background: active
          ? `linear-gradient(135deg, ${PINK} 0%, #B0207D 100%)`
          : "rgba(253,241,214,0.06)",
      }}
    >
      <span
        className="font-black tracking-tight"
        style={{
          fontSize: 22,
          color: active ? CREAM : "rgba(253,241,214,0.35)",
          textShadow: active ? "0 2px 4px rgba(0,0,0,0.3)" : "none",
          fontFamily: FONT_DISPLAY,
        }}
      >
        {initials}
      </span>
    </div>
  );
}

// ── Stamp cell ───────────────────────────────────────────────────────────────
function StampCell({
  local,
  stampCount,
  onTap,
}: {
  local: LocalBac;
  stampCount: number;
  onTap: () => void;
}) {
  const state = getStampState(stampCount);
  const isFrequent = state === "frequent";
  const isActive = state === "active";
  const isInactive = state === "inactive";

  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer active:scale-[0.97] transition-transform" onClick={onTap}>
      <div
        className="w-full aspect-square rounded-2xl border-2 relative overflow-hidden transition-all duration-500"
        style={{
          borderColor: isInactive ? "rgba(253,241,214,0.2)" : isFrequent ? YELLOW : PINK,
          borderStyle: isInactive ? "dashed" : "solid",
          background: NIGHT_CARD,
          boxShadow: isFrequent
            ? `0 0 22px ${YELLOW}55, 0 2px 8px rgba(0,0,0,0.4)`
            : isActive
            ? `0 0 16px ${PINK}55, 0 2px 8px rgba(0,0,0,0.3)`
            : "none",
        }}
      >
        <div className="absolute inset-1.5 rounded-xl overflow-hidden">
          <InitialAvatar nombre={local.nombre} active={!isInactive} />
        </div>

        {!isInactive && (
          <div
            className="absolute -bottom-2 -right-2 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md"
            style={{
              background: isFrequent
                ? `linear-gradient(135deg, ${YELLOW}, #E5A800)`
                : `linear-gradient(135deg, ${PINK}, #B0207D)`,
              color: isFrequent ? NIGHT : CREAM,
            }}
          >
            {stampCount}
          </div>
        )}

        {isFrequent && (
          <div
            className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
            style={{ background: YELLOW }}
          >
            <span style={{ fontSize: 8, lineHeight: 1 }}>⭐</span>
          </div>
        )}

        <div
          className="absolute top-1 left-1 px-1.5 rounded-md font-black uppercase tracking-wide"
          style={{
            fontSize: 8,
            lineHeight: "14px",
            background: local.cerro === "Alegre" ? "rgba(255,75,145,0.85)" : "rgba(255,216,77,0.85)",
            color: local.cerro === "Alegre" ? CREAM : NIGHT,
          }}
        >
          {local.cerro === "Alegre" ? "C. Alegre" : "C. Concep."}
        </div>
      </div>

      <p
        className="text-[11px] text-center leading-tight line-clamp-2 transition-colors duration-300 tracking-wide"
        style={{
          color: isFrequent ? YELLOW : isActive ? CREAM : "rgba(253,241,214,0.4)",
          fontFamily: FONT_DISPLAY,
        }}
      >
        {local.nombre}
      </p>
    </div>
  );
}

// ── SynapTech easter egg (adapted to BAC palette) ────────────────────────────
function SynapTechStampCell({
  collected,
  shared,
  onTap,
}: {
  collected: boolean;
  shared: boolean;
  onTap: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer active:scale-95" onClick={onTap}>
      <div
        className="w-full aspect-square rounded-2xl border-2 relative overflow-hidden transition-all duration-500"
        style={
          collected
            ? {
                borderColor: "#A78BFA",
                background: "linear-gradient(135deg, #2E1F5C 0%, #1a2b5c 100%)",
                boxShadow: "0 0 22px 5px rgba(167,139,250,0.30), 0 2px 8px rgba(0,0,0,0.35)",
              }
            : {
                borderStyle: "dashed",
                borderColor: "rgba(253,241,214,0.2)",
                background: NIGHT_CARD,
              }
        }
      >
        <div className="absolute inset-3 flex items-center justify-center">
          <img
            src="/empresa.png"
            alt="SynapTech"
            className="w-full h-full object-contain transition-all duration-500"
            style={{
              filter: collected
                ? "drop-shadow(0 4px 12px rgba(167,139,250,0.55))"
                : "grayscale(100%) opacity(0.35)",
              transform: collected ? "scale(1)" : "scale(0.92)",
            }}
          />
        </div>

        {collected && (
          <div
            className="absolute -bottom-2 -right-2 text-white text-[9px] font-black px-1.5 h-5 rounded-full flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          >
            ST
          </div>
        )}
        {collected && !shared && (
          <div
            className="absolute -top-2 -right-2 text-white text-[8px] font-black px-1.5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse"
            style={{ background: "linear-gradient(135deg, #059669, #10B981)" }}
          >
            +1
          </div>
        )}
        {collected && shared && (
          <div
            className="absolute -top-2 -right-2 text-white text-[7px] font-black px-1.5 h-5 rounded-full flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg, #059669, #10B981)" }}
          >
            ✓
          </div>
        )}
        {collected && (
          <div
            className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          >
            <span style={{ fontSize: 8, lineHeight: 1 }}>✨</span>
          </div>
        )}
      </div>
      <p
        className="text-[10px] text-center font-bold leading-tight"
        style={{ color: collected ? "#A78BFA" : "rgba(253,241,214,0.4)" }}
      >
        SynapTech SpA
      </p>
    </div>
  );
}

// ── Logo rain ────────────────────────────────────────────────────────────────
function LogoRain({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  const items = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${(i * 4.7 + 2) % 94}%`,
    delay: `${(i * 0.15) % 1.6}s`,
    duration: `${1.4 + ((i * 0.11) % 1.2)}s`,
    size: 60 + ((i * 12) % 60),
  }));

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      <style>{`
        @keyframes bacLogoRainFall {
          0%   { transform: translateY(-80px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {items.map((item) => (
        <img
          key={item.id}
          src="/emp.png"
          alt=""
          style={{
            position: "absolute",
            left: item.left,
            top: 0,
            width: item.size,
            height: item.size,
            objectFit: "contain",
            animation: `bacLogoRainFall ${item.duration} ${item.delay} ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ── Sync status badge (offline queue) ───────────────────────────────────────
function SyncStatusBadge({
  pendingCount,
  status,
  isOnline,
}: {
  pendingCount: number;
  status: "idle" | "syncing" | "synced" | "error";
  isOnline: boolean;
}) {
  if (status === "idle" && pendingCount === 0 && isOnline) return null;

  if (status === "synced") {
    return (
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2 animate-in fade-in duration-200"
        style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(134,239,172,0.35)" }}
      >
        <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#6EE7B7" }} />
        <p className="text-[11px] font-black" style={{ color: "#6EE7B7" }}>
          ✓ Sincronizado con el servidor
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2"
        style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(252,165,165,0.35)" }}
      >
        <CloudOff className="w-4 h-4 shrink-0" style={{ color: "#FCA5A5" }} />
        <p className="text-[11px] font-black" style={{ color: "#FCA5A5" }}>
          Reintentando sincronización…
        </p>
      </div>
    );
  }

  if (pendingCount === 0) return null;

  const syncing = status === "syncing";
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2"
      style={{
        background: "rgba(255,216,77,0.10)",
        border: "1px dashed rgba(255,216,77,0.45)",
      }}
    >
      {syncing ? (
        <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: "#FFD84D" }} />
      ) : isOnline ? (
        <Cloud className="w-4 h-4 shrink-0" style={{ color: "#FFD84D" }} />
      ) : (
        <CloudOff className="w-4 h-4 shrink-0 animate-pulse" style={{ color: "#FFD84D" }} />
      )}
      <p className="text-[11px] font-black leading-tight" style={{ color: "#FFD84D" }}>
        {syncing
          ? `Enviando ${pendingCount} sello${pendingCount !== 1 ? "s" : ""}…`
          : `⏳ ${pendingCount} sello${pendingCount !== 1 ? "s" : ""} esperando señal para sincronizar…`}
      </p>
    </div>
  );
}

// ── Map view (canvas + floating controls) ───────────────────────────────────
function MapView({
  sellosBac,
  userPos,
  geoStatus,
  flyCounter,
  onLocalTap,
  onLocateMe,
  onOpenNearest,
}: {
  sellosBac: Record<string, number>;
  userPos: UserPosition | null;
  geoStatus: "idle" | "requesting" | "on" | "denied" | "unsupported";
  flyCounter: number;
  onLocalTap: (l: LocalBac) => void;
  onLocateMe: () => void;
  onOpenNearest: () => void;
}) {
  return (
    <div
      className="relative rounded-[2rem] overflow-hidden bg-[#24346c]"
      style={{
        border: "1px solid rgba(255,75,145,0.35)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(253,241,214,0.06)",
        height: "70vh",
        minHeight: 480,
      }}
    >
      <BacMap
        sellosBac={sellosBac}
        userPos={userPos}
        onLocalTap={onLocalTap}
        flyToUser={flyCounter}
      />

      {/* Locate me */}
      <button
        onClick={onLocateMe}
        aria-label="Ver mi ubicación"
        className="absolute bottom-4 right-4 z-[500] w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90"
        style={{
          background: geoStatus === "on"
            ? `linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)`
            : `linear-gradient(135deg, ${NIGHT_CARD} 0%, ${NIGHT} 100%)`,
          border: `2px solid ${geoStatus === "on" ? "#60A5FA" : PINK}`,
          boxShadow: geoStatus === "on"
            ? "0 4px 14px rgba(59,130,246,0.5)"
            : `0 4px 14px ${PINK}55`,
          color: CREAM,
        }}
      >
        {geoStatus === "requesting" ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <LocateFixed className="w-5 h-5" />
        )}
      </button>

      {/* Ver más cercanos */}
      <button
        onClick={onOpenNearest}
        className="absolute bottom-4 left-4 z-[500] h-11 px-4 rounded-full flex items-center gap-2 font-black text-[12px] transition-all active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${PINK} 0%, #B0207D 100%)`,
          color: CREAM,
          boxShadow: `0 6px 18px ${PINK}66`,
        }}
      >
        <Zap className="w-4 h-4" />
        Más cercanos a mí
      </button>

      {geoStatus === "denied" && (
        <div
          className="absolute top-3 left-3 right-3 z-[500] rounded-xl px-3 py-2 text-[11px] font-bold flex items-center gap-2"
          style={{ background: "rgba(220,38,38,0.9)", color: "#fff" }}
        >
          <MapPin className="w-3.5 h-3.5" />
          Habilita la ubicación en tu navegador para verte en el mapa.
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
type CerroFilter = "todos" | "Alegre" | "Concepción";

export default function RutaBacPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("album");
  const [cerroFilter, setCerroFilter] = useState<CerroFilter>("todos");
  const [selectedLocal, setSelectedLocal] = useState<LocalBac | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showSynapModal, setShowSynapModal] = useState<"invite" | "thanks" | null>(null);
  const [showLogoRain, setShowLogoRain] = useState(false);
  const [showNearest, setShowNearest] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showReviewForLocal, setShowReviewForLocal] = useState<LocalBac | null>(null);
  const [showBenefits, setShowBenefits] = useState(false);

  const [userPos, setUserPos] = useState<UserPosition | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "on" | "denied" | "unsupported">("idle");
  const [flyCounter, setFlyCounter] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  const { sellosBac: remoteSellosBac, hasSynapTechStamp, hasSynapTechShared } = useSellosBac(userId);
  const offline = useBacOfflineSync(userId);

  // Optimistic merge: Firestore truth + pending queue counts.
  const sellosBac = useMemo(() => {
    const merged: Record<string, number> = { ...remoteSellosBac };
    for (const id of offline.pending) {
      merged[id] = (merged[id] || 0) + 1;
    }
    return merged;
  }, [remoteSellosBac, offline.pending]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/?login=true&redirect=/ruta-bac");
        return;
      }
      setUserId(user.uid);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const visitedBacCount = useMemo(
    () => LOCALES_BAC.filter((l) => (sellosBac[l.id] || 0) > 0).length,
    [sellosBac]
  );

  const visitedByCerro = useMemo(() => {
    let alegre = 0;
    let concep = 0;
    for (const l of LOCALES_BAC) {
      if ((sellosBac[l.id] || 0) > 0) {
        if (l.cerro === "Alegre") alegre++;
        else concep++;
      }
    }
    return { alegre, concep };
  }, [sellosBac]);

  const motivationMessage = useMemo(() => {
    const n = visitedBacCount;
    const total = LOCALES_BAC.length;
    if (n === 0) return { emoji: "🍷", text: "¡Empieza tu ruta! Escanea tu primer QR." };
    if (n === total) return { emoji: "👑", text: "¡Pasaporte completo! Eres leyenda BAC." };
    if (n >= total - 3) return { emoji: "🏆", text: `¡Casi lo tienes! Faltan ${total - n} paradas.` };
    if (n >= 13) return { emoji: "🔥", text: "¡En racha! Catador oficial de BAC." };
    if (n >= 6) {
      const dominante = visitedByCerro.alegre > visitedByCerro.concep ? "Cerro Alegre" : "Cerro Concepción";
      return { emoji: "🌟", text: `¡Buen ritmo! Dominando ${dominante}.` };
    }
    const primerCerro = visitedByCerro.alegre >= visitedByCerro.concep ? "Cerro Alegre" : "Cerro Concepción";
    return { emoji: "📍", text: `¡Estás iniciando tu ruta en ${primerCerro}!` };
  }, [visitedBacCount, visitedByCerro]);

  const filteredLocales = useMemo(
    () => (cerroFilter === "todos" ? LOCALES_BAC : LOCALES_BAC.filter((l) => l.cerro === cerroFilter)),
    [cerroFilter]
  );

  const countAlegre = useMemo(() => LOCALES_BAC.filter((l) => l.cerro === "Alegre").length, []);
  const countConcep = useMemo(() => LOCALES_BAC.filter((l) => l.cerro === "Concepción").length, []);

  const visitedCount = useMemo(
    () => LOCALES_BAC.filter((l) => (sellosBac[l.id] || 0) > 0).length + (hasSynapTechStamp ? 1 : 0),
    [sellosBac, hasSynapTechStamp]
  );

  // Cleanup geolocation watcher on unmount.
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const enableGeolocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unsupported");
      toast({ title: "GPS no disponible en este dispositivo", variant: "destructive" });
      return;
    }
    if (watchIdRef.current !== null) {
      // Already watching — just recenter.
      setFlyCounter((c) => c + 1);
      return;
    }
    setGeoStatus("requesting");
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGeoStatus("on");
      },
      (err) => {
        setGeoStatus(err.code === err.PERMISSION_DENIED ? "denied" : "idle");
        toast({
          title: err.code === err.PERMISSION_DENIED ? "Permiso de ubicación denegado" : "No se pudo obtener tu ubicación",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );
    watchIdRef.current = id;
    setFlyCounter((c) => c + 1);
  };

  const localesByDistance = useMemo(() => {
    if (!userPos) return [] as { local: LocalBac; meters: number }[];
    return LOCALES_BAC
      .map((local) => ({ local, meters: haversineMeters(userPos, local) }))
      .sort((a, b) => a.meters - b.meters);
  }, [userPos]);

  const handleOpenNearest = () => {
    if (!userPos) {
      enableGeolocation();
      toast({ title: "Activando GPS…", description: "Autoriza la ubicación para ver los locales más cercanos." });
    } else {
      setShowNearest(true);
    }
  };

  const handleRegisterStamp = async (local: LocalBac) => {
    if (!userId) return;
    const finish = () => {
      setSelectedLocal(null);
      setShowReviewForLocal(local);
    };
    const offlineToast = () =>
      toast({
        title: "⚡ Sello guardado en el teléfono",
        description: "Se sincronizará automáticamente al salir a la calle.",
      });
    const successToast = () =>
      toast({
        title: `¡Sello agregado! ${local.nombre}`,
        description: "1 Tapa + 1 Cóctel — registrada en el pasaporte.",
      });

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      offline.enqueue(local.id);
      offlineToast();
      finish();
      return;
    }

    try {
      const userRef = doc(db, "usuarios", userId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        const cur = ((snap.exists() ? snap.data()?.sellosBac : {}) || {}) as Record<string, number>;
        const isNewVisit = !(cur[local.id] > 0);
        const updates: Record<string, unknown> = {
          [`sellosBac.${local.id}`]: increment(1),
        };
        if (isNewVisit) updates.bacStampsCount = increment(1);
        if (snap.exists()) tx.update(userRef, updates as never);
        else tx.set(userRef, updates as never);
      });
      successToast();
      finish();
    } catch (err: unknown) {
      // Any network-side failure → fall back to the local queue.
      offline.enqueue(local.id);
      offlineToast();
      finish();
    }
  };

  const handleVisitSynapTech = () => {
    window.open("https://synaptechspa.cl", "_blank", "noopener,noreferrer");
    setShowSynapModal(null);
    setShowLogoRain(true);
    if (userId) {
      updateDoc(doc(db, "usuarios", userId), { hasSynapTechStamp: true }).catch(() => {});
    }
  };

  const handleShareSynapTech = async () => {
    if (!userId || hasSynapTechShared) return;
    try {
      await navigator.share({
        title: "Ruta BAC · Tapas & Copas V.02",
        text: "Descubrí el pasaporte digital de @BarrioAlegreConce hecho por @SynapTechSpA 🍷🚀",
        url: "https://synaptechspa.cl",
      });
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast({ title: "No se pudo compartir", variant: "destructive" });
      }
      return;
    }

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sin sesión activa.");
      const res = await fetch("/api/synaptech/share-bonus", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo acreditar el sello.");
      toast({ title: "¡+1 Sello ganado!", description: "Gracias por compartir SynapTech 🚀" });
      setShowSynapModal(null);
      setShowLogoRain(true);
    } catch (err: any) {
      toast({
        title: "No se pudo acreditar el sello",
        description: err?.message ?? "Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: NIGHT }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: PINK }} />
      </div>
    );
  }

  return (
    <main
      className="min-h-screen pb-24 font-sans animate-in slide-in-from-right duration-300"
      style={{ background: NIGHT, color: CREAM }}
    >
      {/* Header */}
      <div
        className="border-b p-5 sticky top-0 z-10 flex items-center gap-3 backdrop-blur"
        style={{ background: `${NIGHT}dd`, borderColor: "rgba(255,75,145,0.25)" }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="shrink-0 hover:bg-white/5"
          style={{ color: CREAM }}
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex-1" aria-hidden />
        <span className="sr-only">Ruta BAC — Tapas & Copas V.02</span>
        <button
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors shrink-0"
          style={{ color: CREAM, background: "rgba(253,241,214,0.08)" }}
          aria-label="¿Cómo funciona?"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="hidden sm:inline">¿Cómo funciona?</span>
        </button>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Hero logo — wrapped in soft gradient "sticker" container */}
        <div
          className="relative w-full flex justify-center p-3 rounded-3xl"
          style={{
            background: `radial-gradient(ellipse at center, ${NIGHT_CARD} 0%, transparent 75%)`,
            boxShadow: `0 0 40px rgba(255,75,145,0.20)`,
          }}
        >
          <Image
            src="/bac/logo-tapas-copas.png"
            alt="Tapas & Copas Valparaíso V.02"
            width={320}
            height={140}
            priority
            className="w-auto h-24 md:h-28 object-contain relative z-10"
            style={{
              filter: "drop-shadow(0 0 22px rgba(255,75,145,0.55)) drop-shadow(0 6px 14px rgba(0,0,0,0.55))",
            }}
          />
        </div>

        {/* Split promo card */}
        <PromoSplitCard />

        {/* Leaderboard CTA */}
        <button
          onClick={() => setShowLeaderboard(true)}
          className="relative w-full h-13 rounded-2xl flex items-center justify-center gap-2 font-black transition-all active:scale-[0.98] overflow-hidden"
          style={{
            height: 52,
            background: `linear-gradient(135deg, ${PINK} 0%, #B0207D 50%, ${PINK} 100%)`,
            color: CREAM,
            border: `2px solid ${YELLOW}`,
            boxShadow: `0 8px 24px ${PINK}55, inset 0 0 0 1px ${CREAM}`,
            fontFamily: FONT_DISPLAY,
          }}
        >
          <span
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              animation: "bacRankPulse 1.8s ease-out infinite",
              boxShadow: `0 0 0 0 ${PINK}`,
            }}
          />
          <style>{`
            @keyframes bacRankPulse {
              0%   { box-shadow: 0 0 0 0 ${PINK}88; }
              70%  { box-shadow: 0 0 0 14px ${PINK}00; }
              100% { box-shadow: 0 0 0 0 ${PINK}00; }
            }
          `}</style>
          <span style={{ fontSize: 18, lineHeight: 1 }}>🏆</span>
          <span className="text-[15px] tracking-wide" style={{ fontFamily: FONT_DISPLAY }}>
            Top Exploradores · Ranking en Vivo
          </span>
          <span style={{ fontSize: 18, lineHeight: 1 }}>👑</span>
        </button>

        {/* Benefits banner CTA */}
        <button
          onClick={() => setShowBenefits(true)}
          className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all active:scale-[0.98]"
          style={{
            background: `linear-gradient(135deg, ${CREAM} 0%, #F7E7A8 50%, ${YELLOW} 100%)`,
            border: `2px solid ${PINK}`,
            boxShadow: `0 8px 22px rgba(255,75,145,0.35), inset 0 0 0 1px rgba(255,75,145,0.4)`,
          }}
        >
          <span
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: NIGHT, boxShadow: `0 0 0 2px ${PINK}` }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>🎁</span>
          </span>
          <div className="flex-1 text-left min-w-0">
            <p
              className="text-[9px] font-black uppercase tracking-[0.22em]"
              style={{ color: PINK }}
            >
              Beneficios exclusivos V.02
            </p>
            <p
              className="text-[14px] font-black leading-tight mt-0.5"
              style={{ color: NIGHT, fontFamily: FONT_DISPLAY }}
            >
              Estacionamiento, Taxis y Hospedaje
            </p>
            <p className="text-[10px] font-bold mt-0.5" style={{ color: NIGHT, opacity: 0.7 }}>
              Muéstralos en la calle desde tu pantalla
            </p>
          </div>
          <span
            className="text-lg font-black shrink-0"
            style={{ color: PINK }}
          >
            →
          </span>
        </button>

        {/* View mode toggle */}
        <div
          className="grid grid-cols-2 rounded-2xl p-1"
          style={{
            background: NIGHT_CARD,
            border: "1px solid rgba(255,75,145,0.2)",
          }}
        >
          {([
            { key: "album", label: "Álbum de Sellos", icon: <Album className="w-4 h-4" /> },
            { key: "map", label: "Mapa Nocturno", icon: <MapIcon className="w-4 h-4" /> },
          ] as { key: ViewMode; label: string; icon: ReactNode }[]).map((tab) => {
            const active = viewMode === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className="h-11 rounded-xl text-[13px] transition-all flex items-center justify-center gap-2 tracking-wide"
                style={
                  active
                    ? {
                        background: `linear-gradient(135deg, ${PINK} 0%, #B0207D 100%)`,
                        color: CREAM,
                        boxShadow: `0 4px 14px ${PINK}55`,
                        fontFamily: FONT_DISPLAY,
                      }
                    : { background: "transparent", color: "rgba(253,241,214,0.6)", fontFamily: FONT_DISPLAY }
                }
              >
                {tab.key === "album" ? "🏁" : "🗺️"} {tab.label}
              </button>
            );
          })}
        </div>

        {viewMode === "map" && (
          <MapView
            sellosBac={sellosBac}
            userPos={userPos}
            geoStatus={geoStatus}
            flyCounter={flyCounter}
            onLocalTap={setSelectedLocal}
            onLocateMe={enableGeolocation}
            onOpenNearest={handleOpenNearest}
          />
        )}

        {viewMode === "album" && (
          <>
        {/* Progress card */}
        <div
          className="rounded-[2rem] p-5 space-y-4"
          style={{
            background: NIGHT_CARD,
            border: "1px solid rgba(255,75,145,0.25)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,75,145,0.15)" }}
            >
              <MapPin className="w-5 h-5" style={{ color: PINK }} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-black" style={{ color: CREAM }}>
                Pasaporte Tapas & Copas
              </h2>
              <p className="text-[11px] font-medium" style={{ color: CREAM, opacity: 0.55 }}>
                Sella tu paso por cada local participante
              </p>
            </div>
          </div>

          <SyncStatusBadge
            pendingCount={offline.pendingCount}
            status={offline.status}
            isOnline={offline.isOnline}
          />

          {/* Giant counter */}
          <div className="flex items-end justify-center gap-2 pt-2 pb-1">
            <span
              className="font-black leading-none"
              style={{
                fontSize: 72,
                background: `linear-gradient(180deg, ${CREAM} 0%, ${YELLOW} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: `0 0 24px ${PINK}55`,
                fontFamily: FONT_DISPLAY,
                letterSpacing: "-0.03em",
              }}
            >
              {visitedBacCount}
            </span>
            <div className="pb-2 flex flex-col items-start leading-none">
              <span
                className="text-2xl"
                style={{ color: "rgba(253,241,214,0.5)", fontFamily: FONT_DISPLAY, letterSpacing: "-0.01em" }}
              >
                / {LOCALES_BAC.length}
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.22em] mt-1.5"
                style={{ color: PINK, fontFamily: FONT_DISPLAY }}
              >
                Descubiertos
              </span>
            </div>
          </div>

          {/* Motivation message */}
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: "rgba(255,75,145,0.08)", border: "1px dashed rgba(255,75,145,0.35)" }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{motivationMessage.emoji}</span>
            <p className="text-[12px] font-bold leading-snug" style={{ color: CREAM }}>
              {motivationMessage.text}
            </p>
          </div>

          <ProgressBar visited={visitedCount} total={LOCALES_BAC.length + 1} />
        </div>

        {/* Rewards teaser */}
        <div
          className="rounded-2xl p-4 flex gap-3 items-start"
          style={{
            background: "linear-gradient(135deg, rgba(255,216,77,0.10) 0%, rgba(255,75,145,0.10) 100%)",
            border: "1px solid rgba(255,216,77,0.3)",
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1, marginTop: 2 }}>🏆</span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: YELLOW }}>
              Próximamente
            </p>
            <p className="text-sm font-bold leading-snug mt-0.5" style={{ color: CREAM }}>
              Premios especiales para los sellos completos
            </p>
            <p className="text-[12px] leading-relaxed mt-1" style={{ color: CREAM, opacity: 0.65 }}>
              Completar la Ruta BAC te dará acceso a sorteos y beneficios exclusivos del evento.
            </p>
          </div>
        </div>

        {/* Cerro filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {([
            { key: "todos", label: `Todos · ${LOCALES_BAC.length}` },
            { key: "Alegre", label: `📍 Cerro Alegre · ${countAlegre}` },
            { key: "Concepción", label: `📍 Cerro Concepción · ${countConcep}` },
          ] as { key: CerroFilter; label: string }[]).map((chip) => {
            const active = cerroFilter === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => setCerroFilter(chip.key)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black transition-all border"
                style={
                  active
                    ? { background: PINK, borderColor: PINK, color: CREAM, boxShadow: `0 0 14px ${PINK}66` }
                    : { background: "rgba(253,241,214,0.06)", borderColor: "rgba(253,241,214,0.15)", color: CREAM }
                }
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 text-[9px] font-black uppercase tracking-widest" style={{ color: CREAM, opacity: 0.5 }}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: "rgba(253,241,214,0.2)" }} />
            Sin sellar
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: PINK }} />
            Sellado
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: YELLOW }} />
            Frecuente 3+
          </div>
        </div>

        {/* Stamp grid */}
        <div className="grid grid-cols-3 gap-4">
          {filteredLocales.map((local) => (
            <StampCell
              key={local.id}
              local={local}
              stampCount={sellosBac[local.id] || 0}
              onTap={() => setSelectedLocal(local)}
            />
          ))}

          {cerroFilter === "todos" && (
            <SynapTechStampCell
              collected={hasSynapTechStamp}
              shared={hasSynapTechShared}
              onTap={() => {
                if (hasSynapTechStamp) {
                  setShowLogoRain(true);
                  setShowSynapModal("thanks");
                } else {
                  setShowSynapModal("invite");
                }
              }}
            />
          )}
        </div>
          </>
        )}
      </div>

      {showLogoRain && <LogoRain onDone={() => setShowLogoRain(false)} />}

      {/* Info modal */}
      {showInfo && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-5 animate-in fade-in duration-200"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
            style={{ background: NIGHT_CARD, border: `1px solid ${PINK}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-7 pt-8 pb-6"
              style={{ background: `linear-gradient(135deg, ${PINK}22 0%, ${YELLOW}11 100%)` }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: "rgba(255,75,145,0.18)" }}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }}>🍷</span>
              </div>
              <h2 className="text-xl font-black leading-snug" style={{ color: CREAM }}>
                Tu pasaporte<br />Tapas & Copas
              </h2>
            </div>

            <div className="px-7 py-6 space-y-4">
              <div className="flex gap-3">
                <span className="text-xl shrink-0 mt-0.5">⭐</span>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(253,241,214,0.85)" }}>
                  Cada vez que consumes la promo <span className="font-bold" style={{ color: PINK }}>1 Tapa + 1 Cóctel</span> en un local participante y escaneas su QR, su estampilla se ilumina en rosa neón.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="text-xl shrink-0 mt-0.5">🏆</span>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(253,241,214,0.85)" }}>
                  <span className="font-bold" style={{ color: CREAM }}>El reto:</span> recorre Cerro Alegre y Cerro Concepción, junta el máximo de sellos posibles y accede a beneficios exclusivos del evento.
                </p>
              </div>
              <div
                className="flex gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,216,77,0.08)", border: "1px solid rgba(255,216,77,0.3)" }}
              >
                <span className="text-base shrink-0 mt-0.5">💡</span>
                <p className="text-[12px] leading-relaxed" style={{ color: "rgba(253,241,214,0.75)" }}>
                  Toca cualquier estampilla en gris para ver su Instagram y agregarla a tu itinerario.
                </p>
              </div>
            </div>

            <div className="px-7 pb-7">
              <button
                onClick={() => setShowInfo(false)}
                className="w-full h-12 rounded-2xl font-black text-sm transition-all active:scale-[0.97]"
                style={{
                  background: `linear-gradient(135deg, ${PINK} 0%, #B0207D 100%)`,
                  color: CREAM,
                  boxShadow: `0 8px 24px ${PINK}55`,
                }}
              >
                ¡A recorrer! 🍷
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local detail sheet */}
      {selectedLocal && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedLocal(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-[2rem] shadow-2xl p-7 space-y-5 animate-in slide-in-from-bottom-4 duration-300"
            style={{ background: NIGHT_CARD, borderTop: `2px solid ${PINK}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: "rgba(253,241,214,0.25)" }} />

            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden shrink-0"
                style={{
                  border: `2px solid ${PINK}`,
                  boxShadow: `0 0 18px ${PINK}55`,
                }}
              >
                <InitialAvatar nombre={selectedLocal.nombre} active={true} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: PINK }}>
                  Cerro {selectedLocal.cerro} · {selectedLocal.categoria}
                </p>
                <h3 className="text-lg font-black truncate" style={{ color: CREAM }}>
                  {selectedLocal.nombre}
                </h3>
                <p className="text-[11px] font-medium truncate" style={{ color: CREAM, opacity: 0.6 }}>
                  📍 {selectedLocal.direccion} · {selectedLocal.instagram}
                </p>
              </div>
            </div>

            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={{
                background: `linear-gradient(135deg, ${CREAM} 0%, #F7E7A8 100%)`,
              }}
            >
              <Wine className="w-6 h-6 shrink-0" style={{ color: PINK }} />
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: PINK }}>
                  Promo oficial
                </p>
                <p className="text-sm font-black leading-tight" style={{ color: NIGHT }}>
                  {selectedLocal.promoText} <span style={{ opacity: 0.6 }}>p/p</span>
                </p>
              </div>
            </div>

            {(sellosBac[selectedLocal.id] || 0) === 0 ? (
              <p className="text-sm font-medium leading-relaxed" style={{ color: "rgba(253,241,214,0.7)" }}>
                Aún no has sellado este local.{" "}
                <span className="font-black" style={{ color: CREAM }}>
                  Escanea el QR del mostrador tras consumir la promo para desbloquear la estampilla.
                </span>
              </p>
            ) : (
              <p className="text-sm font-medium leading-relaxed" style={{ color: "rgba(253,241,214,0.7)" }}>
                Sellos acumulados:{" "}
                <span className="font-black" style={{ color: YELLOW }}>
                  {sellosBac[selectedLocal.id]}
                </span>
                . ¡Sigue sumando visitas al pasaporte!
              </p>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => handleRegisterStamp(selectedLocal)}
                className="w-full h-13 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                style={{
                  height: 52,
                  background: `linear-gradient(135deg, ${CREAM} 0%, ${YELLOW} 100%)`,
                  color: NIGHT,
                  boxShadow: `0 8px 24px rgba(253,241,214,0.35), inset 0 0 0 2px ${PINK}`,
                  fontFamily: FONT_DISPLAY,
                }}
              >
                <Stamp className="w-5 h-5" />
                {(sellosBac[selectedLocal.id] || 0) === 0 ? "Sellar visita · +1" : "Sellar otra visita · +1"}
                {!offline.isOnline && (
                  <span
                    className="ml-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: NIGHT, color: YELLOW }}
                  >
                    Offline
                  </span>
                )}
              </button>
              <div className="flex gap-2.5">
                <a
                  href={instagramUrl(selectedLocal.instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-12 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                  style={{
                    background: `linear-gradient(135deg, ${PINK} 0%, #B0207D 100%)`,
                    color: CREAM,
                    boxShadow: `0 8px 20px ${PINK}55`,
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                  Instagram
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${selectedLocal.lat},${selectedLocal.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-12 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                  style={{
                    background: `linear-gradient(135deg, ${YELLOW} 0%, #E5A800 100%)`,
                    color: NIGHT,
                    boxShadow: `0 8px 20px ${YELLOW}55`,
                  }}
                >
                  <Footprints className="w-4 h-4" />
                  Cómo llegar
                </a>
              </div>
              <Button
                variant="outline"
                onClick={() => setSelectedLocal(null)}
                className="h-11 w-full rounded-2xl border-0 font-bold text-[13px]"
                style={{ background: "rgba(253,241,214,0.08)", color: CREAM }}
              >
                <X className="w-4 h-4 mr-1" />
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SynapTech invite modal */}
      {showSynapModal === "invite" && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-5 animate-in fade-in duration-200"
          onClick={() => setShowSynapModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
            style={{ background: NIGHT_CARD, border: "1px solid #7C3AED" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-7 pt-8 pb-6"
              style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(79,70,229,0.12) 100%)" }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 p-2"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", boxShadow: "0 8px 20px rgba(124,58,237,0.4)" }}
              >
                <img src="/empresa.png" alt="SynapTech" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-xl font-black leading-snug" style={{ color: CREAM }}>
                ¿Te gusta este pasaporte? 🚀
              </h2>
            </div>

            <div className="px-7 py-6">
              <p className="text-sm leading-relaxed" style={{ color: "rgba(253,241,214,0.85)" }}>
                Esta plataforma fue diseñada por{" "}
                <span className="font-bold" style={{ color: "#A78BFA" }}>SynapTech SpA</span>. Ayudamos a barrios y emprendedores a digitalizar sus eventos con tecnología de punta.{" "}
                Visita nuestra web y obtén esta estampilla especial de regalo.
              </p>
            </div>

            <div className="px-7 pb-8 flex flex-col gap-3">
              <button
                onClick={handleVisitSynapTech}
                className="w-full rounded-2xl font-black text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                style={{
                  height: 52,
                  background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
                  color: CREAM,
                  boxShadow: "0 8px 24px rgba(124,58,237,0.40)",
                }}
              >
                Visitar synaptechspa.cl ↗
              </button>
              <button
                onClick={() => setShowSynapModal(null)}
                className="w-full h-11 rounded-2xl font-bold text-sm"
                style={{ color: "rgba(253,241,214,0.4)" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SynapTech thanks modal */}
      {showSynapModal === "thanks" && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowSynapModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-[2rem] shadow-2xl p-7 space-y-5 animate-in slide-in-from-bottom-4 duration-300"
            style={{ background: NIGHT_CARD, borderTop: "2px solid #7C3AED" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: "rgba(253,241,214,0.25)" }} />

            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg p-2.5"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
              >
                <img src="/empresa.png" alt="SynapTech" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#A78BFA" }}>
                  Estampilla Especial · Coleccionada ✨
                </p>
                <h3 className="text-lg font-black" style={{ color: CREAM }}>SynapTech SpA</h3>
              </div>
            </div>

            <p className="text-sm leading-relaxed" style={{ color: "rgba(253,241,214,0.75)" }}>
              ¿Ya viste las últimas novedades? En{" "}
              <span className="font-bold" style={{ color: "#A78BFA" }}>synaptechspa.cl</span>{" "}
              encontrarás soluciones digitales para llevar tu negocio al siguiente nivel.
            </p>

            {!hasSynapTechShared && (
              <div
                className="rounded-2xl p-4 space-y-2"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(134,239,172,0.35)" }}
              >
                <p className="text-xs font-black uppercase tracking-wide" style={{ color: "#6EE7B7" }}>
                  🎁 Sello extra disponible
                </p>
                <p className="text-sm leading-snug" style={{ color: "rgba(220,252,231,0.9)" }}>
                  Comparte SynapTech y gana <span className="font-bold">+1 sello</span> en tu tarjeta de fidelidad.
                </p>
                <button
                  onClick={handleShareSynapTech}
                  className="w-full rounded-xl font-black text-sm text-white transition-all active:scale-[0.97] flex items-center justify-center gap-2 mt-1"
                  style={{ height: 44, background: "linear-gradient(135deg, #059669 0%, #10B981 100%)", boxShadow: "0 4px 14px rgba(5,150,105,0.35)" }}
                >
                  <Share2 className="w-4 h-4" />
                  Compartir · +1 Sello
                </button>
              </div>
            )}

            {hasSynapTechShared && (
              <div
                className="rounded-2xl p-3 flex items-center gap-3"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(134,239,172,0.35)" }}
              >
                <span className="text-lg">✅</span>
                <p className="text-sm font-bold" style={{ color: "#6EE7B7" }}>
                  ¡Ya compartiste! Sello extra obtenido.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  window.open("https://synaptechspa.cl", "_blank", "noopener,noreferrer");
                  setShowSynapModal(null);
                }}
                className="w-full rounded-2xl font-black text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                style={{ height: 52, background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", color: CREAM, boxShadow: "0 8px 24px rgba(124,58,237,0.35)" }}
              >
                Visitar synaptechspa.cl ↗
              </button>
              <button
                onClick={() => setShowSynapModal(null)}
                className="w-full h-11 rounded-2xl font-bold text-sm"
                style={{ color: "rgba(253,241,214,0.4)" }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard modal */}
      {showLeaderboard && userId && (
        <BacLeaderboardModal currentUid={userId} onClose={() => setShowLeaderboard(false)} />
      )}

      {/* Benefits & Logistics modal (full-screen reader) */}
      {showBenefits && (
        <div
          className="fixed inset-0 z-[9999] flex items-stretch justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowBenefits(false)}
        >
          <div
            className="w-full h-full sm:max-w-xl sm:h-auto sm:my-4 sm:rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col"
            style={{
              background: NIGHT_CARD,
              border: `1px solid ${PINK}55`,
              maxHeight: "100vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Compact header */}
            <div
              className="px-5 py-3 flex items-center gap-3 border-b shrink-0"
              style={{ borderColor: "rgba(255,75,145,0.25)", background: NIGHT_DEEP }}
            >
              <span style={{ fontSize: 20 }}>🎁</span>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: PINK }}>
                  Beneficios V.02 · Muéstralos en la calle
                </p>
                <h3
                  className="text-[13px] font-black leading-tight"
                  style={{ color: CREAM, fontFamily: FONT_DISPLAY }}
                >
                  Estacionamiento · Taxis · Hospedaje
                </h3>
              </div>
              <button
                onClick={() => setShowBenefits(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(253,241,214,0.08)", color: CREAM }}
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Full-bleed graphic on cream backdrop for maximum readability */}
            <div className="flex-1 overflow-auto" style={{ background: CREAM }}>
              <div className="p-3 sm:p-5 flex items-center justify-center min-h-full">
                <Image
                  src="/bac/beneficios-logistica.png"
                  alt="Beneficios logísticos: hospedaje, estacionamiento Sotomayor y taxis Aníbal Pinto"
                  width={1200}
                  height={1600}
                  className="w-full h-auto max-w-full"
                  style={{ objectFit: "contain" }}
                  priority
                />
              </div>
            </div>

            {/* Sticky footer with action */}
            <div
              className="p-4 shrink-0 space-y-2.5"
              style={{ background: NIGHT_DEEP, borderTop: "1px solid rgba(255,75,145,0.25)" }}
            >
              <a
                href="https://www.google.com/maps/search/?api=1&query=Estacionamiento+Sotomayor+Valpara%C3%ADso"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                style={{
                  background: `linear-gradient(135deg, ${YELLOW} 0%, #E5A800 100%)`,
                  color: NIGHT,
                  boxShadow: `0 6px 18px ${YELLOW}55`,
                }}
              >
                <MapPin className="w-4 h-4" />
                📍 Cómo llegar al Estacionamiento Sotomayor
              </a>
              <button
                onClick={() => setShowBenefits(false)}
                className="w-full h-10 rounded-2xl font-bold text-[12px]"
                style={{ background: "rgba(253,241,214,0.08)", color: CREAM }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Express review — Termómetro BAC */}
      {showReviewForLocal && userId && (
        <BacExpressReview
          uid={userId}
          localId={showReviewForLocal.id}
          localNombre={showReviewForLocal.nombre}
          onDone={() => setShowReviewForLocal(null)}
        />
      )}

      {/* Nearest sheet */}
      {showNearest && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowNearest(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
            style={{ background: NIGHT_CARD, borderTop: `2px solid ${PINK}`, maxHeight: "82vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b" style={{ borderColor: "rgba(255,75,145,0.2)" }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "rgba(253,241,214,0.25)" }} />
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,75,145,0.18)" }}
                >
                  <Zap className="w-5 h-5" style={{ color: PINK }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: PINK }}>
                    A pie desde tu ubicación
                  </p>
                  <h3 className="text-lg font-black leading-tight" style={{ color: CREAM }}>
                    Locales más cercanos
                  </h3>
                </div>
                <button
                  onClick={() => setShowNearest(false)}
                  className="ml-auto w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(253,241,214,0.08)", color: CREAM }}
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 divide-y" style={{ borderColor: "rgba(253,241,214,0.06)" }}>
              {localesByDistance.map(({ local, meters }, idx) => {
                const visited = (sellosBac[local.id] || 0) > 0;
                return (
                  <button
                    key={local.id}
                    onClick={() => {
                      setShowNearest(false);
                      setSelectedLocal(local);
                    }}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors active:bg-white/5"
                    style={{ borderColor: "rgba(253,241,214,0.06)" }}
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                      style={{
                        background: idx < 3 ? PINK : "rgba(253,241,214,0.08)",
                        color: idx < 3 ? CREAM : "rgba(253,241,214,0.55)",
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-black truncate" style={{ color: CREAM }}>
                          {local.nombre}
                        </p>
                        {visited && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: YELLOW }} />}
                      </div>
                      <p className="text-[11px] font-medium truncate" style={{ color: CREAM, opacity: 0.55 }}>
                        Cerro {local.cerro} · {local.direccion}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black" style={{ color: YELLOW }}>
                        {formatDistance(meters)}
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: CREAM, opacity: 0.4 }}>
                        A pie
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
