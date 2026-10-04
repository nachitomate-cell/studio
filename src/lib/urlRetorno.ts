/**
 * Adónde volver después de iniciar sesión.
 *
 * POR QUÉ EXISTE: cuando alguien escanea el QR de un local sin sesión, /scan
 * guardaba "/canje?localId=…" en localStorage para retomarlo tras el login. Ese
 * valor no vencía nunca: si la persona entraba a su cuenta días después, la app
 * la mandaba directo a pedir un sello en ese local, aunque ya no estuviera ahí
 * (y /canje crea la solicitud apenas carga). Pasó el 2026-10-04 con un QR de
 * prueba viejo del emulador.
 *
 * Ahora se guarda con la hora y se descarta pasados 30 minutos: alcanza para
 * escanear, registrarse y volver, pero no para revivir un escaneo de otro día.
 * Los valores guardados en el formato viejo (texto plano, sin hora) se descartan.
 */

"use client";

const CLAVE = "url_retorno";
const VIGENCIA_MS = 30 * 60 * 1000;

export function guardarRetorno(url: string): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ url, t: Date.now() }));
  } catch { /* modo privado o storage lleno: se pierde el retorno, no es crítico */ }
}

/** Devuelve la URL pendiente si sigue vigente, y la borra siempre. */
export function tomarRetorno(): string | null {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return null;
    localStorage.removeItem(CLAVE);
    const { url, t } = JSON.parse(raw) as { url?: unknown; t?: unknown };
    if (typeof url !== "string" || typeof t !== "number") return null;
    if (Date.now() - t > VIGENCIA_MS) return null;
    return url;
  } catch {
    return null;
  }
}

export function borrarRetorno(): void {
  try { localStorage.removeItem(CLAVE); } catch { /* */ }
}
