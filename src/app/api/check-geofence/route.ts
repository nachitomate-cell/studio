/**
 * POST /api/check-geofence
 *
 * Recibe coordenadas del cliente, evalúa si está dentro de alguna zona geofence
 * y si corresponde envía FCM push + guarda notificación en Firestore.
 * Todo el procesamiento ocurre en el servidor — funciona aunque la app
 * esté en segundo plano o recién abierta.
 *
 * Body: { userId: string, latitude: number, longitude: number }
 */

import { NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";
import { checkRateLimit } from "@/lib/rateLimit";

// ── Zonas geofence ─────────────────────────────────────────────────────────────
const GEOFENCE_ZONES = [
  {
    id: "patio",
    lat: -33.1316449,
    lng: -71.564289,
    radius: 800,
    cooldownMs: 24 * 60 * 60 * 1000,
    titulo: "¡Estás cerca de Patio Curauma! 🛍️",
    mensaje: "Visítanos hoy y suma sellos en tus tiendas favoritas.",
  },
  {
    id: "entrada",
    lat: -33.144649,
    lng: -71.5715651,
    radius: 300,
    cooldownMs: 24 * 60 * 60 * 1000,
    titulo: "¡Estás a pasos de Patio! 🏪",
    mensaje: "Abre tu código y cobra tus premios.",
  },
  {
    id: "test",
    lat: -33.0313645,
    lng: -71.5642368,
    radius: 500,
    cooldownMs: 5 * 60 * 1000,
    titulo: "¡Modo Pruebas Base Luna Labs! 🛰️",
    mensaje: "GPS detectado correctamente. El geofencing está funcionando.",
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

// ── Haversine ──────────────────────────────────────────────────────────────────
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Handler ────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { userId, latitude, longitude } = await request.json();

    if (!userId || latitude == null || longitude == null) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros: userId, latitude, longitude" },
        { status: 400 }
      );
    }

    if (!checkRateLimit(`geofence:${userId}`, 10, 60_000)) {
      return NextResponse.json({ success: false, triggered: false }, { status: 429 });
    }

    // Calcular distancia a cada zona
    const zonesWithDist = GEOFENCE_ZONES.map((z) => ({
      ...z,
      distance: Math.round(calcDistance(latitude, longitude, z.lat, z.lng)),
    }));

    const matched = zonesWithDist.find((z) => z.distance < z.radius);

    // No está en ninguna zona → devolver distancias para debug
    if (!matched) {
      return NextResponse.json({
        triggered: false,
        distances: zonesWithDist.map(({ id, distance, radius }) => ({
          id,
          distance,
          radius,
        })),
      });
    }

    const adminApp = getAdminApp();
    const adminDb  = getFirestore(adminApp);
    const notifRef = adminDb.collection("usuarios").doc(userId).collection("notificaciones");

    // Dedup: ¿ya recibió una notificación geofence dentro del cooldown?
    // Usamos orderBy en un solo campo (índice simple, no requiere índice compuesto)
    // y filtramos tipo en memoria para evitar el error "query requires an index".
    const cooldownStart = new Date(Date.now() - matched.cooldownMs).toISOString();
    const recentSnap = await notifRef
      .orderBy("fecha", "desc")
      .limit(20)
      .get();

    const yaNotificado = recentSnap.docs.some(
      (d) => d.data().tipo === "geofence" && d.data().fecha >= cooldownStart
    );

    if (yaNotificado) {
      return NextResponse.json({
        triggered: false,
        reason: "cooldown",
        zone: matched.id,
        distance: matched.distance,
      });
    }

    // Guardar notificación en Firestore
    await notifRef.add({
      titulo: matched.titulo,
      mensaje: matched.mensaje,
      leida: false,
      fecha: new Date().toISOString(),
      tipo: "geofence",
      isAI: true,
      cta: "Ver Mapa",
    });

    // Obtener FCM token y enviar push
    const userSnap = await adminDb.collection("usuarios").doc(userId).get();
    const fcmToken = userSnap.data()?.fcmToken ?? null;
    let pushSent = false;

    if (fcmToken) {
      const messaging = getMessaging(adminApp);
      await messaging.send({
        token: fcmToken,
        notification: { title: matched.titulo, body: matched.mensaje },
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
              alert: { title: matched.titulo, body: matched.mensaje },
              sound: "default",
              badge: 1,
              "content-available": 1,
            },
          },
        },
        webpush: {
          headers: { Urgency: "high", TTL: "86400" },
          notification: {
            title: matched.titulo,
            body: matched.mensaje,
            icon: "/Logo2.png",
            badge: "/Logo2.png",
          },
          fcmOptions: { link: "/" },
        },
      });
      pushSent = true;
    }

    return NextResponse.json({
      triggered: true,
      zone: matched.id,
      distance: matched.distance,
      pushSent,
    });
  } catch (error: any) {
    console.error("[check-geofence] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
