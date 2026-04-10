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
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

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
      notification: { title, body },
      webpush: {
        notification: {
          title,
          body,
          icon: "/Logo.png",
          badge: "/Logo.png",
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
