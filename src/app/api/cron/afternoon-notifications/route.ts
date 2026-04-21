/**
 * GET /api/cron/afternoon-notifications
 *
 * Cron job diario que envía notificaciones de tarde a todos los usuarios
 * con FCM token registrado. Ejecutado automáticamente por Vercel Cron.
 *
 * Protegido con CRON_SECRET para que solo Vercel pueda invocarlo.
 * Horario: 19:00 UTC = ~16:00 Chile (UTC-3 verano / UTC-4 invierno)
 *
 * Mensajes rotativos por día de la semana (0=Dom … 6=Sáb).
 */

import { NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

// ── Mensajes por día de la semana (tarde) ─────────────────────────────────────
const MENSAJES: Record<number, { titulo: string; cuerpo: string }> = {
  0: {
    titulo: "Último día del fin de semana 🌅",
    cuerpo: "Cierra el fin de semana de la mejor manera. Visítanos en Av. Lomas de la Luz 4650, Curauma, antes de que termine el día.",
  },
  1: {
    titulo: "¡La tarde es tuya! ☀️",
    cuerpo: "Termina el día de la mejor manera. Patio Curauma te espera con los mejores emprendedores locales. ¡Ven a sumar sellos!",
  },
  2: {
    titulo: "¿Qué planes tienes esta tarde? 🛍️",
    cuerpo: "Aprovecha el resto del día en Patio Curauma. Descubre productos únicos y acumula puntos para tus premios.",
  },
  3: {
    titulo: "Mitad de semana, doble energía ⚡",
    cuerpo: "Patio Curauma es el lugar perfecto para recargar energías. ¡Visítanos hoy y suma un sello más a tu tarjeta!",
  },
  4: {
    titulo: "El fin de semana está cerca 🎉",
    cuerpo: "Prepárate para el fin de semana visitando Patio Curauma. Tus emprendedores favoritos te esperan con novedades.",
  },
  5: {
    titulo: "¡Viernes en Patio Curauma! 🥂",
    cuerpo: "El mejor plan para este viernes: visitar nuestros emprendedores locales. Ven, compra y acumula sellos para tus premios.",
  },
  6: {
    titulo: "Tarde de sábado perfecta 🌟",
    cuerpo: "No hay mejor plan de sábado que Patio Curauma. Tráete a la familia y disfruta de todo lo que tenemos para ti.",
  },
};

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
    const adminApp  = getAdminApp();
    const adminDb   = getFirestore(adminApp);
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

    // Elegir mensaje según el día de la semana en hora Chile (UTC-3)
    const nowChile = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const diaSemana = nowChile.getUTCDay(); // 0=Dom, 1=Lun … 6=Sáb
    const msg = MENSAJES[diaSemana];

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
            icon: "/Logo3.png",
            badge: "/Logo3.png",
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

    // Guardar notificación en Firestore para cada usuario (visible en "Mensajes del Club")
    const batch = adminDb.batch();
    const now   = new Date().toISOString();
    userIds.forEach((uid) => {
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

    console.log(`[cron/afternoon] Día: ${diaSemana} | Enviadas: ${totalSuccess} | Fallidas: ${totalFailed} | Tokens limpios: ${invalidTokens.length}`);

    return NextResponse.json({
      success: true,
      sent: totalSuccess,
      failed: totalFailed,
      cleaned: invalidTokens.length,
      diaSemana,
      message: msg.titulo,
    });
  } catch (error: any) {
    console.error("[cron/afternoon] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
