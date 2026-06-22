/**
 * Punto único de verdad para el tipo de comercio.
 *
 *  - "emprendedor": flujo handshake (el vendedor confirma/escanea en caja).
 *  - "asociado":    flujo auto-servicio (el cliente ingresa el monto y sube la
 *                   foto de la boleta; el sello se otorga al instante y el
 *                   moderador audita después).
 *
 * Lectura tolerante: si el campo `tipo` no existe en el perfil, se asume
 * "emprendedor" (no rompe nada de lo existente).
 */

export type TipoComercio = "emprendedor" | "asociado";

export function getTipoComercio(data: unknown): TipoComercio {
  const tipo = (data as { tipo?: unknown } | null | undefined)?.tipo;
  return tipo === "asociado" ? "asociado" : "emprendedor";
}

export function esAsociado(data: unknown): boolean {
  return getTipoComercio(data) === "asociado";
}

export const TIPO_LABEL: Record<TipoComercio, string> = {
  emprendedor: "Emprendedor",
  asociado: "Comercio Asociado",
};

export const TIPO_EMOJI: Record<TipoComercio, string> = {
  emprendedor: "🎨",
  asociado: "🏪",
};
