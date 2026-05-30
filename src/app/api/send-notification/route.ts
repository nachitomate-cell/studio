/**
 * POST /api/send-notification
 *
 * Envía una notificación push real a través de Firebase Admin SDK.
 * Requiere variables de entorno FIREBASE_ADMIN_* (nunca hardcodeadas).
 *
 * Body: { token: string, title: string, body: string, url?: string }
 */

import { NextResponse } from "next/server";
import { adminMessaging } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  // Solo llamadas internas del servidor (crons, route handlers) pueden usar este endpoint.
  // Nunca debe ser llamado directamente desde el browser.
  const secret = process.env.CRON_SECRET;
  const callerSecret = request.headers.get("x-internal-secret");
  if (!secret || callerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token, title, body, url } = await request.json();

    if (!token || !title || !body) {
      return NextResponse.json(
        { success: false, error: "Faltan campos: token, title, body" },
        { status: 400 }
      );
    }

    await adminMessaging.send({
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
