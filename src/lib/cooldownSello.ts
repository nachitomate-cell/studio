/**
 * Cooldown entre sellos del mismo local al mismo cliente.
 *
 * Existe por el incidente del 26-07-2026: la pantalla del cliente creó 84
 * solicitudes de sello en 2m33s hacia el mismo local, y el vendedor alcanzó a
 * confirmar 9 antes de darse cuenta. Cada solicitud era un documento distinto,
 * así que la idempotencia por pendingId no servía de nada.
 *
 * Esta es la red de seguridad del lado servidor: aunque el cliente vuelva a
 * pedir, el sello no se acredita dos veces seguidas en el mismo local. Se apoya
 * en `lastVendorScans[vendorId]`, que ya se escribe en cada acreditación.
 */

/** Ventana mínima entre dos sellos del mismo local al mismo cliente. */
export const COOLDOWN_SELLO_MS = 2 * 60 * 1000; // 2 minutos

/**
 * Lanza si el cliente ya recibió un sello de este local dentro de la ventana.
 * Se llama DENTRO de la transacción, con los datos ya leídos del usuario.
 *
 * @param userData  datos del documento usuarios/{uid} (null si aún no existe)
 * @param vendorId  local que intenta acreditar
 */
export function assertFueraDeCooldown(
  userData: Record<string, any> | null | undefined,
  vendorId: string,
): void {
  const ultimo = userData?.lastVendorScans?.[vendorId];
  if (!ultimo) return;

  // El campo se guarda como ISO string; toleramos Timestamp por si algún flujo
  // antiguo lo escribió así.
  const ms = typeof ultimo === "string"
    ? Date.parse(ultimo)
    : ultimo?.toDate?.()?.getTime?.() ?? NaN;
  if (Number.isNaN(ms)) return;

  const transcurrido = Date.now() - ms;
  if (transcurrido >= COOLDOWN_SELLO_MS || transcurrido < 0) return;

  const quedan = Math.ceil((COOLDOWN_SELLO_MS - transcurrido) / 1000);
  throw new Error(
    `Este cliente ya recibió un sello de tu local hace menos de 2 minutos. ` +
    `Espera ${quedan} segundo${quedan === 1 ? "" : "s"} para acreditar otro.`,
  );
}
