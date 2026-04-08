/**
 * fcmTokenManager.ts
 *
 * Gestiona el FCM Token del dispositivo actual:
 *   1. Solicita permiso de notificaciones al usuario.
 *   2. Obtiene el token FCM del Service Worker.
 *   3. Lo registra en el backend (Cloud Function) y en Firestore.
 *
 * Llamar desde: UserProfile.tsx → onMount cuando el usuario está autenticado.
 */

"use client";

import { auth } from "@/lib/firebase";

// URL de la Cloud Function (actualiza con tu URL real tras el deploy)
const REGISTER_TOKEN_URL = "https://us-central1-TU_PROJECT_ID.cloudfunctions.net/registerFcmToken";

// VAPID Key pública de tu proyecto Firebase (consola → Configuración del proyecto → Cloud Messaging → Certificados web push)
const VAPID_KEY = "TU_VAPID_KEY_PUBLICA";

/**
 * Solicita permiso, obtiene el token y lo registra en el backend.
 * Llama esta función después de que el usuario haga clic en "Activar notificaciones".
 *
 * @returns El token FCM si se obtuvo con éxito, null si no.
 */
export async function registerFcmToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[FCM] El navegador no soporta Push Notifications.");
    return null;
  }

  // 1. Solicitar permiso al usuario
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("[FCM] Permiso denegado.");
    return null;
  }

  try {
    // 2. Obtener el Service Worker registrado
    const registration = await navigator.serviceWorker.ready;

    // 3. Suscribir al push (obtenemos el token FCM via firebase/messaging)
    //    Usamos la API nativa de ServiceWorker porque firebase/messaging
    //    no funciona bien en Next.js con App Router sin configuración adicional.
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
    });

    // El token para FCM se obtiene del endpoint string
    const token = btoa(JSON.stringify(subscription));

    // 4. Registrar el token en el backend
    const user = auth.currentUser;
    if (!user) return null;

    await fetch(REGISTER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: user.uid, token }),
    });

    console.info("[FCM] Token registrado exitosamente.");
    return token;
  } catch (err) {
    console.error("[FCM] Error al obtener/registrar token:", err);
    return null;
  }
}

// ── Utilidad: convierte la VAPID key de base64 a Uint8Array ──────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
