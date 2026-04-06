
/**
 * @fileOverview Librería de notificaciones para el Club Patio.
 * Maneja tanto notificaciones internas (Firestore) como del sistema (Browser/iOS).
 */

import { db } from "./firebase";
import { collection, addDoc, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { generatePromoMessage } from "@/ai/flows/generate-promo-message-flow";

/**
 * Dispara una notificación física en el sistema operativo (iOS/Android/Web).
 */
export async function dispararAlertaSistema(titulo: string, mensaje: string) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    // Intentamos usar el Service Worker para mayor compatibilidad en PWA
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      registration.showNotification(titulo, {
        body: mensaje,
        icon: "/Logo.png", // Asegúrate de que el logo exista en public
        badge: "/Logo.png",
      });
    } else {
      new Notification(titulo, { body: mensaje });
    }
  }
}

export async function enviarNotificacionLocal(userId: string, titulo: string, mensaje: string, metadata: any = {}) {
  try {
    const notifRef = collection(db, "usuarios", userId, "notificaciones");
    await addDoc(notifRef, {
      titulo,
      mensaje,
      leida: false,
      fecha: new Date().toISOString(),
      ...metadata
    });

    // Disparar alerta real en el celular si hay permisos
    dispararAlertaSistema(titulo, mensaje);
  } catch (error) {
    console.error("Error al registrar notificación:", error);
  }
}

/**
 * Genera un recordatorio automatizado usando IA si ha pasado tiempo desde el último.
 */
export async function verificarYGenerarRecordatorioIA(userId: string, userName: string, stamps: number) {
  try {
    const notifRef = collection(db, "usuarios", userId, "notificaciones");
    const q = query(notifRef, orderBy("fecha", "desc"), limit(1));
    const querySnapshot = await getDocs(q);

    let debieraGenerar = true;
    if (!querySnapshot.empty) {
      const lastNotif = querySnapshot.docs[0].data();
      const lastDate = new Date(lastNotif.fecha);
      const now = new Date();
      const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
      
      if (diffHours < 24) debieraGenerar = false;
    }

    if (debieraGenerar) {
      const aiResponse = await generatePromoMessage({
        userName: userName || "Miembro del Club",
        stampsCount: stamps
      });

      const titulo = aiResponse.title;
      const mensaje = aiResponse.message;

      await addDoc(notifRef, {
        titulo,
        mensaje,
        cta: aiResponse.callToAction,
        isAI: true,
        leida: false,
        fecha: new Date().toISOString()
      });

      dispararAlertaSistema(titulo, mensaje);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error en motor de IA de notificaciones:", error);
    return false;
  }
}

/**
 * Procesa la lógica de cercanía geográfica (Geofencing) para disparar invitaciones.
 */
export async function procesarProximidadGeofence(userId: string, userName: string, stamps: number, isNear: boolean) {
  if (!isNear) return;

  try {
    const notifRef = collection(db, "usuarios", userId, "notificaciones");
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    
    const q = query(
      notifRef, 
      where("tipo", "==", "geofence"),
      where("fecha", ">=", startOfDay.toISOString()),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return;

    const titulo = `¡Estás cerca de un Sello! 📍`;
    const mensaje = `Hola ${userName}, detectamos que estás cerca de Patio Curauma. ¡Entra y suma tu sello de hoy!`;

    await addDoc(notifRef, {
      titulo,
      mensaje,
      cta: "Ver Mapa",
      tipo: "geofence",
      isAI: true,
      leida: false,
      fecha: new Date().toISOString()
    });

    dispararAlertaSistema(titulo, mensaje);

  } catch (error) {
    console.error("Error en Geofencing:", error);
  }
}
