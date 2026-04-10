'use server';
/**
 * ai-actions.ts
 *
 * Server Actions que usan Genkit/IA — marcados con 'use server' para que
 * Next.js 15 los ejecute ÚNICAMENTE en el servidor y nunca envíe Genkit
 * (ni async_hooks) al bundle del cliente.
 *
 * Importados desde componentes cliente con llamadas directas (RPC automático de Next.js).
 */

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { generatePromoMessage } from "@/ai/flows/generate-promo-message-flow";

// ── Helpers internos (server-only) ────────────────────────────────────────────

async function _guardarNotificacionIA(
  userId: string,
  titulo: string,
  mensaje: string,
  extra: Record<string, unknown> = {}
) {
  const notifRef = collection(db, "usuarios", userId, "notificaciones");
  await addDoc(notifRef, {
    titulo,
    mensaje,
    leida: false,
    fecha: new Date().toISOString(),
    isAI: true,
    ...extra,
  });
}

// ── Server Actions exportadas ─────────────────────────────────────────────────

/**
 * Genera y guarda un recordatorio IA para el usuario.
 * Se llama desde UserProfile.tsx después del onSnapshot del documento.
 * Respeta cooldown de 24h para no spamear.
 */
export async function verificarYGenerarRecordatorioIA(
  userId: string,
  userName: string,
  stamps: number,
  force = false
): Promise<boolean> {
  if (!userId) return false;

  try {
    const notifRef = collection(db, "usuarios", userId, "notificaciones");

    // Cooldown: no enviar si hubo una notificación en las últimas 24h
    if (!force) {
      const q = query(notifRef, orderBy("fecha", "desc"), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const lastNotif = snapshot.docs[0].data();
        const diffHours =
          (Date.now() - new Date(lastNotif.fecha).getTime()) / (1000 * 60 * 60);
        if (diffHours < 24) return false;
      }
    }

    // Generar mensaje con IA
    const aiResponse = await generatePromoMessage({
      userName: userName || "Miembro del Club",
      stampsCount: stamps,
    });

    // Guardar en Firestore
    await _guardarNotificacionIA(userId, aiResponse.title, aiResponse.message, {
      cta: aiResponse.callToAction,
      tipo: "IA_REMINDER",
      context: aiResponse.context,
    });

    return true;
  } catch (error) {
    console.error("[AI Action] Error en recordatorio IA:", error);
    return false;
  }
}

/**
 * Procesa una alerta de proximidad geofence para el usuario.
 * Solo envía UNA vez por día.
 */
export async function procesarProximidadGeofence(
  userId: string,
  userName: string,
  stamps: number,
  isNear: boolean,
  force = false
): Promise<void> {
  if (!isNear || !userId) return;

  try {
    const notifRef = collection(db, "usuarios", userId, "notificaciones");

    if (!force) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const q = query(
        notifRef,
        orderBy("fecha", "desc"),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const yaRecibioHoy = snapshot.docs.some(
        (d) =>
          d.data().tipo === "geofence" &&
          new Date(d.data().fecha) >= startOfDay
      );
      if (yaRecibioHoy) return;
    }

    await _guardarNotificacionIA(
      userId,
      "¡Estás cerca de Patio Curauma! 🛍️",
      "Visítanos hoy y suma sellos en tus tiendas favoritas",
      { cta: "Ver Mapa", tipo: "geofence" }
    );
  } catch (error) {
    console.error("[AI Action] Error en geofencing:", error);
  }
}
