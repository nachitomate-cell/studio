"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const SLIDES = [
  {
    emoji: "🏙️",
    title: "¡Bienvenido al Club!",
    text: "Descubre los mejores locales de Patio Curauma. Compra en tus tiendas favoritas y empieza a sumar beneficios.",
  },
  {
    emoji: "📱",
    title: "Suma Sellos fácilmente",
    text: "Cada local tiene su código QR en el mostrador. Escanéalo con la app al visitar y recibirás una estampilla digital al instante.",
  },
  {
    emoji: "🎁",
    title: "¡Gana Premios Reales!",
    text: "Completa tu tarjeta y canjea premios increíbles. ¡Además, diviértete completando tu Ruta y coleccionando estampillas de todo el Patio!",
  },
];

interface OnboardingTutorialProps {
  userId: string;
  onComplete: () => void;
}

export function OnboardingTutorial({ userId, onComplete }: OnboardingTutorialProps) {
  const [current, setCurrent] = useState(0);
  const [exiting, setExiting] = useState(false);

  const markComplete = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await updateDoc(doc(db, "usuarios", userId), { hasCompletedOnboarding: true });
    } catch { }
    onComplete();
  };

  const goNext = () => {
    if (current < SLIDES.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      markComplete();
    }
  };

  const isLast = current === SLIDES.length - 1;

  return (
    <motion.div
      className="fixed inset-0 z-[500] flex flex-col select-none"
      style={{ background: "#0F172A" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Gold accent strip at top */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: "linear-gradient(90deg, #C9920A, #E8B028, #C9920A)" }}
      />

      {/* Skip button */}
      <div className="flex justify-between items-center px-6 pt-10">
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
          <img src="/Logo2.png" alt="Club Patio" className="w-7 h-7 object-contain" />
        </div>
        <button
          onClick={markComplete}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-colors"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          <X className="w-3.5 h-3.5" />
          Saltar
        </button>
      </div>

      {/* Slide area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
            className="flex flex-col items-center text-center gap-8 w-full"
          >
            {/* Icon box */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3, type: "spring", stiffness: 200 }}
              className="w-36 h-36 rounded-[2.5rem] flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(201,146,10,0.18) 0%, rgba(201,146,10,0.04) 100%)",
                border: "1.5px solid rgba(201,146,10,0.35)",
                boxShadow: "0 0 40px rgba(201,146,10,0.12)",
                fontSize: "72px",
              }}
            >
              {SLIDES[current].emoji}
            </motion.div>

            {/* Copy */}
            <div className="space-y-4 max-w-[300px]">
              <h2
                className="text-[26px] font-black text-white leading-tight"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                {SLIDES[current].title}
              </h2>
              <p className="text-[15px] leading-relaxed" style={{ color: "rgba(203,213,225,0.9)" }}>
                {SLIDES[current].text}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom: dots + CTA */}
      <div className="flex flex-col items-center gap-7 px-8 pb-14">
        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === current ? 28 : 8,
                opacity: i === current ? 1 : 0.3,
              }}
              transition={{ duration: 0.3 }}
              className="h-2 rounded-full"
              style={{ background: i === current ? "#C9920A" : "white" }}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={goNext}
          className="w-full max-w-[320px] h-14 rounded-2xl font-black text-white text-base transition-all active:scale-[0.97]"
          style={{
            background: "linear-gradient(135deg, #C9920A 0%, #E8B028 100%)",
            boxShadow: "0 8px 28px rgba(201,146,10,0.45)",
            fontFamily: "Montserrat, sans-serif",
          }}
        >
          {isLast ? "¡Empezar! 🚀" : "Siguiente →"}
        </button>

        {/* Slide counter */}
        <p className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>
          {current + 1} / {SLIDES.length}
        </p>
      </div>
    </motion.div>
  );
}
