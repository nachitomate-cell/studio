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
 * Roles con acceso al panel /moderador. El "director" tiene las mismas
 * facultades que admin (excepto entrar a /superadmin, que es por email).
 */
export const ROLES_STAFF_PANEL: readonly string[] = [
  "admin",
  "director",
  "director_patio",
  "moderador",
];

/**
 * Verifica si un usuario puede acceder al panel /moderador.
 * Acepta por allowlist de email (admin original + emails legados)
 * o por rol/roles en Firestore (admin/director/director_patio/moderador).
 */
export function canAccessModPanel(
  email: string | null | undefined,
  userData: { rol?: string; roles?: string[] } | null | undefined,
): boolean {
  if (email && ALLOWED_MOD_EMAILS.includes(email.trim().toLowerCase())) return true;
  if (!userData) return false;
  if (userData.rol && ROLES_STAFF_PANEL.includes(userData.rol)) return true;
  if (Array.isArray(userData.roles) && userData.roles.some((r) => ROLES_STAFF_PANEL.includes(r))) return true;
  return false;
}

/**
 * Quién puede sacar la base de datos del Club en un archivo (Excel de socios,
 * sellos, canjes, auditoría, planilla de socios, listado completo por API).
 *
 * Solo SynapTech. Por contrato (cláusulas 3 y 5, 11-04-2026) la infraestructura
 * y los activos digitales quedan bajo control del Desarrollador hasta el pago
 * total: el staff del Patio opera el panel y ve a los socios en pantalla, pero
 * no se lleva la base. Se valida en el servidor; ocultar los botones es solo
 * para que el panel no ofrezca algo que va a fallar.
 */
export function puedeExportarBase(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === SUPERADMIN_EMAIL;
}

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
