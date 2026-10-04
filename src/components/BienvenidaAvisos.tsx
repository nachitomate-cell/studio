"use client";

/**
 * Pantalla completa al abrir la app que pide activar las notificaciones.
 *
 * Reemplaza al banner chico que aparecía 2 segundos después de entrar: ese
 * pedido convertía 8%. Esta pantalla ocupa todo, explica qué se pierde sin los
 * avisos y deja un solo botón grande.
 *
 * Solo se monta cuando el permiso se puede pedir de verdad (estadoPush() ===
 * "preguntable"). En iPhone sin la app instalada el pedido es imposible, y de
 * eso ya se encarga PWAInstallBanner; si el permiso está denegado el navegador
 * no vuelve a preguntar, así que tampoco se muestra.
 */

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Bell, BellRing, Check, Gift, Stamp, Sparkles } from "lucide-react";

const ORO = "#C9920A";
const ORO_CLARO = "#E8B028";
const VERDE = "#8DC63F";
const CELESTE = "#5BB8D4";
const TEXTO = "#2C2C2C";
const TEXTO_SUAVE = "#6B6B6B";

/** Misma clave y plazo que usaba el banner anterior: quien lo cerró no lo ve en 7 días. */
export const AVISOS_SNOOZE_KEY = "push_banner_snooze";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const BENEFICIOS = [
  { icono: Stamp, color: ORO, titulo: "Cada sello al instante", texto: "Te llega la confirmación apenas el local lo registra." },
  { icono: Gift, color: VERDE, titulo: "Tus premios listos", texto: "Te avisamos cuando puedas canjear." },
  { icono: Sparkles, color: CELESTE, titulo: "Sorteos y promociones", texto: "Entérate primero si ganas." },
];

type Estado = "pidiendo" | "activando" | "listo" | "fallo";

export function BienvenidaAvisos({ onClose }: { onClose: () => void }) {
  const [estado, setEstado] = useState<Estado>("pidiendo");
  const quieto = useReducedMotion();

  const posponer = () => {
    try { localStorage.setItem(AVISOS_SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { }
    onClose();
  };

  const activar = async () => {
    setEstado("activando");
    try {
      // Import dinámico: el módulo toca APIs que fallan al cargar en Safari.
      const { registerFcmToken } = await import("@/lib/fcmTokenManager");
      const r = await registerFcmToken();
      if (r.ok) {
        setEstado("listo");
        setTimeout(onClose, 1800);
      } else if (r.reason === "denied") {
        // El navegador ya no volverá a preguntar: insistir no sirve.
        onClose();
      } else {
        setEstado("fallo");
      }
    } catch {
      setEstado("fallo");
    }
  };

  // Animaciones en bucle: se apagan si la persona pidió reducir movimiento.
  const bucle = (dur: number, delay = 0) =>
    quieto ? { duration: 0 } : { duration: dur, delay, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <motion.div
      className="fixed inset-0 z-[600] flex flex-col overflow-hidden select-none"
      style={{
        background: "#FAFAF7",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bienvenida-avisos-titulo"
    >
      {/* Manchas de color de la marca, flotando detrás */}
      {[
        { color: ORO, size: 280, top: "-90px", left: "-110px", dx: 30, dy: 24, dur: 9 },
        { color: VERDE, size: 240, top: "30%", left: "70%", dx: -26, dy: 30, dur: 11 },
        { color: CELESTE, size: 320, top: "72%", left: "-120px", dx: 34, dy: -22, dur: 13 },
      ].map((m, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{
            width: m.size, height: m.size, top: m.top, left: m.left,
            background: m.color, opacity: 0.16, filter: "blur(60px)",
          }}
          animate={quieto ? undefined : { x: [0, m.dx, 0], y: [0, m.dy, 0] }}
          transition={bucle(m.dur)}
        />
      ))}

      {/* Franja con los tres colores del logo */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, ${ORO}, ${VERDE}, ${CELESTE})` }}
      />

      {/* El centro scrollea si no cabe: en teléfonos bajos el botón nunca queda fuera de la pantalla */}
      <div className="relative flex-1 min-h-0 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-7 py-6 max-w-md w-full mx-auto">
        {/* Logo con la campana */}
        <motion.div
          className="relative mb-7 [@media(max-height:700px)]:mb-4"
          initial={{ scale: 0.6, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}
        >
          {/* Ondas que salen del logo */}
          {!quieto && estado !== "listo" && [0, 1].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${ORO}` }}
              initial={{ scale: 1, opacity: 0 }}
              animate={{ scale: [1, 1.55], opacity: [0.35, 0] }}
              transition={{ duration: 2.4, delay: 0.8 + i * 1.2, repeat: Infinity, ease: "easeOut" }}
            />
          ))}

          <motion.div
            className="w-36 h-36 [@media(max-height:700px)]:w-24 [@media(max-height:700px)]:h-24 rounded-full bg-white flex items-center justify-center"
            style={{ boxShadow: "0 18px 50px rgba(201,146,10,0.18), 0 2px 8px rgba(0,0,0,0.04)" }}
            animate={quieto ? undefined : { y: [0, -6, 0] }}
            transition={bucle(4)}
          >
            <img src="/Logo2.png" alt="Club Patio" className="w-24 h-24 [@media(max-height:700px)]:w-16 [@media(max-height:700px)]:h-16 object-contain" />
          </motion.div>

          {/* Campana: se mece cada tanto; al activar se vuelve un check verde */}
          <motion.div
            className="absolute -top-1 -right-1 w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: estado === "listo"
                ? VERDE
                : `linear-gradient(135deg, ${ORO} 0%, ${ORO_CLARO} 100%)`,
              boxShadow: "0 6px 18px rgba(201,146,10,0.4)",
              border: "3px solid #FAFAF7",
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.45 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {estado === "listo" ? (
                <motion.span key="check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}>
                  <Check className="w-6 h-6 text-white" strokeWidth={3} />
                </motion.span>
              ) : (
                <motion.span
                  key="campana"
                  style={{ display: "flex", transformOrigin: "50% 15%" }}
                  animate={quieto ? undefined : { rotate: [0, -18, 16, -12, 8, -4, 0, 0, 0, 0] }}
                  transition={quieto ? undefined : { duration: 2.6, delay: 1, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Bell className="w-6 h-6 text-white" strokeWidth={2.5} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        <AnimatePresence mode="wait">
          {estado === "listo" ? (
            <motion.div
              key="listo"
              className="text-center"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <h2 className="text-[26px] font-black leading-tight" style={{ color: TEXTO, fontFamily: "Montserrat, sans-serif" }}>
                ¡Listo, avisos activados!
              </h2>
              <p className="text-[15px] mt-3 leading-relaxed" style={{ color: TEXTO_SUAVE }}>
                Te avisaremos en este teléfono cada vez que pase algo en tu Club.
              </p>
            </motion.div>
          ) : (
            <motion.div key="pedir" className="w-full flex flex-col items-center" exit={{ opacity: 0 }}>
              <motion.p
                className="text-[11px] font-black uppercase tracking-[0.25em]"
                style={{ color: ORO }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Club Patio
              </motion.p>
              <motion.h2
                id="bienvenida-avisos-titulo"
                className="text-[26px] [@media(max-height:700px)]:text-[22px] font-black text-center leading-tight mt-2"
                style={{ color: TEXTO, fontFamily: "Montserrat, sans-serif" }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Que no se te escape ningún premio
              </motion.h2>
              <motion.p
                className="text-[14.5px] text-center leading-relaxed mt-3 max-w-[320px]"
                style={{ color: TEXTO_SUAVE }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                Activa las notificaciones y te llegará una alerta al teléfono. Sin ellas, solo te enteras si abres la app.
              </motion.p>

              <div className="w-full mt-7 [@media(max-height:700px)]:mt-4 space-y-2.5 [@media(max-height:700px)]:space-y-2">
                {BENEFICIOS.map((b, i) => (
                  <motion.div
                    key={b.titulo}
                    className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 [@media(max-height:700px)]:py-2"
                    style={{ border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.12, type: "spring", stiffness: 220, damping: 22 }}
                  >
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${b.color}22`, color: b.color }}
                    >
                      <b.icono className="w-5 h-5" strokeWidth={2.4} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold leading-tight" style={{ color: TEXTO }}>{b.titulo}</p>
                      <p className="text-[12px] leading-snug mt-0.5" style={{ color: TEXTO_SUAVE }}>{b.texto}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>

      {estado !== "listo" && (
        <motion.div
          className="relative px-7 pb-8 [@media(max-height:700px)]:pb-4 pt-3 max-w-md w-full mx-auto flex flex-col items-center gap-3 [@media(max-height:700px)]:gap-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95 }}
        >
          {estado === "fallo" && (
            <p className="text-[12px] text-center leading-snug" style={{ color: "#B45309" }}>
              No se pudo activar en este dispositivo. Puedes intentarlo más tarde desde tu perfil.
            </p>
          )}

          <button
            onClick={estado === "fallo" ? onClose : activar}
            disabled={estado === "activando"}
            className="relative w-full h-14 rounded-2xl font-black text-white text-[15px] overflow-hidden flex items-center justify-center gap-2 transition-transform active:scale-[0.97] disabled:opacity-70"
            style={{
              background: `linear-gradient(135deg, ${ORO} 0%, ${ORO_CLARO} 100%)`,
              boxShadow: "0 10px 28px rgba(201,146,10,0.38)",
              fontFamily: "Montserrat, sans-serif",
            }}
          >
            {/* Brillo que cruza el botón */}
            {!quieto && estado === "pidiendo" && (
              <motion.span
                aria-hidden
                className="absolute inset-y-0 w-1/3 pointer-events-none"
                style={{ background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent)" }}
                initial={{ left: "-40%" }}
                animate={{ left: ["-40%", "140%"] }}
                transition={{ duration: 1.4, delay: 1.6, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
              />
            )}
            {estado === "activando" ? (
              <>
                <motion.span
                  className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
                Activando…
              </>
            ) : estado === "fallo" ? (
              "Continuar"
            ) : (
              <>
                <BellRing className="w-5 h-5" />
                Activar notificaciones
              </>
            )}
          </button>

          {estado === "pidiendo" && (
            <button
              onClick={posponer}
              className="h-10 px-4 text-[13px] font-bold transition-opacity hover:opacity-70"
              style={{ color: TEXTO_SUAVE }}
            >
              Ahora no
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
