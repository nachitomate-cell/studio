/**
 * Cálculo de sellos según el monto de la compra. Punto único de verdad.
 * Misma escala usada en /api/handshake/confirm y /api/handshake/vendor-scan.
 */
export const SELLOS_PARA_PREMIO = 5;
export const MONTO_MAX = 150_000;

export function calcularSellos(monto: number): number {
  if (monto >= 40_000) return 4;
  if (monto >= 25_001) return 3;
  if (monto >= 10_001) return 2;
  return 1;
}

// Tier fijo para locales de tipo "membresia" (gimnasios, suscripciones, etc.).
// El cliente elige el plan al escanear; los sellos no dependen del monto.
export type MembresiaTier =
  | "mensual"
  | "trimestral"
  | "semestral"
  | "anual"
  | "personalizado_1m"
  | "personalizado_3m";

export const TIER_SELLOS: Record<MembresiaTier, number> = {
  mensual: 3,
  trimestral: 10,
  semestral: 15,
  anual: 25,
  personalizado_1m: 7,
  personalizado_3m: 20,
};

export const TIER_LABEL: Record<MembresiaTier, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  personalizado_1m: "Personalizado 1 mes",
  personalizado_3m: "Personalizado 3 meses",
};

export function esMembresiaTier(v: unknown): v is MembresiaTier {
  return (
    v === "mensual" ||
    v === "trimestral" ||
    v === "semestral" ||
    v === "anual" ||
    v === "personalizado_1m" ||
    v === "personalizado_3m"
  );
}

export function calcularSellosMembresia(tier: MembresiaTier): number {
  return TIER_SELLOS[tier];
}
