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

export const SELLOS_PARA_RECOMPENSA = 5;
export const HANDSHAKE_EXPIRATION_MINUTES = 5;
export const PUNTOS_POR_COMPRA = 50;
export const PUNTOS_PRIMER_REGISTRO = 100;
