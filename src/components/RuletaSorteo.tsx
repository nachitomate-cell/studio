"use client";

/**
 * Ruleta del sorteo para el tótem del stand.
 *
 * El ganador YA está decidido en el servidor cuando esto se monta — la rueda es
 * puesta en escena, no el mecanismo. Eso es a propósito: la extracción tiene que
 * ser criptográfica y auditable (queda registrada con la lista de participantes),
 * no depender de dónde frene una animación en un navegador.
 *
 * Por eso el segmento ganador se coloca primero y el giro se calcula para
 * aterrizar ahí: se ve como una ruleta, pero no decide nada.
 *
 * Dibujada en SVG sobre el lienzo de 256 px del tótem. Los nombres van cortos —
 * a ese ancho, un apellido no se lee ni girando ni detenida.
 */

import { useEffect, useMemo, useState } from "react";

const DIAMETRO = 226;
const VUELTAS = 5;            // vueltas completas antes de frenar
const DURACION_MS = 4200;

export function RuletaSorteo({
  nombres,
  ganador,
  onTerminar,
}: {
  /** Muestra de participantes para llenar la rueda. */
  nombres: string[];
  /** Nombre de pila del ganador; se garantiza que esté en la rueda. */
  ganador: string;
  onTerminar: () => void;
}) {
  const [girando, setGirando] = useState(false);

  // El ganador ocupa el primer segmento y el resto se rellena con otros.
  const segmentos = useMemo(() => {
    const otros = nombres.filter((n) => n !== ganador);
    const total = Math.max(6, Math.min(10, otros.length + 1));
    return [ganador, ...otros.slice(0, total - 1)];
  }, [nombres, ganador]);

  const paso = 360 / segmentos.length;
  // Se frena con el centro del segmento 0 bajo la aguja (arriba).
  const anguloFinal = VUELTAS * 360 - paso / 2;

  useEffect(() => {
    const arranque = setTimeout(() => setGirando(true), 120);
    const fin = setTimeout(onTerminar, DURACION_MS + 900);
    return () => { clearTimeout(arranque); clearTimeout(fin); };
  }, [onTerminar]);

  const r = DIAMETRO / 2;
  const colores = ["#7B1E3A", "#3A0E1D", "#9E2A4C", "#2A0D1B"];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 900, color: "#D4AF37", letterSpacing: 2 }}>
        SORTEANDO
      </p>
      <p style={{ margin: "0 0 14px", fontSize: 11, color: "rgba(250,243,224,0.6)" }}>
        entre todos los inscritos
      </p>

      <div style={{ position: "relative", width: DIAMETRO, height: DIAMETRO }}>
        {/* Aguja */}
        <div style={{
          position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
          width: 0, height: 0, zIndex: 3,
          borderLeft: "11px solid transparent",
          borderRight: "11px solid transparent",
          borderTop: "20px solid #D4AF37",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
        }} />

        <svg
          width={DIAMETRO}
          height={DIAMETRO}
          viewBox={`0 0 ${DIAMETRO} ${DIAMETRO}`}
          style={{
            transform: `rotate(${girando ? anguloFinal : 0}deg)`,
            // Siempre puesta: activar la transición en el mismo render en que
            // cambia el transform hace que el navegador salte al valor final
            // sin animar. Por eso el arranque va con un setTimeout aparte.
            transition: `transform ${DURACION_MS}ms cubic-bezier(.12,.72,.11,1)`,
          }}
        >
          {segmentos.map((nombre, i) => {
            const a0 = (i * paso - 90) * (Math.PI / 180);
            const a1 = ((i + 1) * paso - 90) * (Math.PI / 180);
            const x0 = r + r * Math.cos(a0), y0 = r + r * Math.sin(a0);
            const x1 = r + r * Math.cos(a1), y1 = r + r * Math.sin(a1);
            const medio = (i * paso + paso / 2 - 90) * (Math.PI / 180);
            const tx = r + r * 0.62 * Math.cos(medio);
            const ty = r + r * 0.62 * Math.sin(medio);
            return (
              <g key={`${nombre}-${i}`}>
                <path
                  d={`M ${r} ${r} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`}
                  fill={colores[i % colores.length]}
                  stroke="rgba(212,175,55,0.45)"
                  strokeWidth={1.5}
                />
                <text
                  x={tx} y={ty}
                  fill="#FAF3E0" fontSize={13} fontWeight={800}
                  textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${i * paso + paso / 2} ${tx} ${ty})`}
                >
                  {nombre.slice(0, 9)}
                </text>
              </g>
            );
          })}
          <circle cx={r} cy={r} r={r - 1} fill="none" stroke="#D4AF37" strokeWidth={3} />
          <circle cx={r} cy={r} r={17} fill="#12060B" stroke="#D4AF37" strokeWidth={2.5} />
        </svg>
      </div>
    </div>
  );
}
