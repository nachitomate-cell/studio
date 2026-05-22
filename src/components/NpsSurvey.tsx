"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface NpsSurveyProps {
  userId: string;
  onClose: () => void;
}

export function NpsSurvey({ userId, onClose }: NpsSurveyProps) {
  const [score, setScore] = useState<number | null>(null);
  const [comentario, setComentario] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (score === null) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "usuarios", userId), {
        nps: {
          score,
          fecha: new Date().toISOString(),
          ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
        },
      });
      setSubmitted(true);
      setTimeout(onClose, 2200);
    } catch {
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const getScoreLabel = (s: number) => {
    if (s <= 3) return "Muy insatisfecho";
    if (s <= 5) return "Insatisfecho";
    if (s <= 7) return "Neutral";
    if (s <= 8) return "Satisfecho";
    return "Muy satisfecho";
  };

  const getScoreColor = (s: number) => {
    if (s <= 3) return "#ef4444";
    if (s <= 5) return "#f97316";
    if (s <= 7) return "#eab308";
    if (s <= 8) return "#84cc16";
    return "#22c55e";
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[600] flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          className="w-full max-w-md rounded-t-3xl p-6 pb-10"
          style={{ background: "#0F172A", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none" }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
        >
          {submitted ? (
            <motion.div
              className="text-center py-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="text-5xl mb-4">🙏</div>
              <h3 className="text-white text-xl font-black mb-2">¡Gracias por tu opinión!</h3>
              <p className="text-slate-400 text-sm">Tu feedback nos ayuda a mejorar el Club.</p>
            </motion.div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Tu opinión importa</span>
                  </div>
                  <h3 className="text-white text-lg font-black leading-tight">
                    ¿Recomendarías el Club<br />a un amigo?
                  </h3>
                </div>
                <button onClick={onClose} className="text-slate-600 hover:text-slate-400 transition-colors mt-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Score selector */}
              <div className="mb-4">
                <div className="grid grid-cols-11 gap-1 mb-2">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setScore(i)}
                      className="aspect-square rounded-lg text-sm font-black transition-all active:scale-90"
                      style={{
                        background: score === i ? getScoreColor(i) : "rgba(255,255,255,0.06)",
                        color: score === i ? "white" : "rgba(203,213,225,0.6)",
                        border: `1.5px solid ${score === i ? getScoreColor(i) : "rgba(255,255,255,0.08)"}`,
                        transform: score === i ? "scale(1.08)" : "scale(1)",
                      }}
                    >
                      {i}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>
                  <span>Nunca</span>
                  <span>Con gusto</span>
                </div>
                {score !== null && (
                  <motion.p
                    key={score}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center text-sm font-bold mt-2"
                    style={{ color: getScoreColor(score) }}
                  >
                    {getScoreLabel(score)}
                  </motion.p>
                )}
              </div>

              {/* Comentario */}
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="¿Algo que quieras decirnos? (opcional)"
                maxLength={300}
                rows={2}
                className="w-full rounded-xl p-3 text-sm resize-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#f8fafc",
                  fontFamily: "inherit",
                  outline: "none",
                }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(201,146,10,0.5)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />

              <button
                onClick={handleSubmit}
                disabled={score === null || saving}
                className="w-full h-12 rounded-2xl font-black text-[15px] mt-4 transition-all disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #C9920A, #E8B028)",
                  color: "#0f172a",
                  boxShadow: score !== null ? "0 6px 20px rgba(201,146,10,0.35)" : "none",
                }}
              >
                {saving ? "Enviando..." : "Enviar opinión"}
              </button>

              <p className="text-center text-[10px] mt-3" style={{ color: "rgba(255,255,255,0.2)" }}>
                Solo te preguntamos esto una vez
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
