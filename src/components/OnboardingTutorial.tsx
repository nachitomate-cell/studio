"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const INFO_SLIDES = [
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

const CATEGORIAS = [
  { id: "gastronomia", label: "🍽️ Gastronomía" },
  { id: "ropa", label: "👕 Ropa y Moda" },
  { id: "servicios", label: "🛠️ Servicios" },
  { id: "entretenimiento", label: "🎮 Entretenimiento" },
  { id: "deportes", label: "⚽ Deportes" },
  { id: "tecnologia", label: "💻 Tecnología" },
  { id: "hogar", label: "🏠 Hogar" },
  { id: "belleza", label: "💅 Belleza" },
];

const HORARIOS = [
  { id: "manana", label: "🌅 Mañana" },
  { id: "mediodia", label: "☀️ Mediodía" },
  { id: "tarde", label: "🌤️ Tarde" },
  { id: "noche", label: "🌙 Noche" },
];

const PAGOS = [
  { id: "efectivo", label: "💵 Efectivo" },
  { id: "debito", label: "💳 Débito" },
  { id: "credito", label: "🏦 Crédito" },
  { id: "transferencia", label: "📲 Transferencia" },
];

interface Prefs {
  genero: string;
  situacionFamiliar: string;
  categoriasFavoritas: string[];
  horarioPreferido: string;
  mediosPagoPreferidos: string[];
}

interface OnboardingTutorialProps {
  userId: string;
  onComplete: () => void;
}

export function OnboardingTutorial({ userId, onComplete }: OnboardingTutorialProps) {
  const [phase, setPhase] = useState<"info" | "prefs">("info");
  const [currentInfo, setCurrentInfo] = useState(0);
  const [currentPref, setCurrentPref] = useState(0);
  const [exiting, setExiting] = useState(false);

  const [prefs, setPrefs] = useState<Prefs>({
    genero: "",
    situacionFamiliar: "",
    categoriasFavoritas: [],
    horarioPreferido: "",
    mediosPagoPreferidos: [],
  });

  const markComplete = async (savePrefs: boolean) => {
    if (exiting) return;
    setExiting(true);
    try {
      const update: Record<string, any> = { hasCompletedOnboarding: true };
      if (savePrefs) {
        if (prefs.genero) update.genero = prefs.genero;
        if (prefs.situacionFamiliar) update.situacionFamiliar = prefs.situacionFamiliar;
        if (prefs.categoriasFavoritas.length) update.categoriasFavoritas = prefs.categoriasFavoritas;
        if (prefs.horarioPreferido) update.horarioPreferido = prefs.horarioPreferido;
        if (prefs.mediosPagoPreferidos.length) update.mediosPagoPreferidos = prefs.mediosPagoPreferidos;
      }
      await updateDoc(doc(db, "usuarios", userId), update);
    } catch { }
    onComplete();
  };

  const goNextInfo = () => {
    if (currentInfo < INFO_SLIDES.length - 1) {
      setCurrentInfo((c) => c + 1);
    } else {
      setPhase("prefs");
    }
  };

  const goNextPref = () => {
    if (currentPref < 2) {
      setCurrentPref((c) => c + 1);
    } else {
      markComplete(true);
    }
  };

  const toggleMulti = (key: "categoriasFavoritas" | "mediosPagoPreferidos", value: string) => {
    setPrefs((p) => {
      const arr = p[key];
      return {
        ...p,
        [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
      };
    });
  };

  const setPref = (key: keyof Prefs, value: string) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const canAdvancePref = () => {
    if (currentPref === 0) return true;
    if (currentPref === 1) return prefs.categoriasFavoritas.length > 0;
    return true;
  };

  return (
    <motion.div
      className="fixed inset-0 z-[500] flex flex-col select-none"
      style={{ background: "#0F172A" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: "linear-gradient(90deg, #C9920A, #E8B028, #C9920A)" }}
      />

      <div className="flex justify-between items-center px-6 pt-10">
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
          <img src="/Logo2.png" alt="Club Patio" className="w-7 h-7 object-contain" />
        </div>
        <button
          onClick={() => markComplete(false)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-colors"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          <X className="w-3.5 h-3.5" />
          Saltar
        </button>
      </div>

      <AnimatePresence mode="wait">
        {phase === "info" ? (
          <motion.div
            key="info"
            className="flex-1 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentInfo}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.28, ease: "easeInOut" }}
                  className="flex flex-col items-center text-center gap-8 w-full"
                >
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
                    {INFO_SLIDES[currentInfo].emoji}
                  </motion.div>
                  <div className="space-y-4 max-w-[300px]">
                    <h2 className="text-[26px] font-black text-white leading-tight" style={{ fontFamily: "Montserrat, sans-serif" }}>
                      {INFO_SLIDES[currentInfo].title}
                    </h2>
                    <p className="text-[15px] leading-relaxed" style={{ color: "rgba(203,213,225,0.9)" }}>
                      {INFO_SLIDES[currentInfo].text}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex flex-col items-center gap-7 px-8 pb-14">
              <div className="flex items-center gap-2">
                {INFO_SLIDES.map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ width: i === currentInfo ? 28 : 8, opacity: i === currentInfo ? 1 : 0.3 }}
                    transition={{ duration: 0.3 }}
                    className="h-2 rounded-full"
                    style={{ background: i === currentInfo ? "#C9920A" : "white" }}
                  />
                ))}
              </div>
              <button
                onClick={goNextInfo}
                className="w-full max-w-[320px] h-14 rounded-2xl font-black text-white text-base transition-all active:scale-[0.97]"
                style={{
                  background: "linear-gradient(135deg, #C9920A 0%, #E8B028 100%)",
                  boxShadow: "0 8px 28px rgba(201,146,10,0.45)",
                  fontFamily: "Montserrat, sans-serif",
                }}
              >
                {currentInfo === INFO_SLIDES.length - 1 ? "Continuar →" : "Siguiente →"}
              </button>
              <p className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>
                {currentInfo + 1} / {INFO_SLIDES.length}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="prefs"
            className="flex-1 flex flex-col"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Encabezado de preferencias */}
            <div className="px-8 pt-6 pb-2 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#C9920A" }}>
                Personaliza tu experiencia
              </p>
              <h2 className="text-[22px] font-black text-white mt-1" style={{ fontFamily: "Montserrat, sans-serif" }}>
                {currentPref === 0 && "¿Cómo te describes?"}
                {currentPref === 1 && "¿Qué te gusta?"}
                {currentPref === 2 && "¿Cuándo y cómo visitas?"}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <AnimatePresence mode="wait" initial={false}>
                {currentPref === 0 && (
                  <motion.div key="pref0" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="space-y-5">
                    <PrefGroup label="Género">
                      {[
                        { id: "masculino", label: "Masculino" },
                        { id: "femenino", label: "Femenino" },
                        { id: "otro", label: "Otro" },
                        { id: "prefiero_no_decir", label: "Prefiero no decir" },
                      ].map((op) => (
                        <Chip key={op.id} selected={prefs.genero === op.id} onClick={() => setPref("genero", op.id)}>
                          {op.label}
                        </Chip>
                      ))}
                    </PrefGroup>
                    <PrefGroup label="Situación familiar">
                      {[
                        { id: "solo", label: "Vivo solo/a" },
                        { id: "pareja", label: "En pareja" },
                        { id: "familia_con_hijos", label: "Familia con hijos" },
                        { id: "otro", label: "Otra situación" },
                      ].map((op) => (
                        <Chip key={op.id} selected={prefs.situacionFamiliar === op.id} onClick={() => setPref("situacionFamiliar", op.id)}>
                          {op.label}
                        </Chip>
                      ))}
                    </PrefGroup>
                  </motion.div>
                )}

                {currentPref === 1 && (
                  <motion.div key="pref1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="space-y-5">
                    <PrefGroup label="Categorías favoritas (elige al menos una)">
                      {CATEGORIAS.map((cat) => (
                        <Chip key={cat.id} selected={prefs.categoriasFavoritas.includes(cat.id)} onClick={() => toggleMulti("categoriasFavoritas", cat.id)}>
                          {cat.label}
                        </Chip>
                      ))}
                    </PrefGroup>
                  </motion.div>
                )}

                {currentPref === 2 && (
                  <motion.div key="pref2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="space-y-5">
                    <PrefGroup label="Horario preferido de visita">
                      {HORARIOS.map((h) => (
                        <Chip key={h.id} selected={prefs.horarioPreferido === h.id} onClick={() => setPref("horarioPreferido", h.id)}>
                          {h.label}
                        </Chip>
                      ))}
                    </PrefGroup>
                    <PrefGroup label="Métodos de pago que usas">
                      {PAGOS.map((p) => (
                        <Chip key={p.id} selected={prefs.mediosPagoPreferidos.includes(p.id)} onClick={() => toggleMulti("mediosPagoPreferidos", p.id)}>
                          {p.label}
                        </Chip>
                      ))}
                    </PrefGroup>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col items-center gap-4 px-8 pb-10 pt-2">
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ width: i === currentPref ? 28 : 8, opacity: i === currentPref ? 1 : 0.3 }}
                    transition={{ duration: 0.3 }}
                    className="h-2 rounded-full"
                    style={{ background: i === currentPref ? "#C9920A" : "white" }}
                  />
                ))}
              </div>
              <button
                onClick={goNextPref}
                disabled={!canAdvancePref()}
                className="w-full max-w-[320px] h-14 rounded-2xl font-black text-white text-base transition-all active:scale-[0.97] disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #C9920A 0%, #E8B028 100%)",
                  boxShadow: "0 8px 28px rgba(201,146,10,0.45)",
                  fontFamily: "Montserrat, sans-serif",
                }}
              >
                {currentPref === 2 ? "¡Empezar! 🚀" : "Siguiente →"}
              </button>
              {currentPref === 1 && prefs.categoriasFavoritas.length === 0 && (
                <p className="text-[11px]" style={{ color: "rgba(201,146,10,0.7)" }}>Selecciona al menos una categoría</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PrefGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold transition-all active:scale-[0.96]"
      style={{
        background: selected ? "rgba(201,146,10,0.2)" : "rgba(255,255,255,0.06)",
        border: `1.5px solid ${selected ? "#C9920A" : "rgba(255,255,255,0.12)"}`,
        color: selected ? "#E8B028" : "rgba(203,213,225,0.75)",
      }}
    >
      {selected && <Check className="w-3 h-3" />}
      {children}
    </button>
  );
}
