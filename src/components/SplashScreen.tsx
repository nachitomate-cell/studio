"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "splash_aniv4_seen";

const BALLOONS_LEFT = [
  { bottom: "6%",  size: 42, delay: "0s",   dur: "4.0s" },
  { bottom: "28%", size: 32, delay: "0.8s", dur: "3.5s" },
  { bottom: "58%", size: 24, delay: "1.6s", dur: "4.6s" },
];

const BALLOONS_RIGHT = [
  { bottom: "6%",  size: 40, delay: "0.4s", dur: "3.8s" },
  { bottom: "32%", size: 30, delay: "1.3s", dur: "4.2s" },
  { bottom: "62%", size: 22, delay: "2.1s", dur: "3.6s" },
];

const SPARKLES = [
  { left: "12%", top: "12%", emoji: "✨", size: 22, delay: "0s",   dur: "2.4s" },
  { left: "80%", top: "10%", emoji: "🎊", size: 20, delay: "0.9s", dur: "3.0s" },
  { left: "48%", top: "5%",  emoji: "⭐", size: 18, delay: "0.4s", dur: "2.1s" },
  { left: "88%", top: "40%", emoji: "✨", size: 16, delay: "1.6s", dur: "2.8s" },
  { left: "5%",  top: "42%", emoji: "🌟", size: 18, delay: "0.2s", dur: "2.6s" },
  { left: "65%", top: "7%",  emoji: "🎉", size: 20, delay: "1.1s", dur: "3.2s" },
  { left: "28%", top: "8%",  emoji: "🌟", size: 16, delay: "1.8s", dur: "2.5s" },
  { left: "90%", top: "65%", emoji: "✨", size: 14, delay: "0.7s", dur: "2.9s" },
  { left: "3%",  top: "70%", emoji: "🎊", size: 16, delay: "1.4s", dur: "3.1s" },
];

export function SplashScreen() {
  const [show, setShow]       = useState(false);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setShow(true);

    const DURATION = 3800;
    const start = Date.now();
    const tick = setInterval(() => {
      setProgress(Math.min(100, ((Date.now() - start) / DURATION) * 100));
    }, 40);

    const t = setTimeout(dismiss, DURATION);
    return () => { clearTimeout(t); clearInterval(tick); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    setExiting(true);
    setTimeout(() => {
      setShow(false);
      sessionStorage.setItem(SESSION_KEY, "1");
    }, 480);
  }

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes splashBalloon {
          0%   { transform: translateY(0px)   rotate(-6deg); }
          50%  { transform: translateY(-18px)  rotate(6deg); }
          100% { transform: translateY(0px)   rotate(-6deg); }
        }
        @keyframes splashSparkle {
          0%, 100% { opacity: 0.35; transform: scale(0.75) rotate(-12deg); }
          50%       { opacity: 1;   transform: scale(1.3)  rotate(12deg);  }
        }
        @keyframes splashLogoIn {
          0%   { opacity: 0; transform: scale(0.55) translateY(24px); }
          65%  { transform: scale(1.07) translateY(-5px); }
          100% { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        @keyframes splashTitleIn {
          0%   { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0);    }
        }
        @keyframes splashBadgePop {
          0%   { opacity: 0; transform: scale(0.4); }
          70%  { transform: scale(1.12);             }
          100% { opacity: 1; transform: scale(1);    }
        }
        @keyframes splashPulse {
          0%, 100% { opacity: 0.85; transform: scale(1);    }
          50%       { opacity: 1;   transform: scale(1.04); }
        }
        @keyframes splashFadeOut {
          0%   { opacity: 1; transform: scale(1);    }
          100% { opacity: 0; transform: scale(1.04); }
        }
        @keyframes splashProgress {
          from { opacity: 0.5; }
          to   { opacity: 1;   }
        }
        .splash-logo-in    { animation: splashLogoIn  0.8s cubic-bezier(0.34,1.56,0.64,1) 0.2s both; }
        .splash-title-in   { animation: splashTitleIn 0.6s ease-out 0.85s both; }
        .splash-badge-pop  { animation: splashBadgePop 0.7s cubic-bezier(0.34,1.56,0.64,1) 1.3s both; }
        .splash-hint-in    { animation: splashTitleIn 0.5s ease-out 2.0s both; }
        .splash-exiting    { animation: splashFadeOut 0.48s ease-in-out forwards; }
      `}</style>

      <div
        onClick={dismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "linear-gradient(160deg, #0a0500 0%, #1c1000 30%, #001408 60%, #001018 100%)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          cursor: "pointer", overflow: "hidden",
          userSelect: "none",
        }}
        className={exiting ? "splash-exiting" : ""}
      >
        {/* Globos izquierda */}
        {BALLOONS_LEFT.map((b, i) => (
          <span key={`bl${i}`} aria-hidden style={{
            position: "absolute", left: "3%", bottom: b.bottom,
            fontSize: b.size, lineHeight: 1,
            animation: `splashBalloon ${b.dur} ease-in-out infinite`,
            animationDelay: b.delay, pointerEvents: "none",
          }}>🎈</span>
        ))}

        {/* Globos derecha */}
        {BALLOONS_RIGHT.map((b, i) => (
          <span key={`br${i}`} aria-hidden style={{
            position: "absolute", right: "3%", bottom: b.bottom,
            fontSize: b.size, lineHeight: 1,
            animation: `splashBalloon ${b.dur} ease-in-out infinite`,
            animationDelay: b.delay, pointerEvents: "none",
          }}>🎈</span>
        ))}

        {/* Destellos */}
        {SPARKLES.map((s, i) => (
          <span key={`sp${i}`} aria-hidden style={{
            position: "absolute", left: s.left, top: s.top,
            fontSize: s.size, lineHeight: 1,
            animation: `splashSparkle ${s.dur} ease-in-out infinite`,
            animationDelay: s.delay, pointerEvents: "none",
          }}>{s.emoji}</span>
        ))}

        {/* Halo de fondo detrás del logo */}
        <div style={{
          position: "absolute",
          width: 280, height: 280,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(201,146,10,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Logo */}
        <img
          src="/Logo3.webp"
          alt="Patio Curauma"
          className="splash-logo-in"
          style={{
            width: 150, height: "auto",
            filter: "drop-shadow(0 0 32px rgba(201,146,10,0.55)) drop-shadow(0 8px 20px rgba(0,0,0,0.6))",
            position: "relative", zIndex: 1,
          }}
        />

        {/* Título */}
        <div className="splash-title-in" style={{ textAlign: "center", marginTop: 20, position: "relative", zIndex: 1 }}>
          <p style={{
            color: "rgba(255,255,255,0.55)", fontSize: 11,
            fontWeight: 700, letterSpacing: "5px", textTransform: "uppercase", marginBottom: 4,
          }}>CLUB</p>
          <h1 style={{
            fontSize: 30, fontWeight: 900, letterSpacing: "2px",
            background: "linear-gradient(90deg, #C9920A 0%, #FFD700 50%, #C9920A 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "none", lineHeight: 1.1,
          }}>PATIO CURAUMA</h1>
        </div>

        {/* Badge aniversario */}
        <div className="splash-badge-pop" style={{
          marginTop: 24, position: "relative", zIndex: 1,
          background: "linear-gradient(135deg, rgba(201,146,10,0.25) 0%, rgba(141,198,63,0.2) 100%)",
          border: "1.5px solid rgba(201,146,10,0.5)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: 999,
          padding: "10px 24px",
          display: "flex", alignItems: "center", gap: 10,
          animation: "splashBadgePop 0.7s cubic-bezier(0.34,1.56,0.64,1) 1.3s both, splashPulse 2.6s ease-in-out 2s infinite",
        }}>
          <span style={{ fontSize: 22 }}>🎂</span>
          <span style={{
            color: "white", fontWeight: 900, fontSize: 15,
            letterSpacing: "0.3px",
            textShadow: "0 1px 8px rgba(201,146,10,0.8)",
          }}>¡4 Años de Patio Design Curauma!</span>
          <span style={{ fontSize: 22 }}>🎂</span>
        </div>

        {/* Frase */}
        <p className="splash-hint-in" style={{
          color: "rgba(255,255,255,0.4)", fontSize: 11,
          fontWeight: 600, letterSpacing: "1.5px",
          marginTop: 14, textTransform: "uppercase",
          position: "relative", zIndex: 1,
        }}>Fidelización · Premios · Comunidad</p>

        {/* Toca para continuar */}
        <p className="splash-hint-in" style={{
          position: "absolute", bottom: 48,
          color: "rgba(255,255,255,0.3)", fontSize: 11,
          fontWeight: 600, letterSpacing: "1px",
        }}>Toca para continuar</p>

        {/* Barra de progreso */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 3,
          background: "rgba(255,255,255,0.08)",
        }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: "linear-gradient(90deg, #C9920A, #FFD700, #8DC63F)",
            transition: "width 0.04s linear",
            borderRadius: "0 2px 2px 0",
          }} />
        </div>
      </div>
    </>
  );
}
