"use client";

/**
 * Pantalla del stand — para proyectar en la LED durante la feria.
 *
 * Se diseña para leerse a 4 metros y sin que nadie la toque: tipografía enorme,
 * contraste alto y todo en una sola vista. No hay navegación ni botones.
 *
 * El objetivo no es decorar: es que un expositor que pasa caminando vea un
 * número subiendo y pregunte qué es. Eso abre la conversación mejor que
 * cualquier folleto.
 *
 * Uso: abrir /expovino/pantalla?campana=expovino en pantalla completa (F11).
 */

import { useCallback, useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { CAMPANAS } from "@/lib/campanas";
import { CANONICAL_BASE_URL } from "@/lib/constants";

const CAMPANA = CAMPANAS.expovino;
const REFRESCO_MS = 5000;

type Datos = {
  total: number;
  ultimos: string[];
  ganador: { nombre: string; premio: string | null } | null;
};

export default function PantallaExpovino() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [campana, setCampana] = useState(CAMPANA.slug);
  const [subio, setSubio] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("campana");
    if (p) setCampana(p.trim().toLowerCase());
  }, []);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/expovino/pantalla?campana=${encodeURIComponent(campana)}`, { cache: "no-store" });
      if (!r.ok) return;
      const d: Datos = await r.json();
      setDatos((prev) => {
        // Destello cuando entra alguien nuevo: es lo que hace que la pantalla
        // se sienta viva y que la gente se quede mirando.
        if (prev && d.total > prev.total) {
          setSubio(true);
          setTimeout(() => setSubio(false), 1800);
        }
        return d;
      });
    } catch { /* la feria tiene mala red; se reintenta al siguiente ciclo */ }
  }, [campana]);

  useEffect(() => {
    void cargar();
    const t = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  const urlRegistro = `${CANONICAL_BASE_URL}/unete?evento=${campana}`;
  const total = datos?.total ?? 0;

  return (
    <main style={{
      minHeight: "100vh", width: "100%", overflow: "hidden",
      background: "linear-gradient(140deg,#0B0407 0%,#2A0D1B 50%,#0B0407 100%)",
      color: "#fff", display: "flex", flexDirection: "column",
      fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
    }}>
      {/* Marca */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3vh 4vw 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.2vw" }}>
          <img src="/Logo2.png" alt="" style={{ height: "6vh", objectFit: "contain" }} />
          <div>
            <p style={{ margin: 0, fontSize: "1.9vh", fontWeight: 900, letterSpacing: "0.3vh" }}>CLUB PATIO CURAUMA</p>
            <p style={{ margin: 0, fontSize: "1.5vh", color: "#94a3b8", letterSpacing: "0.2vh" }}>
              por SynapTech
            </p>
          </div>
        </div>
        <div style={{
          padding: "1vh 2vw", borderRadius: 999,
          background: CAMPANA.colorPrimario, color: CAMPANA.colorTexto,
          fontSize: "1.9vh", fontWeight: 900, letterSpacing: "0.3vh",
        }}>
          {CAMPANA.emoji} EXPOVINO 2026
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "4vw", padding: "0 4vw" }}>

        {/* Contador */}
        <section style={{ flex: 1.2, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "2.4vh", fontWeight: 800, color: "#94a3b8", letterSpacing: "0.5vh" }}>
            SOCIOS INSCRITOS ESTA NOCHE
          </p>
          <p style={{
            margin: "1vh 0 0",
            fontSize: "26vh", fontWeight: 900, lineHeight: 0.9,
            color: subio ? "#9DCC65" : "#fff",
            textShadow: subio ? "0 0 6vh rgba(157,204,101,0.55)" : "none",
            transition: "color .5s ease, text-shadow .5s ease",
            fontVariantNumeric: "tabular-nums",
          }}>
            {total}
          </p>
          <p style={{ margin: "1.5vh 0 0", fontSize: "2.6vh", color: "#cbd5e1", fontWeight: 600 }}>
            participando por el premio de la noche
          </p>

          {/* Últimos en llegar */}
          {datos && datos.ultimos.length > 0 && (
            <div style={{ marginTop: "4vh" }}>
              <p style={{ margin: "0 0 1.5vh", fontSize: "1.8vh", fontWeight: 800, color: "#64748b", letterSpacing: "0.4vh" }}>
                RECIÉN INSCRITOS
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1vh", justifyContent: "center" }}>
                {datos.ultimos.map((n, i) => (
                  <span key={`${n}-${i}`} style={{
                    padding: "0.9vh 1.8vw", borderRadius: 999,
                    background: i === 0 ? "rgba(157,204,101,0.2)" : "rgba(255,255,255,0.07)",
                    border: `1px solid ${i === 0 ? "rgba(157,204,101,0.5)" : "rgba(255,255,255,0.12)"}`,
                    fontSize: "2.2vh", fontWeight: 700,
                    color: i === 0 ? "#9DCC65" : "#cbd5e1",
                  }}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Llamada a la acción */}
        <section style={{
          flex: 0.8, textAlign: "center",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: "3vh", padding: "4vh 3vw",
        }}>
          <p style={{ margin: 0, fontSize: "3.6vh", fontWeight: 900, lineHeight: 1.15 }}>
            Escanea y participa
          </p>
          <p style={{ margin: "1.2vh 0 3vh", fontSize: "2.2vh", color: "#94a3b8", lineHeight: 1.4 }}>
            Te inscribes en 30 segundos y entras al sorteo
          </p>
          <div style={{ background: "#fff", padding: "2.2vh", borderRadius: "2vh", display: "inline-block" }}>
            <QRCode value={urlRegistro} size={256} style={{ width: "26vh", height: "26vh" }} />
          </div>
          <p style={{ margin: "2.5vh 0 0", fontSize: "1.7vh", color: "#64748b", wordBreak: "break-all" }}>
            {urlRegistro.replace(/^https?:\/\//, "")}
          </p>
        </section>
      </div>

      {/* Ganador: ocupa la pantalla completa cuando ya se sorteó */}
      {datos?.ganador && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10,
          background: "linear-gradient(140deg,#2A0D1B 0%,#7B1E3A 55%,#2A0D1B 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: "0 6vw",
        }}>
          <p style={{ margin: 0, fontSize: "12vh" }}>🏆</p>
          <p style={{ margin: "1vh 0 0", fontSize: "3vh", fontWeight: 800, color: CAMPANA.colorTexto, letterSpacing: "0.6vh" }}>
            GANADOR DE LA NOCHE
          </p>
          <p style={{ margin: "2vh 0 0", fontSize: "16vh", fontWeight: 900, lineHeight: 1, color: "#fff" }}>
            {datos.ganador.nombre}
          </p>
          {datos.ganador.premio && (
            <p style={{ margin: "3vh 0 0", fontSize: "4vh", fontWeight: 700, color: "#FFD84D" }}>
              {datos.ganador.premio}
            </p>
          )}
          <p style={{ margin: "4vh 0 0", fontSize: "2.6vh", color: "rgba(255,255,255,0.75)" }}>
            Acércate al mostrador del Club Patio Curauma
          </p>
        </div>
      )}
    </main>
  );
}
