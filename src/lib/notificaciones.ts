/**
 * @fileOverview Librería de notificaciones para el Club Patio.
 */

import { db } from "./firebase";
import { collection, addDoc, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { generatePromoMessage } from "@/ai/flows/generate-promo-message-flow";

export async function enviarNotificacionLocal(userId: string, titulo: string, mensaje: string) {
  try {
    const notifRef = collection(db, "usuarios", userId, "notificaciones");
    await addDoc(notifRef, {
      titulo,
      mensaje,
      leida: false,
      fecha: new Date().toISOString()
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
