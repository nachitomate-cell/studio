/**
 * GET /api/cron/daily-notifications
 *
 * Cron job diario que envía una notificación push a todos los usuarios
 * con FCM token registrado. Ejecutado automáticamente por Vercel Cron.
 *
 * Protegido con CRON_SECRET para que solo Vercel pueda invocarlo.
 * Horario: 13:00 UTC = ~10:00 Chile (UTC-3 verano / UTC-4 invierno)
 */

import { NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

// ── Mensajes rotativos diarios ─────────────────────────────────────────────────
const MENSAJES = [
  {
    titulo: "¡Hoy es un buen día para sumar sellos! 🏪",
    cuerpo: "Visita Patio Curauma y sigue acumulando puntos en tus locales favoritos.",
  },
  {
    titulo: "¿Ya tienes tus sellos del día? ⭐",
    cuerpo: "Pasa por Patio Curauma y acércate a tu próximo premio.",
  },
  {
    titulo: "Tus premios te están esperando 🎁",
    cuerpo: "Revisa cuántos sellos te faltan para canjear tu recompensa.",
  },
  {
    titulo: "¡El Patio te espera hoy! 🛍️",
    cuerpo: "Nuevos locales, nuevos sellos. Ven a descubrir Patio Curauma.",
  },
  {
    titulo: "Club Patio Curauma 🌟",
    cuerpo: "No olvides pasar hoy y sumar tu sello diario.",
  },
  {
    titulo: "¡Sigue acumulando! 🏆",
    cuerpo: "Cada visita a Patio Curauma te acerca más a tus premios.",
  },
  {
    titulo: "¿Sabías que tienes premios disponibles? 🎉",
    cuerpo: "Abre la app y revisa tus sellos acumulados en el Club Patio.",
  },
];

// ── Firebase Admin ─────────────────────────────────────────────────────────────
function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";
  const privateKey = rawKey.startsWith("LS0t")
    ? Buffer.from(rawKey, "base64").toString("utf8")
    : rawKey.replace(/\\n/g, "\n").replace(/^["']|["']$/g, "").trim();
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey,
    }),
  });
}

// ── Handler ────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  // Verificar secret de Vercel Cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminApp = getAdminApp();
    const adminDb  = getFirestore(adminApp);
    const messaging = getMessaging(adminApp);

    // Obtener todos los usuarios con FCM token
    const usersSnap = await adminDb
      .collection("usuarios")
      .where("fcmToken", "!=", null)
      .get();

    const tokens: string[] = [];
    const userIds: string[] = [];

    usersSnap.docs.forEach((doc) => {
      const token = doc.data().fcmToken;
      if (token && typeof token === "string" && token.length > 10) {
        tokens.push(token);
        userIds.push(doc.id);
      }
    });

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "Sin usuarios con token FCM" });
    }

    // Elegir mensaje del día (rotativo por día del año)
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    const msg = MENSAJES[dayOfYear % MENSAJES.length];

    // FCM permite máximo 500 tokens por llamada — enviar en lotes
    const BATCH_SIZE = 500;
    let totalSuccess = 0;
    let totalFailed  = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batchTokens = tokens.slice(i, i + BATCH_SIZE);

      const message: MulticastMessage = {
        tokens: batchTokens,
        notification: { title: msg.titulo, body: msg.cuerpo },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "club_patio_default",
            visibility: "public",
          },
        },
        apns: {
          headers: { "apns-priority": "10", "apns-push-type": "alert" },
          payload: {
            aps: {
              alert: { title: msg.titulo, body: msg.cuerpo },
              sound: "default",
              badge: 1,
              "content-available": 1,
            },
          },
        },
        webpush: {
          headers: { Urgency: "high", TTL: "86400" },
          notification: {
            title: msg.titulo,
            body: msg.cuerpo,
            icon: "/Logo2.png",
            badge: "/Logo2.png",
          },
          fcmOptions: { link: "/" },
        },
      };

      const result = await messaging.sendEachForMulticast(message);
      totalSuccess += result.successCount;
      totalFailed  += result.failureCount;

      // Recopilar tokens inválidos para limpiar Firestore
      result.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
          invalidTokens.push(batchTokens[idx]);
        }
      });
    }

    // Guardar notificación en Firestore — en lotes de 500 (límite de Firestore batch)
    const now = new Date().toISOString();
    const FIRESTORE_CHUNK = 500;
    for (let i = 0; i < userIds.length; i += FIRESTORE_CHUNK) {
      const chunk = userIds.slice(i, i + FIRESTORE_CHUNK);
      const batch = adminDb.batch();
      chunk.forEach((uid) => {
        const ref = adminDb.collection("usuarios").doc(uid).collection("notificaciones").doc();
        batch.set(ref, {
          titulo: msg.titulo,
          mensaje: msg.cuerpo,
          leida: false,
          fecha: now,
          tipo: "diaria",
          isAI: false,
          cta: "Ver App",
        });
      });
      await batch.commit();
    }

    // Limpiar tokens inválidos de Firestore
    if (invalidTokens.length > 0) {
      const cleanupBatch = adminDb.batch();
      usersSnap.docs.forEach((doc) => {
        if (invalidTokens.includes(doc.data().fcmToken)) {
          cleanupBatch.update(doc.ref, { fcmToken: null });
        }
      });
      await cleanupBatch.commit();
    }

    console.log(`[cron/daily] Enviadas: ${totalSuccess} | Fallidas: ${totalFailed} | Tokens limpios: ${invalidTokens.length}`);

    return NextResponse.json({
      success: true,
      sent: totalSuccess,
      failed: totalFailed,
      cleaned: invalidTokens.length,
      message: msg.titulo,
    });
  } catch (error: any) {
    console.error("[cron/daily] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
