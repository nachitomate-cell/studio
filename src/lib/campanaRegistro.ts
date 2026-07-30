/**
 * Atribución de campaña al registro.
 *
 * POR QUÉ EXISTE: hasta ahora no había forma de saber desde qué acción de
 * marketing se inscribió un socio. `utm_visitas` guarda las visitas, pero en una
 * colección aparte y sin quedar en el documento del usuario, así que no se podía
 * responder "quiénes se inscribieron en tal evento" — que es exactamente lo que
 * se necesita para sortear entre los asistentes de una feria.
 *
 * El parámetro NO sobrevive los redirects del flujo de entrada
 * (/scan?ref=X → /unete pierde el query string), por eso se persiste en
 * localStorage en cuanto se toca cualquier página de entrada y se consume al
 * crear la cuenta.
 *
 * Uso: QR del evento apuntando a
 *   https://clubpatiocurauma.synaptechspa.cl/scan?ref=<localId>&evento=expovino
 */

"use client";

const CLAVE = "campana_registro";

/** Normaliza a un slug corto y seguro para usar como valor de campaña. */
function normalizar(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // sin acentos
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
}

/**
 * Lee `evento` o `utm_campaign` de la URL y lo guarda para el registro.
 * Idempotente y seguro de llamar en cada montaje. No sobrescribe una campaña
 * ya guardada con un valor vacío.
 */
export function capturarCampana(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const crudo = params.get("evento") || params.get("utm_campaign") || "";
    const campana = normalizar(crudo);
    if (!campana) return leerCampana();
    localStorage.setItem(CLAVE, campana);
    return campana;
  } catch {
    return null;
  }
}

export function leerCampana(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CLAVE) || null;
  } catch {
    return null;
  }
}

/** Se llama después de crear la cuenta, para que no se atribuya dos veces. */
export function limpiarCampana(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(CLAVE); } catch { /* sin importancia */ }
}
