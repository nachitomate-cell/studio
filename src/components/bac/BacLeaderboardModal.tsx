"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Crown, Loader2, Trophy, X } from "lucide-react";
import { LOCALES_BAC } from "@/data/localesBac";

const NIGHT = "#1a2b5c";
const NIGHT_DEEP = "#0F1B4C";
const PINK = "#FF4B91";
const CREAM = "#FDF1D6";
const YELLOW = "#FFD84D";
const TOTAL = LOCALES_BAC.length;

interface Entry {
  uid: string;
  nombre: string;
  handle?: string;
  bacStampsCount: number;
}

function pickDisplayName(data: Record<string, unknown>): { nombre: string; handle?: string } {
  const name =
    (data.nombre as string) ||
    (data.displayName as string) ||
    (data.instagram as string) ||
    (data.correo as string) ||
    "";
  const handle = (data.instagram as string) || undefined;
  return {
    nombre: name.trim() ? name.trim() : "Explorador Anónimo",
    handle: handle && handle !== name ? handle : undefined,
  };
}

function initials(nombre: string): string {
  const clean = nombre.replace(/^@/, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface Props {
  currentUid: string;
  onClose: () => void;
}

export function BacLeaderboardModal({ currentUid, onClose }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myCount, setMyCount] = useState<number>(0);
  const [myName, setMyName] = useState<{ nombre: string; handle?: string }>({ nombre: "Tú" });
  const [myRank, setMyRank] = useState<number | null>(null);
  const [rankLoading, setRankLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "usuarios"),
      where("bacStampsCount", ">", 0),
      orderBy("bacStampsCount", "desc"),
      limit(15)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Entry[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const { nombre, handle } = pickDisplayName(data);
          return {
            uid: d.id,
            nombre,
            handle,
            bacStampsCount: (data.bacStampsCount as number) || 0,
          };
        });
        setEntries(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "usuarios", currentUid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Record<string, unknown>;
      setMyCount((data.bacStampsCount as number) || 0);
      setMyName(pickDisplayName(data));
    });
    return () => unsub();
  }, [currentUid]);

  useEffect(() => {
    if (myCount === 0) {
      setMyRank(null);
      return;
    }
    let cancelled = false;
    setRankLoading(true);
    const q = query(collection(db, "usuarios"), where("bacStampsCount", ">", myCount));
    getCountFromServer(q)
      .then((r) => {
        if (!cancelled) setMyRank(r.data().count + 1);
      })
      .catch(() => {
        if (!cancelled) setMyRank(null);
      })
      .finally(() => {
        if (!cancelled) setRankLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [myCount]);

  const podium = useMemo(() => entries.slice(0, 3), [entries]);
  const rest = useMemo(() => entries.slice(3), [entries]);
  const inTop = useMemo(
    () => (myRank !== null && myRank <= 15 ? myRank : null),
    [myRank]
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
        style={{
          background: NIGHT,
          border: `1px solid ${PINK}55`,
          maxHeight: "90vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-5 flex items-center gap-3 border-b relative overflow-hidden"
          style={{
            borderColor: "rgba(255,75,145,0.25)",
            background: `linear-gradient(135deg, ${PINK}22 0%, ${YELLOW}11 100%)`,
          }}
        >
          <div className="w-10 h-1 rounded-full absolute top-2 left-1/2 -translate-x-1/2 sm:hidden" style={{ background: "rgba(253,241,214,0.25)" }} />
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,75,145,0.2)", border: `1px solid ${PINK}66` }}
          >
            <Trophy className="w-5 h-5" style={{ color: YELLOW }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: PINK }}>
              Ranking en Vivo · Tapas & Copas V.02
            </p>
            <h2 className="text-lg font-black leading-tight" style={{ color: CREAM, fontFamily: "var(--font-bac-display), Montserrat, sans-serif" }}>
              👑 Top Exploradores BAC
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(253,241,214,0.08)", color: CREAM }}
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5" style={{ background: NIGHT }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: PINK }} />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-14">
              <div className="text-4xl mb-2">🍷</div>
              <p className="text-sm font-black" style={{ color: CREAM }}>
                Aún nadie ha sellado su pasaporte.
              </p>
              <p className="text-[12px] mt-1" style={{ color: CREAM, opacity: 0.6 }}>
                ¡Sé el primer explorador de la ruta!
              </p>
            </div>
          ) : (
            <>
              <Podium entries={podium} currentUid={currentUid} />
              {rest.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] px-1" style={{ color: CREAM, opacity: 0.5 }}>
                    Puestos 4–15
                  </p>
                  <div
                    className="rounded-2xl overflow-hidden divide-y"
                    style={{ background: NIGHT_DEEP, borderColor: "rgba(253,241,214,0.06)" }}
                  >
                    {rest.map((entry, i) => (
                      <RankRow
                        key={entry.uid}
                        rank={i + 4}
                        entry={entry}
                        isMe={entry.uid === currentUid}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky footer: my position */}
        <div
          className="p-4 border-t"
          style={{ borderColor: "rgba(255,75,145,0.25)", background: NIGHT_DEEP }}
        >
          <MyPositionCard
            nombre={myName.nombre}
            handle={myName.handle}
            count={myCount}
            rank={myRank}
            inTop={inTop}
            loading={rankLoading}
          />
        </div>
      </div>
    </div>
  );
}

// ── Podium ───────────────────────────────────────────────────────────────────
function Podium({ entries, currentUid }: { entries: Entry[]; currentUid: string }) {
  const [first, second, third] = [entries[0], entries[1], entries[2]];
  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      {second ? (
        <PodiumSpot entry={second} rank={2} isMe={second.uid === currentUid} />
      ) : (
        <PodiumEmpty rank={2} />
      )}
      {first ? (
        <PodiumSpot entry={first} rank={1} isMe={first.uid === currentUid} />
      ) : (
        <PodiumEmpty rank={1} />
      )}
      {third ? (
        <PodiumSpot entry={third} rank={3} isMe={third.uid === currentUid} />
      ) : (
        <PodiumEmpty rank={3} />
      )}
    </div>
  );
}

function PodiumSpot({ entry, rank, isMe }: { entry: Entry; rank: 1 | 2 | 3; isMe: boolean }) {
  const isFirst = rank === 1;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const size = isFirst ? 76 : 60;
  const heightPad = isFirst ? "pt-7" : "pt-4";

  return (
    <div className={`flex flex-col items-center ${heightPad}`}>
      {isFirst && (
        <div className="mb-1 -mt-3 text-2xl leading-none animate-bounce" style={{ animationDuration: "2s" }}>
          <Crown className="w-6 h-6" style={{ color: YELLOW, filter: `drop-shadow(0 0 8px ${YELLOW}aa)` }} />
        </div>
      )}
      <div
        className="rounded-2xl flex items-center justify-center relative"
        style={{
          width: size,
          height: size,
          background: isFirst
            ? `linear-gradient(135deg, ${PINK} 0%, #B0207D 100%)`
            : rank === 2
            ? `linear-gradient(135deg, ${CREAM} 0%, #C9BE93 100%)`
            : `linear-gradient(135deg, #E5A874 0%, #A8672A 100%)`,
          border: `2px solid ${isFirst ? CREAM : NIGHT}`,
          boxShadow: isFirst
            ? `0 0 22px ${PINK}88, 0 4px 12px rgba(0,0,0,0.4)`
            : `0 4px 12px rgba(0,0,0,0.35)`,
        }}
      >
        <span
          className="font-black"
          style={{
            fontSize: isFirst ? 22 : 18,
            color: isFirst ? CREAM : NIGHT,
            fontFamily: "var(--font-bac-display), Montserrat, sans-serif",
          }}
        >
          {initials(entry.nombre)}
        </span>
        <span
          className="absolute -top-1.5 -left-1.5 text-lg"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}
        >
          {medal}
        </span>
        {isMe && (
          <span
            className="absolute -bottom-1 -right-1 text-[8px] font-black px-1.5 h-4 rounded-full flex items-center justify-center"
            style={{ background: YELLOW, color: NIGHT }}
          >
            TÚ
          </span>
        )}
      </div>
      <p
        className="text-[10px] font-black mt-2 text-center truncate w-full"
        style={{ color: CREAM, fontFamily: "var(--font-bac-display), Montserrat, sans-serif" }}
      >
        {entry.nombre}
      </p>
      <p className="text-[9px] font-bold" style={{ color: YELLOW }}>
        {entry.bacStampsCount} / {TOTAL}
      </p>
    </div>
  );
}

function PodiumEmpty({ rank }: { rank: 1 | 2 | 3 }) {
  const isFirst = rank === 1;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const size = isFirst ? 76 : 60;
  return (
    <div className={`flex flex-col items-center ${isFirst ? "pt-7" : "pt-4"} opacity-40`}>
      <div
        className="rounded-2xl flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: "rgba(253,241,214,0.06)",
          border: "2px dashed rgba(253,241,214,0.2)",
        }}
      >
        <span style={{ fontSize: 20 }}>{medal}</span>
      </div>
      <p className="text-[10px] font-black mt-2" style={{ color: CREAM, opacity: 0.5 }}>
        —
      </p>
    </div>
  );
}

// ── Row (4th–15th) ───────────────────────────────────────────────────────────
function RankRow({ rank, entry, isMe }: { rank: number; entry: Entry; isMe: boolean }) {
  const pct = Math.round((entry.bacStampsCount / TOTAL) * 100);
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5"
      style={{
        background: isMe ? `${PINK}18` : "transparent",
        borderColor: "rgba(253,241,214,0.06)",
      }}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
        style={{ background: "rgba(253,241,214,0.08)", color: CREAM }}
      >
        {rank}
      </span>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
        style={{
          background: isMe ? PINK : "rgba(255,75,145,0.18)",
          color: isMe ? CREAM : PINK,
          border: `1px solid ${isMe ? CREAM : PINK}55`,
          fontFamily: "var(--font-bac-display), Montserrat, sans-serif",
        }}
      >
        {initials(entry.nombre)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] font-black truncate" style={{ color: CREAM }}>
            {entry.nombre}
          </p>
          {isMe && (
            <span
              className="text-[8px] font-black px-1 rounded"
              style={{ background: YELLOW, color: NIGHT }}
            >
              TÚ
            </span>
          )}
        </div>
        <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: "rgba(253,241,214,0.08)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${PINK} 0%, ${YELLOW} 100%)`,
            }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[13px] font-black" style={{ color: YELLOW }}>
          {entry.bacStampsCount}
        </p>
        <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: CREAM, opacity: 0.4 }}>
          sellos
        </p>
      </div>
    </div>
  );
}

// ── My position (sticky footer) ──────────────────────────────────────────────
function MyPositionCard({
  nombre,
  handle,
  count,
  rank,
  inTop,
  loading,
}: {
  nombre: string;
  handle?: string;
  count: number;
  rank: number | null;
  inTop: number | null;
  loading: boolean;
}) {
  return (
    <div
      className="rounded-2xl px-3 py-3 flex items-center gap-3"
      style={{
        background: `linear-gradient(135deg, ${PINK}22 0%, ${YELLOW}12 100%)`,
        border: `1px solid ${PINK}55`,
        boxShadow: `0 0 16px ${PINK}22`,
      }}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
        style={{
          background: `linear-gradient(135deg, ${PINK} 0%, #B0207D 100%)`,
          color: CREAM,
          border: `2px solid ${CREAM}`,
          fontFamily: "var(--font-bac-display), Montserrat, sans-serif",
          fontWeight: 900,
        }}
      >
        {initials(nombre)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: PINK }}>
          Tu posición
        </p>
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-black truncate" style={{ color: CREAM }}>
            {nombre}
          </p>
          {handle && (
            <p className="text-[10px] font-medium truncate" style={{ color: CREAM, opacity: 0.55 }}>
              {handle}
            </p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        {loading && rank === null ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: YELLOW }} />
        ) : count === 0 ? (
          <>
            <p className="text-[11px] font-black" style={{ color: CREAM, opacity: 0.7 }}>
              Sin ranking
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: CREAM, opacity: 0.4 }}>
              Sella tu 1ᵉʳ local
            </p>
          </>
        ) : (
          <>
            <p className="text-[18px] leading-none font-black" style={{ color: YELLOW, fontFamily: "var(--font-bac-display), Montserrat, sans-serif" }}>
              #{rank ?? "?"}
            </p>
            <p className="text-[10px] font-black" style={{ color: CREAM }}>
              {count} <span style={{ opacity: 0.6 }}>/ {TOTAL}</span>
            </p>
            {inTop === null && rank !== null && (
              <p className="text-[8px] font-black uppercase tracking-widest mt-0.5" style={{ color: CREAM, opacity: 0.5 }}>
                Fuera del top 15
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
