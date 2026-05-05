/**
 * POST /api/send-notification
 *
 * Envía una notificación push real a través de Firebase Admin SDK.
 * Requiere variables de entorno FIREBASE_ADMIN_* (nunca hardcodeadas).
 *
 * Body: { token: string, title: string, body: string, url?: string }
 */

import { NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";
  // Soporta dos formatos:
  // 1) Base64 (recomendado en Vercel): la variable empieza por "LS0t" (base64 de "---")
  // 2) PEM directo con \\n literales (formato legacy)
  const privateKey = rawKey.startsWith("LS0t")
    ? Buffer.from(rawKey, "base64").toString("utf8")
    : rawKey.replace(/\\n/g, "\n").replace(/^["']|["']$/g, "").trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan variables de entorno Firebase Admin: " +
      "FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY"
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export async function POST(request: Request) {
  try {
    const { token, title, body, url } = await request.json();

    if (!token || !title || !body) {
      return NextResponse.json(
        { success: false, error: "Faltan campos: token, title, body" },
        { status: 400 }
      );
    }

    const adminApp = getAdminApp();
    const messaging = getMessaging(adminApp);

    await messaging.send({
      token,
      // Notificación genérica (fallback para plataformas sin config específica)
      notification: { title, body },

      // ── Android (PWA en Chrome + Capacitor nativo) ──────────────────────────
      // priority: 'high' garantiza que el mensaje despierte el dispositivo
      // aunque esté en Doze Mode o con la pantalla bloqueada.
      android: {
        priority: "high",
        notification: {
          title,
          body,
          icon: "ic_notification", // drawable en Android nativo (Capacitor)
          sound: "default",
          channelId: "club_patio_default",
          visibility: "public", // Visible en pantalla de bloqueo
        },
      },

      // ── iOS / iPadOS (PWA instalada en pantalla de inicio, iOS 16.4+) ──────
      // apns-priority: 10 = entrega inmediata (vs. 5 = entrega que puede diferirse)
      // content-available: 1 = despierta el SW en background para procesarla
      apns: {
        headers: {
          "apns-priority": "10",
          "apns-push-type": "alert",
        },
        payload: {
          aps: {
            alert: { title, body },
            sound: "default",
            badge: 1,
            "content-available": 1,
            "mutable-content": 1,
          },
        },
      },

      // ── Web / PWA en navegador (Chrome, Edge, Firefox, Safari 16.4+) ────────
      // Urgency: high → el navegador entrega la notificación de inmediato
      // aunque la pestaña esté cerrada o el dispositivo bloqueado.
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "86400", // Tiempo de vida: 24 horas (en segundos)
        },
        notification: {
          title,
          body,
          icon: "/Logo2.png",
          badge: "/Logo2.png",
          requireInteraction: false,
          silent: false,
        },
        fcmOptions: {
          link: url || "/",
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[send-notification] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
