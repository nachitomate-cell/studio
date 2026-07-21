/**
 * /api/whatsapp/estado — conexión de la instancia WhatsApp del club.
 *
 *   GET    → estado actual (connected / qr / disconnected) + QR si corresponde
 *   POST   → vincular: crea la instancia en el VPS y devuelve el QR
 *   DELETE → desvincular (control 100% manual del moderador)
 *
 * Solo moderadores (Bearer idToken). El estado espejo vive en
 * wa_marketing/estado para que la vista y el cron no dependan del VPS.
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { verificarModerador } from "@/lib/waModAuth";
import { crearInstancia, estadoConexion, obtenerQR, desvincular } from "@/lib/waEvolution";

const ESTADO_REF = () => adminDb.doc("wa_marketing/estado");

export async function GET(request: Request) {
  const auth = await verificarModerador(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const state = await estadoConexion(); // open | connecting | close | unknown
  if (state === "open") {
    const prev = (await ESTADO_REF().get()).data() || {};
    await ESTADO_REF().set({
      estadoConexion: "connected",
      conectadoEn: FieldValue.serverTimestamp(),
      ...(prev.vinculadoDesde ? {} : { vinculadoDesde: FieldValue.serverTimestamp() }),
      desconectadoEn: FieldValue.delete(),
    }, { merge: true });
    return NextResponse.json({ estado: "connected" });
  }

  let qr: string | null = null;
  if (state === "connecting" || state === "close" || state === "unknown") {
    try { qr = (await obtenerQR()).qr; } catch { /* instancia puede no existir aún */ }
  }
  return NextResponse.json({ estado: qr ? "qr" : "disconnected", qr });
}

export async function POST(request: Request) {
  const auth = await verificarModerador(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const token = process.env.WA_WEBHOOK_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "Falta WA_WEBHOOK_TOKEN en el entorno." }, { status: 500 });

  // URL pública del webhook: derivada del host del request (Vercel).
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const webhookUrl = `https://${host}/api/whatsapp/webhook`;

  let r;
  try {
    r = await crearInstancia(webhookUrl, token);
  } catch {
    // Instancia colgada de un intento previo → destruir y reintentar una vez.
    await desvincular();
    r = await crearInstancia(webhookUrl, token);
  }

  await ESTADO_REF().set({
    estadoConexion: "qr",
    vinculadaPor: auth.email,
    creadoEn: FieldValue.serverTimestamp(),
  }, { merge: true });

  return NextResponse.json({ estado: "qr", qr: r.qr });
}

export async function DELETE(request: Request) {
  const auth = await verificarModerador(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await desvincular();
  await ESTADO_REF().set({
    estadoConexion: "disconnected",
    desvinculadoEn: FieldValue.serverTimestamp(),
    desvinculadoPor: auth.email,
  }, { merge: true });
  return NextResponse.json({ ok: true });
}
