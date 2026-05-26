/**
 * GET /api/cron/daily-notifications
 *
 * Cron job diario que envía notificaciones push segmentadas según el estado
 * de sellos de cada usuario.
 *
 * Segmentos:
 *   REGALO  — 7+ sellos acumulados → dirigir a Tienda Patio Curauma
 *   CAFÉ    — 5 a 6 sellos          → dirigir al bazar a canjear café gratis
 *   GENERAL — menos de 5 sellos     → incentivar visita / beneficio Fronza
 *
 * Protegido con CRON_SECRET para que solo Vercel pueda invocarlo.
 * Horario: 13:00 UTC = ~10:00 Chile (UTC-3 verano / UTC-4 invierno)
 */

import { NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging, MulticastMessage } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

// ── Catálogos de mensajes por segmento ────────────────────────────────────────

const MENSAJES_REGALO = [
  {
    titulo: "🎁 ¡Ya desbloqueaste tu regalo Club Patio!",
    cuerpo: "Acércate a Tienda Patio Curauma y canjea tu regalo exclusivo por tus sellos 💛 ¡Te esperamos en el bazar Outlet!",
  },
  {
    titulo: "✨ Tu regalo exclusivo está esperándote",
    cuerpo: "Gracias por preferir Patio Curauma y apoyar a nuestros emprendedores locales 💛 Pasa por Tienda Patio Curauma a canjearlo.",
  },
];

const MENSAJES_CAFE = [
  {
    titulo: "☕✨ ¡Ya tienes tu recompensa en Club Patio!",
    cuerpo: "Acumulaste los sellos para canjear un café GRATIS en el bazar Patio Curauma 🙌 ¡Ven a disfrutar una pausa rica con nuestros emprendedores!",
  },
  {
    titulo: "🎉 ¡Felicitaciones! Tu café gratis te espera",
    cuerpo: "Tu fidelidad tiene premio 💛 Pasa por el bazar Patio Curauma Outlet, disfruta tu café gratis y sigue sumando sellos.",
  },
];

const MENSAJES_GENERAL = [
  {
    titulo: "✨ Más compras, más beneficios en Patio Curauma",
    cuerpo: "Sigue acumulando sellos y accede a cafés gratis, regalos exclusivos y beneficios especiales junto a nuestro auspiciador Fronza 💛",
  },
  {
    titulo: "🔥 Beneficio exclusivo Club Patio + Fronza",
    cuerpo: "Tus compras en Patio Curauma desbloquean promociones especiales junto a Fronza. ¡Compra local, acumula beneficios y vive la experiencia Club Patio!",
  },
  {
    titulo: "✨ Esta semana es perfecta para visitar el Patio",
    cuerpo: "Recorre el bazar, conoce nuevos emprendimientos y acumula sellos. Moda, cafetería, accesorios, decoración y más te esperan 💛",
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildMulticast(
  tokens: string[],
  titulo: string,
  cuerpo: string,
  link: string
): MulticastMessage {
  return {
    tokens,
    notification: { title: titulo, body: cuerpo },
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
          alert: { title: titulo, body: cuerpo },
          sound: "default",
          badge: 1,
          "content-available": 1,
        },
      },
    },
    webpush: {
      headers: { Urgency: "high", TTL: "86400" },
      notification: {
        title: titulo,
        body: cuerpo,
        icon: "/Logo2.png",
        badge: "/Logo2.png",
      },
      fcmOptions: { link },
    },
  };
}

type Stats = { success: number; failed: number; invalidTokens: string[] };

async function enviarSegmento(
  messaging: ReturnType<typeof getMessaging>,
  tokens: string[],
  titulo: string,
  cuerpo: string,
  link: string
): Promise<Stats> {
  const BATCH_SIZE = 500;
  const stats: Stats = { success: 0, failed: 0, invalidTokens: [] };

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const result = await messaging.sendEachForMulticast(buildMulticast(batch, titulo, cuerpo, link));
    stats.success += result.successCount;
    stats.failed  += result.failureCount;
    result.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
        stats.invalidTokens.push(batch[idx]);
      }
    });
  }
  return stats;
}

// ── Handler ────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminApp  = getAdminApp();
    const adminDb   = getFirestore(adminApp);
    const messaging = getMessaging(adminApp);

    const usersSnap = await adminDb
      .collection("usuarios")
      .where("fcmToken", "!=", null)
      .get();

    // Índice día del año — cada segmento usa un offset distinto para variar mensajes independientemente
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );

    type UserEntry = { uid: string; token: string };
    const segmentoRegalo:  UserEntry[] = [];
    const segmentoCafe:    UserEntry[] = [];
    const segmentoGeneral: UserEntry[] = [];

    usersSnap.docs.forEach((docSnap) => {
      const data  = docSnap.data();
      const token = data.fcmToken;
      if (!token || typeof token !== "string" || token.length <= 10) return;
      if (data.baneado) return;

      const sellos = data.comprasRealizadas ?? 0;
      const entry: UserEntry = { uid: docSnap.id, token };

      if (sellos >= 7) {
        segmentoRegalo.push(entry);
      } else if (sellos >= 5) {
        segmentoCafe.push(entry);
      } else {
        segmentoGeneral.push(entry);
      }
    });

    // Mensajes del día para cada segmento (rotación independiente)
    const msgRegalo  = MENSAJES_REGALO [dayOfYear % MENSAJES_REGALO.length];
    const msgCafe    = MENSAJES_CAFE   [dayOfYear % MENSAJES_CAFE.length];
    const msgGeneral = MENSAJES_GENERAL[(dayOfYear + 1) % MENSAJES_GENERAL.length];

    const allInvalidTokens: string[] = [];
    let totalSuccess = 0;
    let totalFailed  = 0;

    if (segmentoRegalo.length > 0) {
      const s = await enviarSegmento(
        messaging,
        segmentoRegalo.map((u) => u.token),
        msgRegalo.titulo,
        msgRegalo.cuerpo,
        "/"
      );
      totalSuccess += s.success;
      totalFailed  += s.failed;
      allInvalidTokens.push(...s.invalidTokens);
    }

    if (segmentoCafe.length > 0) {
      const s = await enviarSegmento(
        messaging,
        segmentoCafe.map((u) => u.token),
        msgCafe.titulo,
        msgCafe.cuerpo,
        "/"
      );
      totalSuccess += s.success;
      totalFailed  += s.failed;
      allInvalidTokens.push(...s.invalidTokens);
    }

    if (segmentoGeneral.length > 0) {
      const s = await enviarSegmento(
        messaging,
        segmentoGeneral.map((u) => u.token),
        msgGeneral.titulo,
        msgGeneral.cuerpo,
        "/"
      );
      totalSuccess += s.success;
      totalFailed  += s.failed;
      allInvalidTokens.push(...s.invalidTokens);
    }

    // Guardar notificación individual en Firestore (500 por batch)
    const now = new Date().toISOString();
    const FIRESTORE_CHUNK = 500;

    const todosLosUsuarios: { uid: string; msg: { titulo: string; cuerpo: string }; tipo: string }[] = [
      ...segmentoRegalo.map((u)  => ({ uid: u.uid, msg: msgRegalo,  tipo: "diaria_regalo"  })),
      ...segmentoCafe.map((u)    => ({ uid: u.uid, msg: msgCafe,    tipo: "diaria_cafe"    })),
      ...segmentoGeneral.map((u) => ({ uid: u.uid, msg: msgGeneral, tipo: "diaria_general" })),
    ];

    for (let i = 0; i < todosLosUsuarios.length; i += FIRESTORE_CHUNK) {
      const chunk = todosLosUsuarios.slice(i, i + FIRESTORE_CHUNK);
      const batch = adminDb.batch();
      chunk.forEach(({ uid, msg, tipo }) => {
        const ref = adminDb.collection("usuarios").doc(uid).collection("notificaciones").doc();
        batch.set(ref, {
          titulo:  msg.titulo,
          mensaje: msg.cuerpo,
          leida:   false,
          fecha:   now,
          tipo,
          isAI:    false,
          cta:     tipo === "diaria_general" ? "Ver App" : "Canjear",
        });
      });
      await batch.commit();
    }

    // Limpiar tokens inválidos de Firestore
    if (allInvalidTokens.length > 0) {
      const cleanupBatch = adminDb.batch();
      usersSnap.docs.forEach((docSnap) => {
        if (allInvalidTokens.includes(docSnap.data().fcmToken)) {
          cleanupBatch.update(docSnap.ref, { fcmToken: null });
        }
      });
      await cleanupBatch.commit();
    }

    console.log(
      `[cron/daily] Regalo: ${segmentoRegalo.length} | Café: ${segmentoCafe.length} | General: ${segmentoGeneral.length}` +
      ` | OK: ${totalSuccess} | Fail: ${totalFailed} | Tokens limpios: ${allInvalidTokens.length}`
    );

    return NextResponse.json({
      success: true,
      sent:    totalSuccess,
      failed:  totalFailed,
      cleaned: allInvalidTokens.length,
      segmentos: {
        regalo:  { usuarios: segmentoRegalo.length,  mensaje: msgRegalo.titulo  },
        cafe:    { usuarios: segmentoCafe.length,    mensaje: msgCafe.titulo    },
        general: { usuarios: segmentoGeneral.length, mensaje: msgGeneral.titulo },
      },
    });
  } catch (error: any) {
    console.error("[cron/daily] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
