"use client";

/**
 * Confeti sobre lienzo, escrito acá en vez de traer una librería.
 *
 * No es por evitar una dependencia porque sí: el estallido tiene que salir del
 * centro de la rueda, que se mueve según el formato de pantalla, y tiene que
 * poder frenarse en un equipo lento. Con una librería genérica eso se pelea; en
 * 120 líneas se controla entero.
 *
 * Se dibuja en un <canvas> y no con elementos del DOM: doscientos nodos
 * animándose a 60 fps hacen sudar al navegador de un tótem, un canvas no.
 */

import { useEffect, useRef } from "react";

const COLORES = ["#D4AF37", "#FFD84D", "#7B1E3A", "#F3D9E1", "#FF4B91", "#FFF3E2", "#9E2A4C"];

type Pieza = {
  x: number; y: number; vx: number; vy: number;
  ancho: number; alto: number;
  giro: number; vGiro: number;
  color: string; redonda: boolean;
  vida: number;
};

export function Confeti({
  disparo, origen,
}: {
  /** Cada valor nuevo lanza un estallido. Cero o menos no dispara nada. */
  disparo: number;
  /** Centro del estallido, en fracción de la pantalla (0–1). */
  origen: { x: number; y: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const piezas = useRef<Pieza[]>([]);
  const animando = useRef(false);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);
  // El origen se lee dentro del bucle, que no se re-crea en cada render.
  const origenRef = useRef(origen);
  origenRef.current = origen;

  useEffect(() => {
    if (disparo <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);   // en 3x no se nota y cuesta el triple
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    canvas.width = ancho * dpr;
    canvas.height = alto * dpr;
    canvas.style.width = `${ancho}px`;
    canvas.style.height = `${alto}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const ox = origenRef.current.x * ancho;
    const oy = origenRef.current.y * alto;
    const escala = Math.max(0.75, Math.min(alto / 760, 2));

    const nueva = (x: number, y: number, vx: number, vy: number): Pieza => ({
      x, y, vx, vy,
      ancho: (5 + Math.random() * 6) * escala,
      alto: (7 + Math.random() * 9) * escala,
      giro: Math.random() * Math.PI * 2,
      vGiro: (Math.random() - 0.5) * 0.34,
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
      redonda: Math.random() < 0.22,
      vida: 1,
    });

    // Estallido radial desde el centro de la rueda.
    for (let i = 0; i < 120; i++) {
      const ang = Math.random() * Math.PI * 2;
      const fuerza = (5 + Math.random() * 12) * escala;
      piezas.current.push(nueva(ox, oy, Math.cos(ang) * fuerza, Math.sin(ang) * fuerza - 4 * escala));
    }
    // Y dos chorros desde abajo, que son los que llenan la pantalla.
    for (const lado of [0.08, 0.92]) {
      for (let i = 0; i < 45; i++) {
        const ang = -Math.PI / 2 + (lado < 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.45);
        const fuerza = (14 + Math.random() * 11) * escala;
        piezas.current.push(nueva(lado * ancho, alto + 10, Math.cos(ang) * fuerza, Math.sin(ang) * fuerza));
      }
    }

    if (animando.current) return;   // ya hay un bucle corriendo; solo se sumaron piezas
    animando.current = true;

    const GRAVEDAD = 0.34 * escala;
    const ROCE = 0.986;

    const paso = () => {
      // Si la página se fue, el bucle tiene que morir con ella: seguir pidiendo
      // cuadros contra un canvas huérfano deja el equipo trabajando de gratis.
      if (!vivo.current) { animando.current = false; piezas.current = []; return; }
      ctx.clearRect(0, 0, ancho, alto);

      piezas.current = piezas.current.filter((p) => {
        p.vx *= ROCE;
        p.vy = p.vy * ROCE + GRAVEDAD;
        p.x += p.vx;
        p.y += p.vy;
        p.giro += p.vGiro;
        // Recién empieza a desvanecerse cuando ya va cayendo: si se apaga desde
        // el principio, el estallido se ve deslavado justo en su mejor momento.
        if (p.y > alto * 0.55) p.vida -= 0.012;
        return p.vida > 0 && p.y < alto + 60;
      });

      for (const p of piezas.current) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.giro);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.vida));
        ctx.fillStyle = p.color;
        if (p.redonda) {
          ctx.beginPath();
          ctx.arc(0, 0, p.ancho / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // El ancho late para simular el papel girando sobre su propio eje.
          ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho * Math.abs(Math.cos(p.giro * 1.6)), p.alto);
        }
        ctx.restore();
      }

      if (piezas.current.length) {
        requestAnimationFrame(paso);
      } else {
        animando.current = false;
        ctx.clearRect(0, 0, ancho, alto);
      }
    };
    requestAnimationFrame(paso);
  }, [disparo]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", inset: 0, zIndex: 40,
        pointerEvents: "none",   // nunca debe robarle el toque a la ruleta
      }}
    />
  );
}
