/**
 * POST /api/handshake/notify-vendor
 *
 * Cuando un cliente escanea el QR de un local, notifica al vendedor:
 *   1. Push notification (FCM) con link directo a /vendedor
 *   2. Notificación Firestore en usuarios/{vendorId}/notificaciones
 *      con actionUrl para que al tocarla en "Mensajes del Club" navegue a /vendedor
 *
 * Body: { vendorId: string, clientName: string }
 * No requiere autenticación — el cliente puede estar recién llegando.
 */

import { NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawKey      = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";
  const privateKey  = rawKey.startsWith("LS0t")
    ? Buffer.from(rawKey, "base64").toString("utf8")
    : rawKey.replace(/\\n/g, "\n").replace(/^[\"']|[\"']$/g, "").trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan variables de entorno Firebase Admin.");
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

export async function POST(request: Request) {
  try {
    const { pendingId, clientName } = await request.json();

    if (!pendingId) {
      return NextResponse.json({ error: "pendingId requerido" }, { status: 400 });
    }

    const app = getAdminApp();
    const db  = getFirestore(app);
    const messaging = getMessaging(app);

    // Leer el vendorId desde Firestore — nunca confiar en el body del cliente.
    // Esto garantiza que la notificación siempre llega al emprendedor correcto.
    const pendingSnap = await db.collection("pending_stamps").doc(pendingId).get();
    if (!pendingSnap.exists) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }
    const pendingData = pendingSnap.data()!;
    const vendorId: string = pendingData.vendorId;
    if (!vendorId) {
      return NextResponse.json({ error: "vendorId inválido en la solicitud" }, { status: 400 });
    }

    // 1. Leer el fcmToken del vendedor
    const vendorSnap = await db.collection("usuarios").doc(vendorId).get();
    const fcmToken   = vendorSnap.exists ? vendorSnap.data()?.fcmToken ?? null : null;

    const titulo  = "🛒 ¡Cliente en mostrador!";
    const cuerpo  = `${clientName || "Un cliente"} escanéo tu QR y espera un sello.`;
    const actionUrl = `/validar`;

    const timestamp = new Date().toISOString();

    // 2. Guardar notificación en Firestore (siempre, aunque no haya token FCM)
    await db
      .collection("usuarios")
      .doc(vendorId)
      .collection("notificaciones")
      .add({
        titulo,
        mensaje: cuerpo,
        leida: false,
        fecha: timestamp,
        tipo: "handshake",
        receptorId: vendorId,   // campo explícito para auditoría (el path ya filtra)
        actionUrl,
        clientName: clientName || "Miembro",
      });

    // 3. Enviar push FCM si el vendedor tiene token
    if (fcmToken) {
      try {
        await messaging.send({
          token: fcmToken,
          notification: { title: titulo, body: cuerpo },
          android: {
            priority: "high",
            notification: {
              title: titulo,
              body: cuerpo,
              icon: "ic_notification",
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
            headers: { Urgency: "high", TTL: "300" },
            notification: {
              title: titulo,
              body: cuerpo,
              icon: "/Logo2.png",
              badge: "/Logo2.png",
              requireInteraction: true,  // La notificación persiste hasta que el usuario la toca
              silent: false,
            },
            fcmOptions: {
              link: actionUrl,
            },
          },
        });
      } catch (fcmError: any) {
        // Limpiar token inválido
        if (
          fcmError?.errorInfo?.code === "messaging/registration-token-not-registered" ||
          fcmError?.errorInfo?.code === "messaging/invalid-registration-token"
        ) {
          await db.collection("usuarios").doc(vendorId).update({ fcmToken: null });
        }
        console.warn("[notify-vendor] FCM error (notificación Firestore enviada):", fcmError?.message);
      }
    }

    return NextResponse.json({ success: true, hasPush: !!fcmToken });
  } catch (error: any) {
    console.error("[notify-vendor] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
