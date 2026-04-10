/**
 * fcmTokenManager.ts
 *
 * Obtiene el FCM token real usando Firebase Messaging getToken()
 * y lo persiste en Firestore bajo usuarios/{uid}.fcmToken
 *
 * El Service Worker firebase-messaging-sw.js debe estar en /public
 * y el VAPID key debe estar en NEXT_PUBLIC_FIREBASE_VAPID_KEY
 */

"use client";

import { getMessaging, getToken } from "firebase/messaging";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { app } from "@/lib/firebase";
import { db, auth } from "@/lib/firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

/**
 * Solicita permiso, obtiene el FCM token y lo guarda en Firestore.
 * Si el token ya está guardado y coincide, no hace nada.
 *
 * @returns El token FCM si se obtuvo, null si no.
 */
export async function registerFcmToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[FCM] El navegador no soporta Push Notifications.");
    return null;
  }
  if (!VAPID_KEY) {
    console.error("[FCM] Falta NEXT_PUBLIC_FIREBASE_VAPID_KEY en las variables de entorno.");
    return null;
  }

  // 1. Solicitar permiso
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("[FCM] Permiso denegado por el usuario.");
    return null;
  }

  try {
    // 2. Registrar el SW de Firebase Messaging (si no está ya)
    const swRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { scope: "/" }
    );

    // 3. Obtener el token FCM real
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      console.warn("[FCM] No se pudo obtener el token FCM.");
      return null;
    }

    // 4. Guardar en Firestore si es diferente al actual
    const user = auth.currentUser;
    if (!user) return null;

    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    const existingToken = userSnap.exists() ? userSnap.data().fcmToken : null;

    if (existingToken !== token) {
      await updateDoc(userRef, { fcmToken: token });
      console.info("[FCM] Token registrado en Firestore.");
    } else {
      console.info("[FCM] Token ya estaba actualizado.");
    }

    return token;
  } catch (err) {
    console.error("[FCM] Error al obtener/registrar token:", err);
    return null;
  }
}
