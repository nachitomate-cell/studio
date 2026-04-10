/**
 * fcmTokenManager.ts
 *
 * Obtiene el FCM token usando Firebase Messaging getToken()
 * y lo persiste en Firestore bajo usuarios/{uid}.fcmToken
 *
 * ORDEN CRÍTICO PARA iOS:
 *   1. Verificar soporte del navegador
 *   2. Notification.requestPermission()  ← DEBE estar en call stack de un click
 *   3. Registrar firebase-messaging-sw.js
 *   4. getToken() con VAPID key
 *   5. Guardar token en Firestore
 */

"use client";

import { getMessaging, getToken } from "firebase/messaging";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { app, db, auth } from "@/lib/firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

export type FcmResult =
  | { ok: true; token: string }
  | { ok: false; reason: "unsupported" | "denied" | "no_vapid_key" | "sw_error" | "token_error" };

/**
 * Solicita permiso, obtiene el FCM token y lo guarda en Firestore.
 * Debe llamarse SIEMPRE desde un handler de click — requisito de iOS.
 */
export async function registerFcmToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  // 1. Verificar soporte (iOS 16.4+ en PWA standalone lo soporta)
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[FCM] Navegador no soporta Push. Asegúrate de usar la PWA instalada en iOS.");
    return null;
  }

  // 2. Solicitar permiso PRIMERO — antes de cualquier otra verificación
  //    iOS exige que requestPermission() esté en el call stack directo del click
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch (err) {
    console.error("[FCM] Error al solicitar permiso:", err);
    return null;
  }

  if (permission !== "granted") {
    console.warn("[FCM] Permiso denegado por el usuario.");
    return null;
  }

  // 3. Verificar VAPID key (después del permiso para no bloquear el diálogo de iOS)
  if (!VAPID_KEY) {
    console.error(
      "[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY no está configurada.\n" +
      "Agrégala en Vercel → Settings → Environment Variables.\n" +
      "Obtenla en: Firebase Console → Configuración → Cloud Messaging → Certificados web push."
    );
    // Permiso concedido pero sin token FCM — al menos el permiso quedó guardado
    return null;
  }

  try {
    // 4. Registrar el SW de FCM (único SW para el scope raíz)
    const swRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );

    // Esperar a que el SW esté activo antes de pedir token
    await navigator.serviceWorker.ready;

    // 5. Obtener el token FCM real
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      console.warn("[FCM] No se pudo obtener el token FCM. Verifica la VAPID key y el SW.");
      return null;
    }

    // 6. Guardar en Firestore solo si cambió
    const user = auth.currentUser;
    if (!user) return null;

    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    const existingToken = userSnap.exists() ? userSnap.data().fcmToken : null;

    if (existingToken !== token) {
      await updateDoc(userRef, { fcmToken: token });
      console.info("[FCM] Token FCM registrado en Firestore.");
    } else {
      console.info("[FCM] Token FCM ya estaba actualizado.");
    }

    return token;
  } catch (err) {
    console.error("[FCM] Error al registrar SW o obtener token:", err);
    return null;
  }
}
