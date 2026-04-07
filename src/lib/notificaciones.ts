
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
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      // Intentamos usar el Service Worker para mayor compatibilidad en PWA (iOS 16.4+)
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration && 'showNotification' in registration) {
        registration.showNotification(titulo, {
          body: mensaje,
          icon: "/Logo.png",
          badge: "/Logo.png",
        });
      } else {
        new Notification(titulo, { body: mensaje });
      }
    } catch (e) {
      console.warn("Fallo al disparar notificación nativa, usando fallback.");
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
    // Usamos una consulta simple para evitar requerir índices compuestos complejos
    const q = query(notifRef, orderBy("fecha", "desc"), limit(1));
    const querySnapshot = await getDocs(q);

    let debieraGenerar = true;
    if (!querySnapshot.empty) {
      const lastNotif = querySnapshot.docs[0].data();
      const lastDate = new Date(lastNotif.fecha);
      const now = new Date();
      const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
      
      // Solo generamos un mensaje de IA cada 24 horas para no saturar
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
 * Optimizado para evitar errores de índice en Firestore.
 */
export async function procesarProximidadGeofence(userId: string, userName: string, stamps: number, isNear: boolean) {
  if (!isNear) return;

  try {
    const notifRef = collection(db, "usuarios", userId, "notificaciones");
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    
    // Consulta optimizada: solo filtramos por fecha (índice automático)
    // El filtrado por 'tipo' lo hacemos en memoria para evitar requerir índices compuestos
    const q = query(
      notifRef, 
      where("fecha", ">=", startOfDay.toISOString()),
      limit(20) // Traemos las últimas notificaciones del día
    );
    
    const snapshot = await getDocs(q);
    const yaRecibioHoy = snapshot.docs.some(doc => doc.data().tipo === "geofence");
    
    if (yaRecibioHoy) return;

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
