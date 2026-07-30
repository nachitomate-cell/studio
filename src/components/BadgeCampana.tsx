"use client";

/**
 * Distintivo del evento por el que el socio entró al Club.
 *
 * Se alimenta de `usuarios.campanaRegistro`, que se escribe una sola vez al
 * crear la cuenta. Sirve para dos cosas: que el socio vea que pertenece a ese
 * grupo, y que el staff distinga de un vistazo de dónde vino cada persona.
 *
 * Si la campaña no está en el registro de CAMPANAS, no muestra nada — así un
 * slug viejo o mal escrito nunca ensucia la interfaz.
 */

import { campanaPorSlug } from "@/lib/campanas";

export function BadgeCampana({
  campana,
  tamano = "normal",
}: {
  campana: string | null | undefined;
  tamano?: "normal" | "chico";
}) {
  const c = campanaPorSlug(campana);
  if (!c) return null;

  const chico = tamano === "chico";

  return (
    <span
      title={`Se unió al Club en ${c.nombre}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: chico ? 4 : 6,
        padding: chico ? "2px 8px" : "5px 12px",
        borderRadius: 999,
        background: c.colorPrimario,
        color: c.colorTexto,
        fontSize: chico ? 10 : 11.5,
        fontWeight: 800,
        letterSpacing: "0.3px",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden style={{ fontSize: chico ? 11 : 13 }}>{c.emoji}</span>
      {c.etiqueta}
    </span>
  );
}
