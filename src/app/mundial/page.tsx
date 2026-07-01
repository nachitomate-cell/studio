"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowLeft, Crown, Loader2, Lock, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const COSTO_PASE_LIBRE = 3;

// Códigos ISO 3166-1 alpha-2 para FlagCDN. Los emojis en `banderaA/B` del
// documento del partido se ignoran en el render: Windows/Chrome no renderiza
// bien varios (Inglaterra, Bosnia, RD Congo). Fallback 'un' = bandera ONU.
const flagCodes: Record<string, string> = {
  "Argentina": "ar", "Francia": "fr", "Brasil": "br", "España": "es",
  "Inglaterra": "gb-eng", "RD Congo": "cd", "Bélgica": "be", "Senegal": "sn",
  "Estados Unidos": "us", "Bosnia y Herz.": "ba", "Austria": "at",
  "Portugal": "pt", "Croacia": "hr", "Suiza": "ch", "Argelia": "dz",
  "Australia": "au", "Egipto": "eg", "Cabo Verde": "cv", "Colombia": "co",
  "Ghana": "gh", "Canadá": "ca", "Marruecos": "ma", "Paraguay": "py",
  "Noruega": "no", "México": "mx", "Ecuador": "ec",
};

function flagUrl(equipo: string): string {
  const iso = flagCodes[equipo] || "un";
  return `https://flagcdn.com/w80/${iso}.png`;
}

type Partido = {
  id: string;
  equipoA: string;
  equipoB: string;
  banderaA?: string;
  banderaB?: string;
  fase?: string;
  fechaInicio: Timestamp;
  finalizado?: boolean;
  golesA?: number;
  golesB?: number;
};

type Pronostico = {
  id: string;
  partidoId: string;
  golesA: number;
  golesB: number;
  resuelto?: boolean;
  sellosGanados?: number;
};

type Top5Row = {
  uid: string;
  nombre: string;
  mundialPuntos: number;
};

type Ranking = {
  totalJugadores: number;
  top5: Top5Row[];
};

function formatFecha(ts: Timestamp): string {
  const d = ts.toDate();
  return d.toLocaleString("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MundialPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [sellos, setSellos] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [mundialPuntos, setMundialPuntos] = useState(0);
  const [userNombre, setUserNombre] = useState("Tú");
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [pronosticos, setPronosticos] = useState<Record<string, Pronostico>>({});
  const [partidosLoaded, setPartidosLoaded] = useState(false);

  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [rankingLoading, setRankingLoading] = useState(false);

  const [unlocking, setUnlocking] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, { a: string; b: string }>>({});

  // Auth + redirect
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("url_retorno", "/mundial");
        }
        router.push("/?login=true");
        return;
      }
      setUserId(user.uid);
      setAuthLoading(false);
    });
    return () => unsub();
  }, [router]);

  // Perfil (sellos + mundialUnlocked + mundialPuntos + nombre)
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, "usuarios", userId), (snap) => {
      const d = snap.exists() ? snap.data() : null;
      setSellos(Number(d?.comprasRealizadas || 0));
      setUnlocked(d?.mundialUnlocked === true);
      setMundialPuntos(Number(d?.mundialPuntos || 0));
      setUserNombre(
        (typeof d?.nombre === "string" && d.nombre.trim()) ||
          (typeof d?.correo === "string" && d.correo.split("@")[0]) ||
          "Tú",
      );
      setProfileLoaded(true);
    });
    return () => unsub();
  }, [userId]);

  // Partidos
  useEffect(() => {
    if (!unlocked) return;
    const q = query(collection(db, "mundial_partidos"), orderBy("fechaInicio", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Partido[] = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((p) => p.fechaInicio && typeof p.fechaInicio.toMillis === "function");
      setPartidos(list);
      setPartidosLoaded(true);
    });
    return () => unsub();
  }, [unlocked]);

  // Ranking (top 5 + total). Se refresca cuando cambian los puntos del usuario
  // — así, al recibir sellos por un partido resuelto, el leaderboard se actualiza.
  useEffect(() => {
    if (!unlocked || !auth.currentUser) return;
    let cancelled = false;
    (async () => {
      setRankingLoading(true);
      try {
        const idToken = await auth.currentUser!.getIdToken();
        const res = await fetch("/api/mundial/ranking", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setRanking({ totalJugadores: data.totalJugadores ?? 0, top5: data.top5 ?? [] });
        }
      } catch (e) {
        console.warn("[ranking]", e);
      } finally {
        if (!cancelled) setRankingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, mundialPuntos]);

  // Pronósticos del usuario (solo los propios — reglas + billing)
  useEffect(() => {
    if (!userId || !unlocked) return;
    const q = query(
      collection(db, "mundial_pronosticos"),
      where("userId", "==", userId),
    );
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, Pronostico> = {};
      snap.forEach((d) => {
        const data = d.data() as any;
        map[data.partidoId] = { id: d.id, ...data };
      });
      setPronosticos(map);
    });
    return () => unsub();
  }, [userId, unlocked]);

  const puedeDesbloquear = sellos >= COSTO_PASE_LIBRE;

  const handleUnlock = async () => {
    if (!auth.currentUser || unlocking) return;
    setUnlocking(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/mundial/unlock", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo desbloquear.");
      toast({
        title: "¡Pase Libre desbloqueado! 🏆",
        description: "Ya puedes pronosticar todos los partidos.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "No se pudo desbloquear",
        description: e?.message ?? "Intenta nuevamente.",
      });
    } finally {
      setUnlocking(false);
    }
  };

  const handleGuardar = async (partido: Partido) => {
    if (!auth.currentUser) return;
    const d = draft[partido.id];
    const golesA = Number(d?.a);
    const golesB = Number(d?.b);
    if (!Number.isInteger(golesA) || !Number.isInteger(golesB) || golesA < 0 || golesB < 0) {
      toast({
        variant: "destructive",
        title: "Marcador inválido",
        description: "Ingresa dos números enteros no negativos.",
      });
      return;
    }
    setSaving((s) => ({ ...s, [partido.id]: true }));
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/mundial/pronosticar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ partidoId: partido.id, golesA, golesB }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      toast({
        title: "Pronóstico guardado ⚽",
        description: `${partido.equipoA} ${golesA} - ${golesB} ${partido.equipoB}`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: e?.message ?? "Intenta nuevamente.",
      });
    } finally {
      setSaving((s) => ({ ...s, [partido.id]: false }));
    }
  };

  if (authLoading || !profileLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#D3B673" }} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      {/* Header sticky */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/")}
            className="text-slate-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-slate-800">Polla Mundialista</h1>
            <p className="text-xs text-slate-400 font-medium">
              {sellos} sello{sellos !== 1 ? "s" : ""} · {unlocked ? "Pase Libre activo" : "Bloqueado"}
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-2xl font-black text-sm"
            style={{ backgroundColor: "rgba(211,182,115,0.12)", color: "#D3B673" }}
          >
            {sellos} ⭐
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-6">
        {!unlocked ? (
          <PaywallCard
            sellos={sellos}
            puedeDesbloquear={puedeDesbloquear}
            unlocking={unlocking}
            onUnlock={handleUnlock}
          />
        ) : (
          <div className="space-y-4">
            <RankingCard
              ranking={ranking}
              loading={rankingLoading}
              currentUserId={userId}
              currentUserNombre={userNombre}
              currentUserPuntos={mundialPuntos}
            />
            <PartidosFeed
              partidos={partidos}
              partidosLoaded={partidosLoaded}
              pronosticos={pronosticos}
              draft={draft}
              saving={saving}
              onDraftChange={(id, field, value) =>
                setDraft((prev) => ({
                  ...prev,
                  [id]: { a: prev[id]?.a ?? "", b: prev[id]?.b ?? "", [field]: value },
                }))
              }
              onGuardar={handleGuardar}
            />
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Ranking ─────────────────────────────────────────────────────────────────
function RankingCard({
  ranking,
  loading,
  currentUserId,
  currentUserNombre,
  currentUserPuntos,
}: {
  ranking: Ranking | null;
  loading: boolean;
  currentUserId: string | null;
  currentUserNombre: string;
  currentUserPuntos: number;
}) {
  const total = ranking?.totalJugadores ?? 0;
  const top5 = ranking?.top5 ?? [];
  const userEnTop5 = top5.some((r) => r.uid === currentUserId);

  return (
    <Card className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5" style={{ color: "#D3B673" }} />
          <h2 className="text-base font-black text-slate-800">Tabla de Posiciones</h2>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black"
          style={{ background: "rgba(211,182,115,0.14)", color: "#9A7B3A" }}
        >
          <Users className="w-3 h-3" />
          {loading && !ranking ? "…" : `${total} jugando`}
        </span>
      </div>

      {loading && !ranking ? (
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-11 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : top5.length === 0 ? (
        <div className="mt-4 text-center py-6 rounded-xl bg-slate-50 border border-dashed border-slate-200">
          <p className="text-sm text-slate-500 font-medium">
            Aún nadie ha ganado sellos en el torneo.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Sé el primero — pronostica los partidos abiertos.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {top5.map((row, idx) => {
            const posicion = idx + 1;
            const isFirst = posicion === 1;
            const isCurrentUser = row.uid === currentUserId;
            return (
              <li
                key={row.uid}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  isCurrentUser
                    ? "bg-amber-50 border border-amber-100"
                    : isFirst
                      ? "bg-gradient-to-r from-amber-50 to-transparent"
                      : "hover:bg-slate-50"
                }`}
              >
                <span
                  className={`shrink-0 w-8 text-center font-black text-sm ${
                    isFirst ? "text-amber-600" : "text-slate-400"
                  }`}
                >
                  {isFirst ? <Crown className="w-4 h-4 mx-auto" /> : `${posicion}º`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {row.nombre}
                    {isCurrentUser && (
                      <span className="ml-1.5 text-[10px] font-black text-amber-600 uppercase">
                        tú
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className="shrink-0 font-black text-sm"
                  style={{ color: isFirst ? "#C9920A" : "#0f172a" }}
                >
                  {row.mundialPuntos} pts
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Fila del usuario cuando no está en el Top 5 */}
      {ranking && !userEnTop5 && (
        <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
          <div
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ background: "rgba(15,23,42,0.04)" }}
          >
            <span className="shrink-0 w-8 text-center font-black text-sm text-slate-400">
              —
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">
                {currentUserNombre}
                <span className="ml-1.5 text-[10px] font-black text-slate-400 uppercase">
                  tú
                </span>
              </p>
            </div>
            <span className="shrink-0 font-black text-sm text-slate-700">
              {currentUserPuntos} pts
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Paywall ─────────────────────────────────────────────────────────────────
function PaywallCard({
  sellos,
  puedeDesbloquear,
  unlocking,
  onUnlock,
}: {
  sellos: number;
  puedeDesbloquear: boolean;
  unlocking: boolean;
  onUnlock: () => void;
}) {
  const faltan = Math.max(0, COSTO_PASE_LIBRE - sellos);
  return (
    <div
      className="relative w-full max-w-2xl mx-auto rounded-3xl overflow-hidden shadow-2xl min-h-[550px] flex flex-col items-center justify-center p-6 sm:p-10 text-center bg-gray-900"
      style={{
        backgroundImage: "url('/promo-mundial.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay para legibilidad */}
      <div className="absolute inset-0 bg-black/60 bg-gradient-to-t from-black/90 via-black/50 to-black/80 z-0" />

      <div className="relative z-10 w-full flex flex-col items-center">
        <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 uppercase tracking-tight mb-2 drop-shadow-lg">
          🏆 ¡Llegó la Polla del Patio!
        </h1>
        <p className="text-lg sm:text-2xl font-bold text-white uppercase tracking-wide mb-8 drop-shadow-md">
          Gana sellos por cada resultado
        </p>

        {/* Reglas — Glassmorphism */}
        <div className="w-full max-w-md backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 mb-8 text-left shadow-xl">
          <p className="text-white font-medium mb-3 flex items-start">
            <span className="bg-yellow-500 text-black font-black px-2 py-1 rounded text-sm mr-2 shrink-0">
              +8 SELLOS
            </span>
            <span>Si aciertas el marcador exacto.</span>
          </p>
          <p className="text-white font-medium flex items-start">
            <span className="bg-gray-300 text-black font-black px-2 py-1 rounded text-sm mr-2 shrink-0">
              +3 SELLOS
            </span>
            <span>Si aciertas solo al ganador (o empate).</span>
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onUnlock}
          disabled={!puedeDesbloquear || unlocking}
          className={`w-full max-w-md ${
            puedeDesbloquear && !unlocking
              ? "bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 hover:from-yellow-300 hover:to-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:scale-105 active:scale-95"
              : "bg-slate-700/70 text-slate-300 cursor-not-allowed"
          } font-black uppercase tracking-wider text-lg py-4 px-6 rounded-xl transition-all transform flex items-center justify-center gap-2`}
        >
          {unlocking ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Desbloqueando…
            </>
          ) : puedeDesbloquear ? (
            <>
              <Lock className="w-5 h-5" />
              Desbloquea tu Pase Libre Hoy
            </>
          ) : (
            `Te faltan ${faltan} sello${faltan === 1 ? "" : "s"} para entrar`
          )}
        </button>

        <p className="text-gray-300 text-xs mt-4 max-w-md">
          Pago único de 3 sellos. Todos los pronósticos posteriores son gratis.
        </p>
      </div>
    </div>
  );
}

// ─── Feed de partidos ────────────────────────────────────────────────────────
function PartidosFeed({
  partidos,
  partidosLoaded,
  pronosticos,
  draft,
  saving,
  onDraftChange,
  onGuardar,
}: {
  partidos: Partido[];
  partidosLoaded: boolean;
  pronosticos: Record<string, Pronostico>;
  draft: Record<string, { a: string; b: string }>;
  saving: Record<string, boolean>;
  onDraftChange: (id: string, field: "a" | "b", value: string) => void;
  onGuardar: (partido: Partido) => void;
}) {
  const ahoraMs = useMemo(() => Date.now(), [partidos.length]);

  if (!partidosLoaded) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (partidos.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed border-slate-200 bg-white">
        <Trophy className="w-10 h-10 mx-auto text-slate-300" />
        <p className="mt-4 text-slate-500 font-medium">
          Aún no hay partidos publicados.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Vuelve pronto para pronosticar el próximo duelo.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {partidos.map((p) => {
        const pron = pronosticos[p.id];
        const isFinalizado = p.finalizado === true;
        const isLocked = !isFinalizado && p.fechaInicio.toMillis() <= ahoraMs;
        const isActive = !isFinalizado && !isLocked;

        // Valores mostrados en el marcador central.
        // - Activo: draft si el usuario está tipeando, si no el pronóstico guardado.
        // - Bloqueado: pronóstico guardado (lo que apostó).
        // - Finalizado: resultado real del partido.
        const scoreA = isFinalizado
          ? typeof p.golesA === "number" ? p.golesA : null
          : pron?.golesA;
        const scoreB = isFinalizado
          ? typeof p.golesB === "number" ? p.golesB : null
          : pron?.golesB;

        const inputValA = draft[p.id]?.a ?? (pron ? String(pron.golesA) : "");
        const inputValB = draft[p.id]?.b ?? (pron ? String(pron.golesB) : "");

        const isSaving = saving[p.id] === true;

        return (
          <Card
            key={p.id}
            className="rounded-2xl border border-gray-100 shadow-sm bg-gradient-to-b from-white to-gray-50/50 overflow-hidden"
          >
            <div className="p-4 sm:p-5">
              {/* Cabecera: fase (izq) · fecha/estado (der) — apilable en móvil */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 mb-4 text-[10px] font-bold uppercase tracking-wider">
                <span className="text-gray-500">{p.fase ?? "Fase de grupos"}</span>
                <span
                  className={
                    isFinalizado
                      ? "text-emerald-600"
                      : isLocked
                        ? "text-amber-600"
                        : "text-gray-500"
                  }
                >
                  {isFinalizado ? "Finalizado" : isLocked ? "En juego" : formatFecha(p.fechaInicio)}
                </span>
              </div>

              {/* Marcador deportivo (grid exacto): [Equipo A] [Marcador] [Equipo B] */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 w-full">
                <div className="flex flex-col items-center justify-center w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={flagUrl(p.equipoA)}
                    alt={p.equipoA}
                    loading="lazy"
                    className="w-12 h-8 sm:w-14 sm:h-10 object-cover rounded-sm shadow-sm border border-gray-100"
                  />
                  <span className="text-xs sm:text-sm font-black text-gray-800 text-center break-words leading-tight mt-2">
                    {p.equipoA}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 px-1">
                  {isActive ? (
                    <>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={30}
                        value={inputValA}
                        onChange={(e) => onDraftChange(p.id, "a", e.target.value)}
                        aria-label={`Goles ${p.equipoA}`}
                        className="w-12 h-12 sm:w-14 sm:h-14 text-xl sm:text-2xl text-center font-black rounded-xl bg-white border-2 border-gray-200 text-gray-900 focus:outline-none focus:border-amber-500 focus:ring-0 transition-colors"
                      />
                      <span className="text-gray-300 font-black text-xl sm:text-2xl">:</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={30}
                        value={inputValB}
                        onChange={(e) => onDraftChange(p.id, "b", e.target.value)}
                        aria-label={`Goles ${p.equipoB}`}
                        className="w-12 h-12 sm:w-14 sm:h-14 text-xl sm:text-2xl text-center font-black rounded-xl bg-white border-2 border-gray-200 text-gray-900 focus:outline-none focus:border-amber-500 focus:ring-0 transition-colors"
                      />
                    </>
                  ) : (
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-3xl sm:text-4xl font-black text-gray-900 tabular-nums">
                        {typeof scoreA === "number" ? scoreA : "—"}
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-gray-300">:</span>
                      <span className="text-3xl sm:text-4xl font-black text-gray-900 tabular-nums">
                        {typeof scoreB === "number" ? scoreB : "—"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={flagUrl(p.equipoB)}
                    alt={p.equipoB}
                    loading="lazy"
                    className="w-12 h-8 sm:w-14 sm:h-10 object-cover rounded-sm shadow-sm border border-gray-100"
                  />
                  <span className="text-xs sm:text-sm font-black text-gray-800 text-center break-words leading-tight mt-2">
                    {p.equipoB}
                  </span>
                </div>
              </div>

              {/* Etiqueta explicativa cuando el marcador estático es el pronóstico */}
              {isLocked && pron && (
                <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Tu pronóstico
                </p>
              )}
            </div>

            {/* Footer: botón activo o badge de estado */}
            {isActive ? (
              <div className="px-5 pb-5">
                <Button
                  onClick={() => onGuardar(p)}
                  disabled={isSaving}
                  className="w-full h-12 rounded-xl font-black text-sm shadow-sm hover:shadow-md transition-all"
                  style={{ background: "#1e293b", color: "#facc15" }}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando…
                    </span>
                  ) : pron ? (
                    "Actualizar pronóstico"
                  ) : (
                    "Guardar pronóstico"
                  )}
                </Button>
              </div>
            ) : isLocked ? (
              <div className="px-5 pb-5">
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-center">
                  <p className="text-sm font-black text-amber-700 tracking-wide">
                    🔒 Pronóstico Cerrado
                  </p>
                  <p className="text-[11px] font-bold text-amber-600/80 mt-0.5">
                    Partido en curso — espera el resultado.
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-5 pb-5 space-y-2">
                <div className="rounded-xl bg-slate-900 px-4 py-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    Resultado Final
                  </p>
                  {pron && (
                    <p className="mt-1 text-[11px] font-bold text-slate-300">
                      Tú apostaste: {pron.golesA} - {pron.golesB}
                    </p>
                  )}
                </div>

                {pron?.resuelto && typeof pron.sellosGanados === "number" && (
                  <div
                    className={
                      pron.sellosGanados > 0
                        ? "rounded-xl px-4 py-3 text-center bg-emerald-500 text-white font-black shadow-sm"
                        : "rounded-xl px-4 py-3 text-center bg-gray-100 text-gray-500 font-bold"
                    }
                  >
                    {pron.sellosGanados > 0
                      ? `🎉 ¡Ganaste ${pron.sellosGanados} ${pron.sellosGanados === 1 ? "sello" : "sellos"}!`
                      : "No acertaste esta vez"}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
