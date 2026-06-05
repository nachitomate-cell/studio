"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { CheckCircle2, Store, Clock, ShieldCheck, Star, Bell, X } from "lucide-react";

interface SuccessScannerProps {
  vendorName: string;
  userDisplayName?: string;
  newTotalSellos: number;
  onTimerEnd: () => void;
}

const TIMER_DURATION = 30;

export function SuccessScanner({ vendorName, userDisplayName, newTotalSellos, onTimerEnd }: SuccessScannerProps) {
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [currentTime, setCurrentTime] = useState(new Date());
  // Anti-fraude: color del fondo cicla entre tonos de verde para que sea imposible capturar un "verde fijo"
  const [hue, setHue] = useState(142);
  const onTimerEndRef = useRef(onTimerEnd);
  onTimerEndRef.current = onTimerEnd;

  const progress = (timeLeft / TIMER_DURATION) * 100;
  const circumference = 2 * Math.PI * 44;
  const strokeDashoffset = circumference - (circumference * progress) / 100;

  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Mostrar prompt de push 4 segundos después del sello
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    const snooze = localStorage.getItem("push_sello_snooze");
    if (snooze && Date.now() < Number(snooze)) return;
    const t = setTimeout(() => setShowPushPrompt(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const timerId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerId);
          onTimerEndRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Reloj en vivo — se actualiza cada 100ms para sub-segundo accuracy
    const clockId = setInterval(() => setCurrentTime(new Date()), 100);

    // Animación anti-fraude: el hue del fondo oscila ligeramente (gradiente animado imposible de capturar)
    let dir = 1;
    const hueId = setInterval(() => {
      setHue((h) => {
        if (h >= 150) dir = -1;
        if (h <= 130) dir = 1;
        return h + dir * 0.5;
      });
    }, 50);

    return () => {
      clearInterval(timerId);
      clearInterval(clockId);
      clearInterval(hueId);
    };
  }, []);

  const sellosDisplay = newTotalSellos > 0 ? newTotalSellos : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white overflow-hidden"
      style={{ background: `linear-gradient(135deg, hsl(${hue}, 65%, 38%) 0%, hsl(${hue + 15}, 75%, 28%) 100%)` }}
    >
      {/* Fondo animado con partículas/ondas — imposible reproducir en screenshot estático */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/10"
            style={{
              width: `${150 + i * 80}px`,
              height: `${150 + i * 80}px`,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              animation: `ping ${1.5 + i * 0.4}s cubic-bezier(0,0,0.2,1) infinite`,
              animationDelay: `${i * 0.3}s`,
              opacity: 0.15 - i * 0.02,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-xs px-6 flex flex-col items-center gap-6">

        {/* Ícono de éxito con ping */}
        <div className="relative flex items-center justify-center">
          <span className="absolute inline-flex h-32 w-32 rounded-full bg-white/20 animate-ping" />
          <div className="relative bg-white rounded-full p-5 shadow-2xl">
            <CheckCircle2 className="w-20 h-20 text-emerald-500" strokeWidth={2} />
          </div>
        </div>

        {/* Título principal */}
        <div className="text-center space-y-1">
          <h1 className="text-5xl font-black tracking-tight drop-shadow-lg">¡Sello!</h1>
          <p className="text-lg font-semibold text-white/80">
            {userDisplayName ? `¡Felicidades, ${userDisplayName.split(" ")[0]}!` : "¡Felicidades!"}
          </p>
        </div>

        {/* Card comprobante */}
        <div className="w-full bg-white/15 backdrop-blur-xl rounded-3xl border border-white/25 shadow-2xl overflow-hidden">
          {/* Local */}
          <div className="px-6 pt-5 pb-4 border-b border-white/15 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Local</p>
              <p className="text-xl font-black leading-tight">{vendorName}</p>
            </div>
          </div>

          {/* Sellos acumulados */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-white/15">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
              <span className="text-sm font-bold text-white/70">Sellos totales</span>
            </div>
            <span className="text-3xl font-black">{sellosDisplay}</span>
          </div>

          {/* Reloj en vivo — anti-fraude */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-white/60" />
              <span className="text-sm font-bold text-white/70">Hora de escaneo</span>
            </div>
            <span className="font-mono text-lg font-black tabular-nums tracking-wider">
              {currentTime.toLocaleTimeString("es-CL", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </span>
          </div>
        </div>

        {/* Temporizador circular + sello anti-fraude */}
        <div className="flex items-center gap-4">
          {/* SVG circular timer */}
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="white"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: "stroke-dashoffset 0.9s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black leading-none">{timeLeft}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">seg</span>
            </div>
          </div>

          {/* Anti-fraude badge */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="text-[11px] font-bold text-white/90 leading-tight">
                Comprobante válido
              </span>
            </div>
            <p className="text-[10px] text-white/50 text-center px-1">
              {new Date().toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-white/50 text-center">
          Muestra esta pantalla al vendedor. Caduca en {timeLeft}s.
        </p>
      </div>

      {/* Prompt de activación de push notifications */}
      {showPushPrompt && (
        <div className="absolute bottom-4 left-4 right-4 animate-in slide-in-from-bottom-3 duration-300">
          <div className="bg-white/15 backdrop-blur-xl border border-white/25 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white leading-tight">¿Te avisamos del próximo premio?</p>
              <p className="text-[10px] text-white/70 leading-tight mt-0.5">Activa las notificaciones y no pierdas ningún sello.</p>
            </div>
            <button
              disabled={pushLoading}
              onClick={async () => {
                setPushLoading(true);
                try {
                  const { registerFcmToken } = await import("@/lib/fcmTokenManager");
                  await registerFcmToken();
                } finally {
                  setPushLoading(false);
                  setShowPushPrompt(false);
                }
              }}
              className="shrink-0 bg-white text-emerald-700 text-[11px] font-black px-3 py-1.5 rounded-xl disabled:opacity-60 active:scale-95 transition-transform"
            >
              {pushLoading ? "…" : "Activar"}
            </button>
            <button
              onClick={() => {
                setShowPushPrompt(false);
                localStorage.setItem("push_sello_snooze", String(Date.now() + 14 * 24 * 60 * 60 * 1000));
              }}
              className="shrink-0 text-white/50 hover:text-white/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Barra de progreso inferior */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10">
        <div
          className="h-full bg-white/60"
          style={{
            width: `${progress}%`,
            transition: "width 0.9s linear",
          }}
        />
      </div>
    </div>
  );
}
