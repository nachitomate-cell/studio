"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X } from "lucide-react";

const NIGHT = "#1a2b5c";
const NIGHT_DEEP = "#0F1B4C";
const PINK = "#FF4B91";
const CREAM = "#FDF1D6";
const YELLOW = "#FFD84D";
const PURPLE = "#9B7BC7";

export type BacRating = "fuego" | "ok" | "lento";

interface Option {
  key: BacRating;
  emoji: string;
  label: string;
  border: string;
  glow: string;
}

const OPTIONS: Option[] = [
  { key: "fuego", emoji: "🔥", label: "Épico", border: PINK, glow: "rgba(255,75,145,0.55)" },
  { key: "ok", emoji: "👌", label: "Súper bien", border: CREAM, glow: "rgba(253,241,214,0.45)" },
  { key: "lento", emoji: "🐢", label: "Lento / Regular", border: PURPLE, glow: "rgba(155,123,199,0.5)" },
];

const THANKS_MS = 1500;

interface Props {
  uid: string;
  localId: string;
  localNombre: string;
  onDone: () => void;
}

export function BacExpressReview({ uid, localId, localNombre, onDone }: Props) {
  const [chosen, setChosen] = useState<BacRating | null>(null);

  useEffect(() => {
    if (!chosen) return;
    const t = setTimeout(onDone, THANKS_MS);
    return () => clearTimeout(t);
  }, [chosen, onDone]);

  const handlePick = (rating: BacRating) => {
    if (chosen) return;
    setChosen(rating);
    // Fire-and-forget. Firestore's client SDK queues writes when offline,
    // and we swallow errors to keep the celebration flow smooth.
    addDoc(collection(db, "eventos_bac_reviews"), {
      uid,
      localId,
      rating,
      createdAt: serverTimestamp(),
    }).catch(() => {
      // Intentional no-op — analytics data, non-critical.
    });
  };

  const chosenOpt = chosen ? OPTIONS.find((o) => o.key === chosen)! : null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 p-4"
      onClick={chosen ? undefined : onDone}
    >
      <style>{`
        .bac-review-btn[data-key="fuego"]:hover {
          border-color: ${PINK} !important;
          box-shadow: 0 0 14px ${OPTIONS[0].glow};
          transform: translateY(-2px);
        }
        .bac-review-btn[data-key="ok"]:hover {
          border-color: ${CREAM} !important;
          box-shadow: 0 0 14px ${OPTIONS[1].glow};
          transform: translateY(-2px);
        }
        .bac-review-btn[data-key="lento"]:hover {
          border-color: ${PURPLE} !important;
          box-shadow: 0 0 14px ${OPTIONS[2].glow};
          transform: translateY(-2px);
        }
      `}</style>

      <div
        className="w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 zoom-in-95 duration-300 p-6"
        style={{ background: NIGHT, border: `1px solid ${PINK}55` }}
        onClick={(e) => e.stopPropagation()}
      >
        {!chosen ? (
          <>
            <div className="flex items-start gap-3 mb-5">
              <span style={{ fontSize: 26, lineHeight: 1, marginTop: 2 }}>🍷</span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[9px] font-black uppercase tracking-[0.25em]"
                  style={{ color: PINK }}
                >
                  Termómetro BAC
                </p>
                <h3
                  className="text-base font-black leading-tight mt-0.5"
                  style={{ color: CREAM, fontFamily: "var(--font-bac-display), Montserrat, sans-serif" }}
                >
                  ¿Cómo estuvo tu parada en{" "}
                  <span style={{ color: YELLOW }}>{localNombre}</span>?
                </h3>
              </div>
              <button
                onClick={onDone}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(253,241,214,0.08)", color: CREAM }}
                aria-label="Saltar valoración"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  data-key={opt.key}
                  onClick={() => handlePick(opt.key)}
                  className="bac-review-btn flex flex-col items-center gap-2 rounded-2xl py-4 px-1 transition-all duration-150 active:scale-95"
                  style={{
                    background: NIGHT_DEEP,
                    border: "2px solid rgba(253,241,214,0.18)",
                    color: CREAM,
                  }}
                >
                  <span style={{ fontSize: 32, lineHeight: 1 }}>{opt.emoji}</span>
                  <span className="text-[10px] font-black uppercase tracking-wide leading-tight text-center">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={onDone}
              className="mt-4 w-full text-[11px] font-bold py-2 transition-colors hover:text-[#FDF1D6]"
              style={{ color: "rgba(253,241,214,0.45)" }}
            >
              Saltar por ahora
            </button>
          </>
        ) : (
          <div className="py-6 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
              style={{
                background: `linear-gradient(135deg, ${chosenOpt!.border}22 0%, ${chosenOpt!.border}44 100%)`,
                border: `2px solid ${chosenOpt!.border}`,
                boxShadow: `0 0 24px ${chosenOpt!.glow}`,
              }}
            >
              <span style={{ fontSize: 36, lineHeight: 1 }}>{chosenOpt!.emoji}</span>
            </div>
            <p
              className="text-lg font-black mb-1"
              style={{ color: CREAM, fontFamily: "var(--font-bac-display), Montserrat, sans-serif" }}
            >
              ¡Dato guardado!
            </p>
            <p className="text-sm" style={{ color: CREAM, opacity: 0.7 }}>
              Disfruta tu ruta 🍸
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
