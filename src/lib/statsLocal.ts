/**
 * Medición de lo que el Club le genera a cada local.
 *
 * POR QUÉ EXISTE: hasta octubre 2026 la app no medía nada del directorio. Un
 * local no tenía cómo saber cuánta gente vio su perfil o le escribió desde el
 * Club, y sin ese número no hay forma de venderle "aparecer destacado". Esto
 * cuenta apariciones, vistas y toques, y el local lo ve en /vendedor.
 *
 * Reglas para que el número sea creíble:
 *   - Una vez por persona y sesión: recargar o volver al perfil no suma de nuevo.
 *   - El dueño mirando su propio local no cuenta.
 *   - Se envía en lotes con sendBeacon: no frena la navegación ni se pierde al
 *     cerrar la pestaña.
 * El servidor (/api/stats/evento) vuelve a validar tipo y local.
 */

"use client";

import { auth } from "@/lib/firebase";

export type TipoEvento =
  | "impresion"   // la tarjeta del local apareció en pantalla en el directorio
  | "vista"       // abrieron el perfil del local
  | "whatsapp"    // tocaron WhatsApp (o reservar por WhatsApp)
  | "instagram"
  | "mapa"        // "Ver mapa" / cómo llegar
  | "contacto"    // botón principal de los locales premium
  | "bioo";       // link in bio

const CLAVE_SESION = "stats_enviados";
const ENDPOINT = "/api/stats/evento";

let cola: { localId: string; tipo: TipoEvento }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let escuchando = false;

function yaContado(clave: string): boolean {
  try {
    const set = new Set<string>(JSON.parse(sessionStorage.getItem(CLAVE_SESION) || "[]"));
    if (set.has(clave)) return true;
    set.add(clave);
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify([...set]));
    return false;
  } catch {
    return false; // sin sessionStorage se cuenta igual; el servidor no depende de esto
  }
}

function enviar() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (cola.length === 0) return;
  const eventos = cola.splice(0, 60);
  const cuerpo = JSON.stringify({ eventos });
  try {
    const ok = navigator.sendBeacon?.(ENDPOINT, new Blob([cuerpo], { type: "application/json" }));
    if (!ok) fetch(ENDPOINT, { method: "POST", body: cuerpo, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch { /* la medición nunca debe romper la app */ }
  if (cola.length > 0) enviar();
}

export function registrarEvento(localId: string | null | undefined, tipo: TipoEvento): void {
  if (typeof window === "undefined" || !localId) return;
  if (auth.currentUser?.uid === localId) return; // el dueño mirando su local
  if (yaContado(`${tipo}:${localId}`)) return;

  cola.push({ localId, tipo });

  if (!escuchando) {
    escuchando = true;
    // Al ocultar la pestaña (cambiar de app, cerrar) se manda lo pendiente.
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") enviar(); });
    window.addEventListener("pagehide", enviar);
  }
  // Los toques se mandan al tiro; las impresiones se juntan unos segundos.
  if (tipo !== "impresion") enviar();
  else if (!timer) timer = setTimeout(enviar, 4000);
}
