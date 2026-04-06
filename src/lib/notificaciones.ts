
/**
 * @fileOverview Librería de notificaciones para el Club Patio.
 */

import { db } from "./firebase";
import { collection, addDoc, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { generatePromoMessage } from "@/ai/flows/generate-promo-message-flow";

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
      
      // Solo generamos un mensaje nuevo cada 24 horas para no saturar
      if (diffHours < 24) debieraGenerar = false;
    }

    if (debieraGenerar) {
      const aiResponse = await generatePromoMessage({
        userName: userName || "Miembro del Club",
        stampsCount: stamps
      });

      await addDoc(notifRef, {
        titulo: aiResponse.title,
        mensaje: aiResponse.message,
        cta: aiResponse.callToAction,
        isAI: true,
        leida: false,
        fecha: new Date().toISOString()
      });
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
    // Buscamos si ya se envió una notificación de proximidad hoy
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    
    const q = query(
      notifRef, 
      where("tipo", "==", "geofence"),
      where("fecha", ">=", startOfDay.toISOString()),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    
    // Si ya le avisamos hoy que está cerca, no molestamos más
    if (!snapshot.empty) return;

    // Generamos un mensaje especial de IA para proximidad
    const aiResponse = await generatePromoMessage({
      userName: userName || "Miembro",
      stampsCount: stamps
    });

    await addDoc(notifRef, {
      titulo: `¡Estás cerca de un Sello! 📍`,
      mensaje: `Hola ${userName}, detectamos que estás cerca de Patio Curauma. ¡Entra y pide tu sello de hoy para estar más cerca del sorteo!`,
      cta: "Ver Mapa",
      tipo: "geofence",
      isAI: true,
      leida: false,
      fecha: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error en Geofencing:", error);
  }
}
