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
  /**
   * Abierta dentro de Instagram, Facebook u otra app. Esos navegadores internos
   * no tienen notificaciones ni dejan instalar: la única salida es abrir el link
   * en Chrome o Safari. Es como llega quien toca un link de una historia.
   */
  | "navegador_interno"
  /** El entorno no soporta push y no hay nada que el usuario pueda hacer. */
  | "no_soportado";

/** iPhone/iPad. El iPad moderno se reporta como Mac, de ahí el segundo chequeo. */
export function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
}

export function esAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

/**
 * Navegador embebido en otra app (Instagram, Facebook, Messenger, TikTok, Line)
 * o un WebView de Android ("; wv)"). WhatsApp abre los links en el navegador
 * real, así que no entra aquí.
 */
export function esNavegadorInterno(): boolean {
  if (typeof navigator === "undefined") return false;
  // La app nativa (Capacitor) también es un WebView "; wv)", pero es nuestra:
  // ahí no hay a dónde mandar a la persona.
  if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.()) return false;
  const ua = navigator.userAgent;
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|musical_ly|TikTok|BytedanceWebview|Line\//i.test(ua) ||
    (/android/i.test(ua) && /; wv\)/.test(ua));
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

  // Antes que todo lo demás: dentro de Instagram no sirve ni el botón ni los
  // pasos de Safari, porque no hay barra de Safari ni de Chrome a la vista.
  if (esNavegadorInterno()) return "navegador_interno";

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

/**
 * Link que saca la página del navegador interno. En Android el intent abre
 * Chrome directo; en iPhone no hay forma confiable desde la página, así que
 * devuelve null y se muestran los pasos a mano.
 */
export function linkAbrirEnNavegador(): string | null {
  if (typeof window === "undefined" || !esAndroid()) return null;
  const { host, pathname, search } = window.location;
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
}

/** Cómo salir del navegador interno a mano, según la app desde la que llegó. */
export function pasosSalirNavegadorInterno(): string {
  return esIOS()
    ? "Toca los tres puntos (···) arriba a la derecha y elige “Abrir en navegador externo”."
    : "Toca los tres puntos (⋮) arriba a la derecha y elige “Abrir en Chrome” o “Abrir en el navegador”.";
}

/**
 * Dónde se desbloquean los avisos cuando el socio dijo que no.
 *
 * En Android el permiso NO vive en los ajustes del teléfono: es de Chrome, por
 * sitio. Mandar a "Ajustes del sistema" deja a la persona buscando una app
 * "Patio Curauma" que no existe ahí (caso real, octubre 2026). En iPhone, la app
 * instalada sí aparece en Ajustes con el nombre del ícono: "Club Patio".
 */
export function pasosDesbloquear(): string {
  if (esIOS()) return "Ajustes del iPhone → Notificaciones → Club Patio → Permitir notificaciones";
  if (esAndroid()) {
    return estaInstalada()
      ? "Abre Chrome → toca ⋮ → Configuración → Configuración de sitios → Notificaciones → clubpatiocurauma.synaptechspa.cl → Permitir"
      : "Toca el ícono a la izquierda de la dirección (arriba) → Permisos → Notificaciones → Permitir";
  }
  return "Toca el candado junto a la dirección → Notificaciones → Permitir";
}
