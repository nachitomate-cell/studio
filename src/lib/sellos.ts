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
