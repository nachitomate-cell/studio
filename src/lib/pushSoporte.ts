/**
 * Detección del estado real de las notificaciones push en el dispositivo.
 *
 * POR QUÉ EXISTE: el permiso de push no es un simple sí/no. Hay un caso que
 * no se puede resolver con un botón — iOS solo permite Web Push si la PWA está
 * agregada a la pantalla de inicio. En Safari navegando, `Notification` puede no
 * existir siquiera, así que mostrar un botón "Activar" es mostrar un botón que
 * no hace nada. Medido el 2026-07-29: 69 de 746 usuarios con push activo (9%),
 * y la cohorte más reciente convertía 8%, así que el techo no era de copy.
 *
 * Distinguir "puede pero no ha aceptado" de "no puede hasta instalar" es la
 * diferencia entre pedir bien y quemar el permiso.
 */

"use client";

export type EstadoPush =
  /** Ya tiene el permiso concedido. No hay nada que pedir. */
  | "concedido"
  /** Se puede pedir ahora mismo desde un click. */
  | "preguntable"
  /** Dijo no. El navegador no vuelve a preguntar: solo se arregla en ajustes. */
  | "denegado"
  /** iOS en Safari sin instalar: primero hay que agregar a pantalla de inicio. */
  | "requiere_instalacion"
  /** El entorno no soporta push y no hay nada que el usuario pueda hacer. */
  | "no_soportado";

/** iPhone/iPad. El iPad moderno se reporta como Mac, de ahí el segundo chequeo. */
export function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
}

/** La app corre como PWA instalada (no en una pestaña del navegador). */
export function estaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function estadoPush(): EstadoPush {
  if (typeof window === "undefined") return "no_soportado";

  // Si ya está concedido, da igual la plataforma.
  if ("Notification" in window && Notification.permission === "granted") {
    return "concedido";
  }

  // ORDEN IMPORTANTE: iOS va antes del chequeo genérico de soporte, porque en
  // Safari sin instalar las APIs de push directamente no existen y caeríamos
  // en "no_soportado" — ocultando que sí hay una salida (instalar la PWA).
  if (esIOS() && !estaInstalada()) return "requiere_instalacion";

  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "no_soportado";
  }

  if (Notification.permission === "denied") return "denegado";
  return "preguntable";
}
