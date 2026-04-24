"use client";

import { useState, useEffect, useRef } from "react";

// El evento beforeinstallprompt no está en los tipos estándar de TypeScript
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface PWAInstallBannerProps {
  /** UID del usuario autenticado. Al pasar de null → string se resetea el flag dismissed. */
  userId?: string | null;
}

export function PWAInstallBanner({ userId }: PWAInstallBannerProps) {
  const [show, setShow] = useState(false);
  const [animatedIn, setAnimatedIn] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const prevUserId = useRef<string | null | undefined>(undefined);

  // ── Detectar plataforma y suscribirse a beforeinstallprompt ────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Ya instalada como PWA → no mostrar nada
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      // iOS no dispara beforeinstallprompt; mostrar directamente si no fue descartado
      if (localStorage.getItem("pwa_dismissed") !== "true") {
        setShow(true);
        setTimeout(() => setAnimatedIn(true), 80);
      }
      return;
    }

    // Android / Desktop: esperar el evento del navegador
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      if (localStorage.getItem("pwa_dismissed") !== "true") {
        setShow(true);
        setTimeout(() => setAnimatedIn(true), 80);
      }
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  // ── Resetear flag dismissed cuando el usuario hace login / registro ────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SESSION_KEY = "pwa_reset_this_session";
    const justLoggedIn =
      prevUserId.current == null && // antes: sin sesión
      userId != null &&             // ahora: con sesión
      !sessionStorage.getItem(SESSION_KEY); // solo una vez por sesión de navegador

    if (justLoggedIn) {
      sessionStorage.setItem(SESSION_KEY, "1");
      localStorage.removeItem("pwa_dismissed");

      // Mostrar si hay prompt capturado (Android/Desktop) o si es iOS
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;

      if (!isStandalone && (deferredPrompt.current || isIOS)) {
        setShow(true);
        setTimeout(() => setAnimatedIn(true), 80);
      }
    }

    prevUserId.current = userId;
  }, [userId, isIOS]);

  // ── Acciones ───────────────────────────────────────────────────────────────
  const dismiss = () => {
    setDismissing(true);
    localStorage.setItem("pwa_dismissed", "true");
    setTimeout(() => {
      setShow(false);
      setDismissing(false);
    }, 320);
  };

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem("pwa_dismissed", "true");
      setShow(false);
    }
    deferredPrompt.current = null;
  };

  if (!show) return null;

  // ── Estilos de animación ───────────────────────────────────────────────────
  const bannerStyle: React.CSSProperties = {
    transform: animatedIn && !dismissing ? "translateY(0)" : "translateY(110%)",
    opacity: dismissing ? 0 : 1,
    transition: dismissing
      ? "transform 300ms ease-in, opacity 300ms ease-in"
      : "transform 400ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease-out",
  };

  return (
    <>
      {/* ── Banner fijo encima del tab bar ──────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 64, // altura exacta del BottomNav (h-16)
          left: 0,
          right: 0,
          zIndex: 49, // debajo del BottomNav (z-50) pero sobre el contenido
          padding: "0 12px 6px",
          ...bannerStyle,
        }}
      >
        {/* Card del banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #C9920A 0%, #8DC63F 100%)",
            borderRadius: "16px",
            padding: "14px 16px",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <img
            src="/Logo2.png"
            alt="Club Patio"
            style={{ width: 40, height: 40, objectFit: "contain", flexShrink: 0 }}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "15px", color: "white", lineHeight: 1.3 }}>
              Instala la aplicación
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.85)", marginTop: "3px", lineHeight: 1.3 }}>
              Accede más rápido a tus premios y sellos
            </p>
          </div>

          <button
            onClick={handleInstall}
            style={{
              flexShrink: 0,
              background: "white",
              color: "#C9920A",
              border: "none",
              borderRadius: "20px",
              padding: "8px 16px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {isIOS ? "Cómo instalar" : "Instalar"}
          </button>
        </div>

        {/* Link de descarte */}
        <p
          onClick={dismiss}
          style={{
            textAlign: "center",
            fontSize: "11px",
            color: "rgba(255,255,255,0.75)",
            margin: "7px 0 0",
            cursor: "pointer",
            userSelect: "none",
            letterSpacing: "0.2px",
          }}
        >
          No volver a mostrar
        </p>
      </div>

      {/* ── Modal de instrucciones para iOS ─────────────────────────────── */}
      {showIOSModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setShowIOSModal(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: "24px 24px 0 0",
              padding: "8px 24px 40px",
              width: "100%",
              maxWidth: "480px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 4, margin: "12px auto 20px" }} />

            <h3 style={{ fontWeight: 700, fontSize: "18px", margin: "0 0 20px", color: "#1a1a1a" }}>
              Cómo instalar en iOS
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[
                {
                  num: "1️⃣",
                  text: (
                    <>
                      Toca el botón <strong>Compartir</strong> (⬆) en la barra inferior de Safari
                    </>
                  ),
                },
                {
                  num: "2️⃣",
                  text: (
                    <>
                      Desplázate y toca <strong>"Agregar a pantalla de inicio"</strong>
                    </>
                  ),
                },
                {
                  num: "3️⃣",
                  text: (
                    <>
                      Confirma tocando <strong>"Agregar"</strong> en la esquina superior derecha
                    </>
                  ),
                },
              ].map(({ num, text }) => (
                <div key={num} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <span style={{ fontSize: "22px", flexShrink: 0, lineHeight: 1.4 }}>{num}</span>
                  <p style={{ margin: 0, fontSize: "14px", color: "#444", lineHeight: 1.55 }}>{text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              style={{
                width: "100%",
                marginTop: "28px",
                padding: "14px",
                background: "linear-gradient(135deg, #C9920A 0%, #8DC63F 100%)",
                color: "white",
                border: "none",
                borderRadius: "16px",
                fontWeight: 700,
                fontSize: "15px",
                cursor: "pointer",
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
