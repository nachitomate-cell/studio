"use client";

/**
 * Pantalla del stand — tótem LED vertical de 195×65 cm, 256×768 píxeles.
 *
 * El diseño se dibuja sobre un lienzo FIJO de 256×768 y después se escala para
 * calzar en la ventana. Así lo que se ve en el notebook es exactamente lo que
 * va a salir en el tótem, y no depende de unidades relativas que en un lienzo
 * tan angosto se descontrolan.
 *
 * Las restricciones mandan sobre el diseño:
 *  · 256 px de ancho: caben pocas palabras por línea, así que casi no hay texto.
 *  · Paso de píxel de ~2,5 mm: los detalles finos desaparecen; todo grueso.
 *  · Nadie la toca: sin navegación, sin botones, todo en una vista.
 *
 * Uso: abrir en pantalla completa (F11) en la salida conectada al tótem.
 */

import { useCallback, useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { CAMPANAS } from "@/lib/campanas";
import { CANONICAL_BASE_URL } from "@/lib/constants";

const CAMPANA = CAMPANAS.expovino;
const REFRESCO_MS = 5000;

// Lienzo real del tótem. Todo se dibuja contra estas medidas.
const ANCHO = 256;
const ALTO = 768;

type Datos = {
  total: number;
  ultimos: string[];
  ganador: { nombre: string; premio: string | null } | null;
};

export default function PantallaExpovino() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [campana, setCampana] = useState(CAMPANA.slug);
  const [escala, setEscala] = useState(1);
  const [subio, setSubio] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("campana");
    if (p) setCampana(p.trim().toLowerCase());
  }, []);

  // Escalar el lienzo para llenar la ventana sin deformarlo
  useEffect(() => {
    const ajustar = () => setEscala(Math.min(window.innerWidth / ANCHO, window.innerHeight / ALTO));
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/expovino/pantalla?campana=${encodeURIComponent(campana)}`, { cache: "no-store" });
      if (!r.ok) return;
      const d: Datos = await r.json();
      setDatos((prev) => {
        if (prev && d.total > prev.total) {
          setSubio(true);
          setTimeout(() => setSubio(false), 2000);
        }
        return d;
      });
    } catch { /* la red de una feria se cae; se reintenta al siguiente ciclo */ }
  }, [campana]);

  useEffect(() => {
    void cargar();
    const t = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  // El QR apunta al atajo /e, no a la URL larga: menos módulos, más gruesos,
  // que es lo que permite leerlo en un LED de paso grueso.
  const urlQR = `${CANONICAL_BASE_URL}/e`;
  const total = datos?.total ?? 0;

  // Tres dígitos a 132px ocupan ~215px de los 256 disponibles; cuatro no caben.
  const tamNumero = total >= 1000 ? 104 : 132;

  return (
    <main style={{
      width: "100vw", height: "100vh", overflow: "hidden", background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: ANCHO, height: ALTO, flexShrink: 0,
        transform: `scale(${escala})`, transformOrigin: "center center",
        background: "linear-gradient(160deg,#0B0407 0%,#2A0D1B 55%,#0B0407 100%)",
        color: "#fff", position: "relative",
        display: "flex", flexDirection: "column", alignItems: "center",
        fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
        padding: "18px 14px",
      }}>

        {/* Cabecera: solo el evento. El tótem está en el stand de SynapTech,
            así que la marca que firma abajo es esa, no la del recinto. */}
        <div style={{
          padding: "8px 20px", borderRadius: 999,
          background: CAMPANA.colorPrimario, color: CAMPANA.colorTexto,
          fontSize: 15, fontWeight: 900, letterSpacing: 1.6,
        }}>
          {CAMPANA.emoji} EXPOVINO 2026
        </div>

        {/* Contador */}
        <p style={{ margin: "30px 0 0", fontSize: 12, fontWeight: 800, color: "#94a3b8", letterSpacing: 1.4 }}>
          YA SE INSCRIBIERON
        </p>
        <p style={{
          margin: "2px 0 0", fontSize: tamNumero, fontWeight: 900, lineHeight: 0.92,
          fontVariantNumeric: "tabular-nums",
          color: subio ? "#9DCC65" : "#fff",
          textShadow: subio ? "0 0 26px rgba(157,204,101,0.7)" : "none",
          transition: "color .5s ease, text-shadow .5s ease",
        }}>
          {total}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "#cbd5e1", textAlign: "center", lineHeight: 1.3 }}>
          y participan por el<br />premio de la noche
        </p>

        {/* Recién inscritos: tres alcanzan, más no se lee */}
        {datos && datos.ultimos.length > 0 && (
          <div style={{ marginTop: 20, width: "100%" }}>
            <p style={{ margin: "0 0 7px", fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 1.4, textAlign: "center" }}>
              RECIÉN LLEGARON
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
              {datos.ultimos.slice(0, 3).map((n, i) => (
                <span key={`${n}-${i}`} style={{
                  padding: "5px 14px", borderRadius: 999, maxWidth: "100%",
                  background: i === 0 ? "rgba(157,204,101,0.2)" : "rgba(255,255,255,0.07)",
                  border: `1px solid ${i === 0 ? "rgba(157,204,101,0.5)" : "rgba(255,255,255,0.12)"}`,
                  fontSize: 16, fontWeight: 800, color: i === 0 ? "#9DCC65" : "#cbd5e1",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Llamada a la acción, abajo: es donde queda a la altura de la vista */}
        <div style={{ marginTop: "auto", width: "100%", textAlign: "center" }}>
          <p style={{ margin: "0 0 10px", fontSize: 19, fontWeight: 900, lineHeight: 1.15 }}>
            Escanea<br />y participa
          </p>
          <div style={{ background: "#fff", padding: 10, borderRadius: 10, display: "inline-block" }}>
            <QRCode value={urlQR} size={168} />
          </div>
          <p style={{ margin: "9px 0 0", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
            30 segundos y estás dentro
          </p>
        </div>

        {/* Firma. Discreta a propósito: el protagonista es el número que sube,
            pero quien pregunte "¿quién hizo esto?" tiene la respuesta a la vista. */}
        <div style={{ marginTop: 16, width: "100%", textAlign: "center" }}>
          <div style={{
            height: 1, width: "60%", margin: "0 auto 10px",
            background: "linear-gradient(90deg, transparent, rgba(250,243,224,0.28), transparent)",
          }} />
          <p style={{ margin: "0 0 5px", fontSize: 9, fontWeight: 700, color: "rgba(250,243,224,0.4)", letterSpacing: 1.6 }}>
            DESARROLLADO POR
          </p>
          <img src="/logo-synaptech-claro.png" alt="SynapTech"
            style={{ height: 22, objectFit: "contain", opacity: 0.9 }} />
        </div>

        {/* Ganador: tapa todo cuando ya se sorteó */}
        {datos?.ganador && (
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(160deg,#2A0D1B 0%,#7B1E3A 55%,#2A0D1B 100%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            textAlign: "center", padding: "0 16px",
          }}>
            <p style={{ margin: 0, fontSize: 72, lineHeight: 1 }}>🏆</p>
            <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 900, color: CAMPANA.colorTexto, letterSpacing: 2 }}>
              GANADOR
            </p>
            {/* El tamaño baja con el largo del nombre: a 256 px de ancho un
                "Bernardita" a 46px se parte en dos y se lee pésimo. */}
            <p style={{
              margin: "10px 0 0", fontWeight: 900, lineHeight: 1.05, color: "#fff",
              fontSize: datos.ganador.nombre.length <= 6 ? 52
                : datos.ganador.nombre.length <= 9 ? 40
                : datos.ganador.nombre.length <= 12 ? 32 : 26,
              hyphens: "none", wordBreak: "keep-all", whiteSpace: "nowrap",
              maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {datos.ganador.nombre}
            </p>
            {datos.ganador.premio && (
              <p style={{ margin: "16px 0 0", fontSize: 19, fontWeight: 800, color: "#FFD84D", lineHeight: 1.25 }}>
                {datos.ganador.premio}
              </p>
            )}
            <p style={{ margin: "22px 0 0", fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.35 }}>
              Acércate al mostrador<br />del Club Patio
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
