
import { db } from "./firebase";
import { collection, addDoc, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";

/**
 * Dispara una notificación nativa del sistema (Push) si el permiso está concedido.
 * En iOS PWA, requiere que el Service Worker esté activo.
 *
 * ✅ BROWSER-SAFE — no importa Genkit ni módulos de Node.js
 */
export async function dispararAlertaSistema(titulo: string, mensaje: string) {
  if (typeof window === "undefined") return;

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(titulo, {
          body: mensaje,
          icon: "/Logo2.png",
          badge: "/Logo2.png",
          tag: 'club-patio-notification',
          renotify: true,
        } as NotificationOptions & { vibrate?: number[] });
      } else {
        new Notification(titulo, { body: mensaje });
      }
    } catch (e) {
      console.warn("No se pudo disparar notificación de sistema:", e);
    }
  }
}

/**
 * Registra una notificación en la subcolección del usuario en Firestore.
 *
 * ✅ BROWSER-SAFE — solo usa Firebase Client SDK
 */
export async function enviarNotificacionLocal(userId: string, titulo: string, mensaje: string, metadata: any = {}) {
  if (!userId) return;

  try {
    // 1. Guardar en Firestore (comportamiento existente)
    const notifRef = collection(db, "usuarios", userId, "notificaciones");
    await addDoc(notifRef, {
      titulo,
      mensaje,
      leida: false,
      fecha: new Date().toISOString(),
      ...metadata
    });

    // 2. Enviar push real si el usuario tiene FCM token registrado
    try {
      const userSnap = await getDoc(doc(db, "usuarios", userId));
      const fcmToken = userSnap.exists() ? userSnap.data().fcmToken : null;

      if (fcmToken) {
        const baseUrl = typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_BASE_URL || "https://club-patio-curauma.vercel.app";

        await fetch(`${baseUrl}/api/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: fcmToken, title: titulo, body: mensaje }),
        });
      }
    } catch (pushError) {
      // El push es best-effort: si falla no interrumpe el flujo principal
      console.warn("[Push] No se pudo enviar notificación push:", pushError);
    }
  } catch (error) {
    console.error("Error al registrar notificación en Firestore:", error);
  }
}



/**
 * Simula el motor de Geofencing enviando una alerta si el usuario está cerca del Patio.
 */
export async function procesarProximidadGeofence(userId: string, userName: string, stamps: number, isNear: boolean, force = false) {
  if (!isNear || !userId) return;

  try {
    const notifRef = collection(db, "usuarios", userId, "notificaciones");
    
    if (!force) {
      const startOfDay = new Date();
      startOfDay.setHours(0,0,0,0);
      
      const q = query(
        notifRef, 
        where("fecha", ">=", startOfDay.toISOString()),
        limit(20)
      );
      
      const snapshot = await getDocs(q);
      const yaRecibioHoy = snapshot.docs.some(doc => doc.data().tipo === "geofence");
      if (yaRecibioHoy) return;
    }

    const titulo  = `¡Estás cerca de un Sello! 📍`;
    const mensaje = `Hola ${userName}, detectamos que estás cerca de Patio Curauma. ¡Entra y suma tu sello de hoy!`;

    // Notificación de sistema — visible en pantalla de bloqueo
    await dispararAlertaSistema(titulo, mensaje);

    // Guardar en Firestore + enviar FCM push
    await enviarNotificacionLocal(userId, titulo, mensaje, {
      cta: "Ver Mapa",
      tipo: "geofence",
      isAI: true
    });

  } catch (error) {
    console.error("Error en Geofencing:", error);
  }
}
