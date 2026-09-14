"use client";

/**
 * HeroFiestasPatrias — versión dieciochera de la cabecera del inicio.
 *
 * Todo está dibujado con CSS a propósito: no depende de imágenes que haya que
 * subir, no se ve pixelado en pantallas grandes y no puede quedar rota por un
 * archivo que falte. Se monta solo dentro de la ventana que define
 * `esTemporadaPatria`, y el 23 de septiembre desaparece sola.
 */

import { COLORES_PATRIOS, saludoPatrio } from "@/lib/fiestasPatrias";

const { rojo, azul, blanco } = COLORES_PATRIOS;

/** Los banderines cuelgan en orden azul · blanco · rojo, como la bandera. */
const SECUENCIA = [azul, blanco, rojo];

function Guirnalda({ cantidad = 14 }: { cantidad?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 3,
        pointerEvents: "none",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        padding: "0 4px",
      }}
    >
      {/* La cuerda de la que cuelgan. Sin ella los triángulos parecen flotar. */}
      <span
        style={{
          position: "absolute",
          top: 1,
          left: 0,
          right: 0,
          height: 2,
          background: "linear-gradient(90deg, transparent 0%, rgba(120,88,52,0.55) 8%, rgba(120,88,52,0.55) 92%, transparent 100%)",
          borderRadius: 2,
        }}
      />
      {Array.from({ length: cantidad }).map((_, i) => {
        const color = SECUENCIA[i % SECUENCIA.length];
        // La cuerda cuelga: los del centro bajan más que los de las puntas.
        const curva = Math.sin((i / (cantidad - 1)) * Math.PI) * 9;
        return (
          <span
            key={i}
            className="cpc-banderin"
            style={{
              width: 17,
              height: 23,
              background: color,
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
              transform: `translateY(${curva}px)`,
              transformOrigin: "50% 0%",
              animationDelay: `${(i % 5) * 0.18}s`,
              // El blanco se pierde sobre el velo claro del fondo: una sombra
              // suave le devuelve el borde sin ensuciar el color.
              filter: color === blanco ? "drop-shadow(0 1px 1.5px rgba(0,0,0,0.28))" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

/** La estrella solitaria de la bandera, en una sola pieza CSS. */
function Estrella({ tam = 13, color = blanco }: { tam?: number; color?: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: tam,
        height: tam,
        background: color,
        clipPath:
          "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
      }}
    />
  );
}

export function HeroFiestasPatrias() {
  const { titulo, bajada } = saludoPatrio();

  return (
    <section
      style={{
        borderBottom: "1px solid #F0EDE8",
        padding: "34px 24px 18px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Fondo del patio, igual que el hero normal */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: "url('/header.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          zIndex: 0,
        }}
      />
      {/* Velo cálido: deja respirar la foto arriba y asegura lectura abajo */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, rgba(255,251,244,0.42) 0%, rgba(255,251,244,0.80) 46%, rgba(255,255,255,0.96) 100%)",
          zIndex: 1,
        }}
      />
      {/* Insinuación tricolor en las esquinas, muy tenue */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(circle at 12% 26%, ${rojo}1F 0%, transparent 44%), radial-gradient(circle at 88% 30%, ${azul}1C 0%, transparent 44%)`,
          zIndex: 2,
        }}
      />

      <Guirnalda />

      {/* Logo */}
      <div style={{ position: "relative", zIndex: 4, marginBottom: 10 }}>
        <img
          src="/Logo3.webp"
          alt="Club Patio Curauma"
          style={{ width: 58, height: "auto", display: "block" }}
        />
      </div>

      <div style={{ position: "relative", zIndex: 4 }}>
        {/* Cinta con la estrella solitaria */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "5px 13px 5px 10px",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${azul} 0%, ${azul} 38%, ${rojo} 38%, ${rojo} 100%)`,
            boxShadow: "0 2px 10px rgba(11,62,143,0.28)",
            marginBottom: 10,
          }}
        >
          <Estrella />
          <span
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontSize: 9,
              fontWeight: 800,
              color: blanco,
              letterSpacing: "2.2px",
              textTransform: "uppercase",
            }}
          >
            Chile · 18 de septiembre
          </span>
        </div>

        <h1
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontSize: 21,
            fontWeight: 900,
            color: "#1A1A1A",
            margin: 0,
            lineHeight: 1.08,
            letterSpacing: "-0.5px",
            textWrap: "balance",
          }}
        >
          {titulo}
        </h1>

        {/* Línea tricolor, reemplaza la dorada de siempre */}
        <div
          aria-hidden
          style={{
            width: 70,
            height: 3,
            borderRadius: 2,
            margin: "9px auto 8px",
            background: `linear-gradient(90deg, ${azul} 0%, ${azul} 33.3%, ${blanco} 33.3%, ${blanco} 66.6%, ${rojo} 66.6%, ${rojo} 100%)`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.16)",
          }}
        />

        <p
          style={{
            fontSize: 11,
            color: "#6B6B6B",
            letterSpacing: "1.3px",
            fontWeight: 700,
            textTransform: "uppercase",
            margin: "0 0 3px 0",
          }}
        >
          {bajada}
        </p>
        <p
          style={{
            fontSize: 10,
            color: "#9A9A9A",
            letterSpacing: "1.4px",
            fontWeight: 600,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Club Patio Curauma
        </p>
      </div>

      <style>{`
        .cpc-banderin {
          animation: cpcOndear 3.4s ease-in-out infinite;
        }
        @keyframes cpcOndear {
          0%, 100% { rotate: -2.5deg; }
          50%      { rotate: 2.5deg; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cpc-banderin { animation: none; }
        }
      `}</style>
    </section>
  );
}
