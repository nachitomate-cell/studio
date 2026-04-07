import { db } from "./firebase";
import { collection, addDoc, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { generatePromoMessage } from "@/ai/flows/generate-promo-message-flow";

/**
 * Dispara una notificación nativa del sistema (Push) si el permiso está concedido.
 */
export async function dispararAlertaSistema(titulo: string, mensaje: string) {
  if (typeof window === "undefined") return;

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration && 'showNotification' in registration) {
        registration.showNotification(titulo, {
          body: mensaje,
          icon: "/Logo.png",
          badge: "/Logo.png",
          vibrate: [200, 100, 200],
        });
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
 */
export async function enviarNotificacionLocal(userId: string, titulo: string, mensaje: string, metadata: any = {}) {
  if (!userId) return;
  
  try {
    const notifRef = collection(db, "usuarios", userId, "notificaciones");
    await addDoc(notifRef, {
      titulo,
      mensaje,
      leida: false,
      fecha: new Date().toISOString(),
      ...metadata
    });
  } catch (error) {
    console.error("Error al registrar notificación en Firestore:", error);
  }
}

/**
 * Genera un mensaje persuasivo usando IA (Genkit) y lo envía al usuario.
 */
export async function verificarYGenerarRecordatorioIA(userId: string, userName: string, stamps: number, force = false) {
  try {
    const notifRef = collection(db, "usuarios", userId, "notificaciones");
    
    if (!force) {
      const q = query(notifRef, orderBy("fecha", "desc"), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const lastNotif = querySnapshot.docs[0].data();
        const lastDate = new Date(lastNotif.fecha);
        const now = new Date();
        const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
        if (diffHours < 24) return false; // Evitar spam si no es forzado
      }
    }

    const aiResponse = await generatePromoMessage({
      userName: userName || "Miembro del Club",
      stampsCount: stamps
    });

    await enviarNotificacionLocal(userId, aiResponse.title, aiResponse.message, {
      cta: aiResponse.callToAction,
      isAI: true,
      tipo: "IA_REMINDER"
    });
    return true;
  } catch (error) {
    console.error("Error en motor de IA de notificaciones:", error);
    return false;
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

    await enviarNotificacionLocal(userId, `¡Estás cerca de un Sello! 📍`, `Hola ${userName}, detectamos que estás cerca de Patio Curauma. ¡Entra y suma tu sello de hoy!`, {
      cta: "Ver Mapa",
      tipo: "geofence",
      isAI: true
    });

  } catch (error) {
    console.error("Error en Geofencing:", error);
  }
}