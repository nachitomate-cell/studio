"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "splash_aniv4_seen";

export function SplashScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setShow(true);
    const t = setTimeout(() => {
      setShow(false);
      sessionStorage.setItem(SESSION_KEY, "1");
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      onClick={() => {
        setShow(false);
        sessionStorage.setItem(SESSION_KEY, "1");
      }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "linear-gradient(160deg, #0a0500 0%, #1c1000 35%, #001408 65%, #001018 100%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer", overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Globos decorativos */}
      <span aria-hidden style={{ position: "absolute", left: "4%",  bottom: "8%",  fontSize: 38, pointerEvents: "none" }}>🎈</span>
      <span aria-hidden style={{ position: "absolute", left: "10%", bottom: "35%", fontSize: 28, pointerEvents: "none" }}>🎈</span>
      <span aria-hidden style={{ position: "absolute", right: "4%", bottom: "8%",  fontSize: 36, pointerEvents: "none" }}>🎈</span>
      <span aria-hidden style={{ position: "absolute", right: "10%",bottom: "38%", fontSize: 26, pointerEvents: "none" }}>🎈</span>

      {/* Destellos */}
      <span aria-hidden style={{ position: "absolute", left: "15%", top: "12%", fontSize: 20, pointerEvents: "none" }}>✨</span>
      <span aria-hidden style={{ position: "absolute", left: "78%", top: "10%", fontSize: 18, pointerEvents: "none" }}>🎊</span>
      <span aria-hidden style={{ position: "absolute", left: "48%", top: "6%",  fontSize: 16, pointerEvents: "none" }}>⭐</span>
      <span aria-hidden style={{ position: "absolute", left: "7%",  top: "40%", fontSize: 18, pointerEvents: "none" }}>🎉</span>
      <span aria-hidden style={{ position: "absolute", left: "87%", top: "38%", fontSize: 16, pointerEvents: "none" }}>✨</span>

      {/* Halo dorado */}
      <div style={{
        position: "absolute",
        width: 260, height: 260, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(201,146,10,0.2) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <img
        src="/Logo3.webp"
        alt="Patio Curauma"
        style={{
          width: 140, height: "auto",
          filter: "drop-shadow(0 0 28px rgba(201,146,10,0.5)) drop-shadow(0 6px 16px rgba(0,0,0,0.6))",
          position: "relative", zIndex: 1,
        }}
      />

      {/* Título */}
      <div style={{ textAlign: "center", marginTop: 18, position: "relative", zIndex: 1 }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, letterSpacing: "5px", textTransform: "uppercase", marginBottom: 4 }}>
          CLUB
        </p>
        <h1 style={{
          fontSize: 28, fontWeight: 900, letterSpacing: "2px", lineHeight: 1.1,
          background: "linear-gradient(90deg, #C9920A 0%, #FFD700 50%, #C9920A 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>
          PATIO CURAUMA
        </h1>
      </div>

      {/* Badge aniversario */}
      <div style={{
        marginTop: 22, position: "relative", zIndex: 1,
        background: "rgba(201,146,10,0.2)",
        border: "1.5px solid rgba(201,146,10,0.5)",
        borderRadius: 999, padding: "10px 22px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 22 }}>🎂</span>
        <span style={{ color: "white", fontWeight: 900, fontSize: 15, textShadow: "0 1px 8px rgba(201,146,10,0.8)" }}>
          ¡4 Años de Patio Design Curauma!
        </span>
        <span style={{ fontSize: 22 }}>🎂</span>
      </div>

      {/* Subtítulo */}
      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 600, letterSpacing: "1.5px", marginTop: 14, textTransform: "uppercase" }}>
        Fidelización · Premios · Comunidad
      </p>
    </div>
  );
}
