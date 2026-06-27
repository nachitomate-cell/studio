export const ADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "ignaciiio.mate@gmail.com"
).trim().toLowerCase();

export const SUPERADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL ??
  process.env.NEXT_PUBLIC_ADMIN_EMAIL ??
  "ignaciiio.mate@gmail.com"
).trim().toLowerCase();

export const ALLOWED_MOD_EMAILS: readonly string[] = [
  ADMIN_EMAIL,
  "fgcservicios@gmail.com",
];

/**
 * Dominio canónico de producción. Usar SIEMPRE para enlaces compartibles
 * (QR, "Copiar Enlace", links de referido) en lugar de window.location.origin
 * — así no se filtran dominios viejos/preview a clientes finales.
 */
export const CANONICAL_BASE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://clubpatiocurauma.synaptechspa.cl"
).replace(/\/$/, "");

export const SELLOS_PARA_RECOMPENSA = 5;
export const HANDSHAKE_EXPIRATION_MINUTES = 5;
export const PUNTOS_POR_COMPRA = 50;
export const PUNTOS_PRIMER_REGISTRO = 100;
