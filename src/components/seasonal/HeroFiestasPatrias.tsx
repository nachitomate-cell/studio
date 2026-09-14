"use client";

/**
 * HeroFiestasPatrias — cabecera dieciochera del inicio.
 *
 * Sigue el aviso que publicó Patio Curauma: mismo titular ("con el corazón
 * chileno"), los remolinos de papel que ellos destacan en el arte, y las
 * fechas, horario y lugar de la feria.
 *
 * Todo está dibujado con CSS a propósito: no depende de imágenes que haya que
 * subir, no se pixela en pantallas grandes y no puede quedar roto por un
 * archivo que falte. Se monta solo dentro de la ventana que define
 * `esTemporadaPatria`, y el 23 de septiembre desaparece sola.
 */

import { COLORES_PATRIOS, FERIA, saludoPatrio } from "@/lib/fiestasPatrias";

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
          background:
            "linear-gradient(90deg, transparent 0%, rgba(120,88,52,0.55) 8%, rgba(120,88,52,0.55) 92%, transparent 100%)",
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

/**
 * Remolino de papel, el mismo que Patio Curauma destaca en su aviso. Ocho
 * aspas en cono; gira lento para que se note sin distraer de la lectura.
 */
function Remolino({ tam = 46, opacidad = 1 }: { tam?: number; opacidad?: number }) {
  const aspas = 8;
  return (
    <span
      aria-hidden
      className="cpc-remolino"
      style={{
        position: "relative",
        display: "inline-block",
        width: tam,
        height: tam,
        opacity: opacidad,
      }}
    >
      {Array.from({ length: aspas }).map((_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            background: i % 2 === 0 ? rojo : azul,
            clipPath: "polygon(50% 50%, 50% 0%, 92% 18%)",
            transform: `rotate(${(360 / aspas) * i}deg)`,
          }}
        />
      ))}
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: tam * 0.2,
          height: tam * 0.2,
          marginTop: -(tam * 0.1),
          marginLeft: -(tam * 0.1),
          borderRadius: "50%",
          background: blanco,
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }}
      />
    </span>
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

/** Una casilla del bloque de datos de la feria. */
function Dato({ etiqueta, valor, ancho = false }: { etiqueta: string; valor: string; ancho?: boolean }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.94)",
        padding: "9px 10px",
        gridColumn: ancho ? "1 / -1" : undefined,
      }}
    >
      <p
        style={{
          fontSize: 8.5,
          fontWeight: 800,
          color: azul,
          letterSpacing: "1.6px",
          textTransform: "uppercase",
          margin: "0 0 2px 0",
        }}
      >
        {etiqueta}
      </p>
      <p
        style={{
          fontSize: 12.5,
          fontWeight: 800,
          color: "#1A1A1A",
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {valor}
      </p>
    </div>
  );
}

export function HeroFiestasPatrias() {
  const { titulo, acento, bajada, mostrarFeria } = saludoPatrio();

  return (
    <section
      style={{
        borderBottom: "1px solid #F0EDE8",
        padding: "34px 20px 20px",
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
            "linear-gradient(to bottom, rgba(255,251,244,0.46) 0%, rgba(255,251,244,0.84) 44%, rgba(255,255,255,0.97) 100%)",
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
          background: `radial-gradient(circle at 10% 30%, ${rojo}1C 0%, transparent 42%), radial-gradient(circle at 90% 34%, ${azul}1A 0%, transparent 42%)`,
          zIndex: 2,
        }}
      />

      <Guirnalda />

      {/* Remolinos a los costados, como en el aviso del Patio */}
      <span aria-hidden style={{ position: "absolute", left: 10, top: 62, zIndex: 3 }}>
        <Remolino tam={44} opacidad={0.5} />
      </span>
      {/* Va más arriba que el izquierdo: sin el bloque de la feria la sección
          se acorta y ahí abajo quedaría cortado por el borde. */}
      <span aria-hidden style={{ position: "absolute", right: 8, top: 72, zIndex: 3 }}>
        <Remolino tam={34} opacidad={0.42} />
      </span>

      {/* Logo */}
      <div style={{ position: "relative", zIndex: 4, marginBottom: 10 }}>
        <img
          src="/Logo3.webp"
          alt="Club Patio Curauma"
          style={{ width: 54, height: "auto", display: "block" }}
        />
      </div>

      <div style={{ position: "relative", zIndex: 4, width: "100%" }}>
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
            {bajada}
          </span>
        </div>

        <h1
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontSize: 22,
            fontWeight: 900,
            color: "#1A1A1A",
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            textWrap: "balance",
          }}
        >
          {titulo}
          <br />
          <span style={{ color: rojo }}>{acento}</span>
        </h1>

        {/* Línea tricolor, reemplaza la dorada de siempre */}
        <div
          aria-hidden
          style={{
            width: 70,
            height: 3,
            borderRadius: 2,
            margin: "10px auto 0",
            background: `linear-gradient(90deg, ${azul} 0%, ${azul} 33.3%, ${blanco} 33.3%, ${blanco} 66.6%, ${rojo} 66.6%, ${rojo} 100%)`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.16)",
          }}
        />

        {/* Cuándo, a qué hora y dónde: lo que la gente necesita para venir */}
        {mostrarFeria && (
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              background: "rgba(11,62,143,0.14)",
              border: "1px solid rgba(11,62,143,0.16)",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 3px 12px rgba(0,0,0,0.07)",
            }}
          >
            <Dato etiqueta="Cuándo" valor={`${FERIA.desde} al ${FERIA.hasta} de sept.`} />
            <Dato etiqueta="Horario" valor={FERIA.horario} />
            <Dato etiqueta="Dónde" valor={FERIA.lugar} ancho />
          </div>
        )}
      </div>

      <style>{`
        .cpc-banderin { animation: cpcOndear 3.4s ease-in-out infinite; }
        @keyframes cpcOndear {
          0%, 100% { rotate: -2.5deg; }
          50%      { rotate: 2.5deg; }
        }
        .cpc-remolino { animation: cpcGirar 9s linear infinite; }
        @keyframes cpcGirar {
          from { rotate: 0deg; }
          to   { rotate: 360deg; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cpc-banderin, .cpc-remolino { animation: none; }
        }
      `}</style>
    </section>
  );
}
