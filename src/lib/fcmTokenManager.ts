/**
 * fcmTokenManager.ts
 *
 * Obtiene el FCM token usando Firebase Messaging getToken()
 * y lo persiste en Firestore bajo usuarios/{uid}.fcmToken
 *
 * ORDEN CRÍTICO PARA iOS:
 *   1. Verificar soporte del navegador con isSupported()
 *   2. Notification.requestPermission()  ← DEBE estar en call stack de un click
 *   3. Verificar VAPID key
 *   4. Registrar firebase-messaging-sw.js
 *   5. getToken() con VAPID key
 *   6. Guardar token en Firestore
 */

"use client";

import { doc, updateDoc, getDoc } from "firebase/firestore";
import { app, db, auth } from "@/lib/firebase";

// NOTA: firebase/messaging NO se importa estáticamente aquí.
// El import estático fallaba en Safari/iOS fuera de PWA instalada al cargar el módulo.
// Se usa import dinámico dentro de la función para que solo se ejecute en browsers compatibles.

export type FcmResult =
  | { ok: true; token: string }
  | { ok: false; reason: "unsupported" | "denied" | "no_vapid_key" | "sw_error" | "token_error" | "no_user" };

/**
 * Solicita permiso, obtiene el FCM token y lo guarda en Firestore.
 * Debe llamarse SIEMPRE desde un handler de click — requisito de iOS.
 */
export async function registerFcmToken(): Promise<FcmResult> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "unsupported" };
  }

  // App de las tiendas: el WebView no tiene Web Push. El token sale del SDK
  // nativo de Firebase y es un token FCM normal, así que el servidor lo usa
  // igual que el de la PWA (usuarios/{uid}.fcmToken).
  const { esAppNativa } = await import("@/lib/nativo");
  if (esAppNativa()) return registerFcmTokenNativo();

  // 1. Verificar soporte básico del navegador
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[FCM] Navegador no soporta Push. Asegúrate de usar la PWA instalada en iOS.");
    return { ok: false, reason: "unsupported" };
  }

  // 2. Verificar soporte de Firebase Messaging con isSupported()
  //    (falla silenciosamente en Safari fuera de PWA standalone)
  try {
    const { isSupported } = await import("firebase/messaging");
    const supported = await isSupported();
    if (!supported) {
      console.warn("[FCM] Firebase Messaging no soportado en este entorno.");
      return { ok: false, reason: "unsupported" };
    }
  } catch (err) {
    console.warn("[FCM] isSupported() falló:", err);
    return { ok: false, reason: "unsupported" };
  }

  // 3. Solicitar permiso PRIMERO — antes de cualquier otra verificación
  //    iOS exige que requestPermission() esté en el call stack directo del click
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch (err) {
    console.error("[FCM] Error al solicitar permiso:", err);
    return { ok: false, reason: "denied" };
  }

  if (permission !== "granted") {
    console.warn("[FCM] Permiso denegado por el usuario.");
    return { ok: false, reason: "denied" };
  }

  // 4. Verificar VAPID key (después del permiso para no bloquear el diálogo de iOS)
  const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!VAPID_KEY) {
    console.error(
      "[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY no está configurada.\n" +
      "Agrégala en Vercel → Settings → Environment Variables.\n" +
      "Obtenla en: Firebase Console → Configuración → Cloud Messaging → Certificados web push."
    );
    return { ok: false, reason: "no_vapid_key" };
  }

  // 5. Registrar el SW de FCM
  let swRegistration: ServiceWorkerRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );
    // Esperar a que el SW esté activo antes de pedir token
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.error("[FCM] Error al registrar SW:", err);
    return { ok: false, reason: "sw_error" };
  }

  // 6. Obtener el token FCM con import dinámico
  let token: string;
  try {
    const { getMessaging, getToken } = await import("firebase/messaging");
    const messaging = getMessaging(app);
    const result = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!result) {
      console.warn("[FCM] getToken() retornó vacío. Verifica la VAPID key y el SW.");
      return { ok: false, reason: "token_error" };
    }
    token = result;
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    if (msg.includes("push service") || msg.includes("Registration failed") || msg.includes("not available")) {
      console.warn("[FCM] Push service no disponible en este entorno (normal en desktop/desarrollo).");
    } else {
      console.error("[FCM] Error al obtener token FCM:", err);
    }
    return { ok: false, reason: "token_error" };
  }

  // 7. Guardar en Firestore solo si cambió
  const user = auth.currentUser;
  if (!user) {
    console.warn("[FCM] No hay usuario autenticado.");
    return { ok: false, reason: "no_user" };
  }

  try {
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    const existingToken = userSnap.exists() ? userSnap.data().fcmToken : null;

    if (existingToken !== token) {
      await updateDoc(userRef, { fcmToken: token });
      console.info("[FCM] Token FCM registrado en Firestore.");
    } else {
      console.info("[FCM] Token FCM ya estaba actualizado.");
    }
  } catch (err) {
    // El token se obtuvo correctamente — el fallo al guardar no es fatal
    console.error("[FCM] Error guardando token en Firestore (no fatal):", err);
  }

  return { ok: true, token };
}

/**
 * Token FCM desde la app nativa (Android/iOS) con @capacitor-firebase/messaging.
 * El permiso lo pide el sistema; no hace falta service worker ni VAPID.
 */
async function registerFcmTokenNativo(): Promise<FcmResult> {
  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    let { receive } = await FirebaseMessaging.checkPermissions();
    if (receive !== "granted") ({ receive } = await FirebaseMessaging.requestPermissions());
    if (receive !== "granted") return { ok: false, reason: "denied" };
    const { token } = await FirebaseMessaging.getToken();
    if (!token) return { ok: false, reason: "token_error" };
    const r = await guardarTokenNativo(token);
    return r ?? { ok: true, token };
  } catch (err) {
    console.error("[FCM] Error obteniendo el token nativo:", err);
    return { ok: false, reason: "token_error" };
  }
}

/** Guarda el token nativo si cambió. Devuelve un error solo si no hay sesión. */
export async function guardarTokenNativo(token: string): Promise<FcmResult | null> {
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: "no_user" };
  try {
    const { esAppNativa, plataformaNativa } = await import("@/lib/nativo");
    if (!esAppNativa()) return null;
    const userRef = doc(db, "usuarios", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists() || snap.data().fcmToken !== token) {
      await updateDoc(userRef, { fcmToken: token, fcmPlataforma: `${plataformaNativa()}-app` });
    }
  } catch (err) {
    console.error("[FCM] Error guardando el token nativo (no fatal):", err);
  }
  return null;
}
