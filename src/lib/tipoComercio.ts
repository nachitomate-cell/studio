/**
 * Punto único de verdad para el tipo de comercio.
 *
 *  - "emprendedor": flujo handshake (el vendedor confirma/escanea en caja).
 *  - "asociado":    flujo auto-servicio (el cliente ingresa el monto y sube la
 *                   foto de la boleta; el sello se otorga al instante y el
 *                   moderador audita después).
 *  - "membresia":   flujo auto-servicio por tier fijo (gimnasios y similares).
 *                   El cliente elige Mensual/Trimestral/Semestral/Anual, sube
 *                   la boleta, y recibe sellos según el tier — sin ingresar
 *                   monto. El moderador audita y puede anular si mintió.
 *
 * Lectura tolerante: si el campo `tipo` no existe en el perfil, se asume
 * "emprendedor" (no rompe nada de lo existente).
 */

export type TipoComercio = "emprendedor" | "asociado" | "membresia";

export function getTipoComercio(data: unknown): TipoComercio {
  const tipo = (data as { tipo?: unknown } | null | undefined)?.tipo;
  if (tipo === "asociado") return "asociado";
  if (tipo === "membresia") return "membresia";
  return "emprendedor";
}

export function esAsociado(data: unknown): boolean {
  return getTipoComercio(data) === "asociado";
}

export function esMembresia(data: unknown): boolean {
  return getTipoComercio(data) === "membresia";
}

export const TIPO_LABEL: Record<TipoComercio, string> = {
  emprendedor: "Emprendedor",
  asociado: "Comercio Asociado",
  membresia: "Membresía (gimnasio)",
};

export const TIPO_EMOJI: Record<TipoComercio, string> = {
  emprendedor: "🎨",
  asociado: "🏪",
  membresia: "🏋️",
};
