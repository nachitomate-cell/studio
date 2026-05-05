'use server';
/**
 * ai-actions.ts
 *
 * Server Actions — requieren 'use server' porque importan Genkit que usa
 * async_hooks (Node.js built-in, no disponible en el browser).
 * Los writes a Firestore usan el Admin SDK para evitar depender de auth
 * context del cliente en el servidor.
 */

import { adminDb } from "./firebaseAdmin";
import { generatePromoMessage } from "@/ai/flows/generate-promo-message-flow";

// ── Helper interno ────────────────────────────────────────────────────────────

async function _guardarNotificacionIA(
  userId: string,
  titulo: string,
  mensaje: string,
  extra: Record<string, unknown> = {}
) {
  await adminDb
    .collection("usuarios").doc(userId)
    .collection("notificaciones").add({
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
    if (!force) {
      const snap = await adminDb
        .collection("usuarios").doc(userId)
        .collection("notificaciones")
        .orderBy("fecha", "desc")
        .limit(1)
        .get();

      if (!snap.empty) {
        const diffHours =
          (Date.now() - new Date(snap.docs[0].data().fecha).getTime()) / (1000 * 60 * 60);
        if (diffHours < 24) return false;
      }
    }

    const aiResponse = await generatePromoMessage({
      userName: userName || "Miembro del Club",
      stampsCount: stamps,
    });

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
    if (!force) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const snap = await adminDb
        .collection("usuarios").doc(userId)
        .collection("notificaciones")
        .orderBy("fecha", "desc")
        .limit(20)
        .get();

      const yaRecibioHoy = snap.docs.some(
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
