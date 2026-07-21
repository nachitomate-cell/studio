/**
 * /api/whatsapp/webhook — entrada desde el VPS Evolution (instance_clubpatio).
 *
 * Maneja SOLO dos cosas (acá no hay bot conversacional — las respuestas de
 * los socios le llegan a Pancho al teléfono del club, como siempre):
 *
 *   · connection.update → espejo del estado en wa_marketing/estado
 *   · messages.upsert entrante con STOP/BAJA → opt-out PERMANENTE en
 *     wa_optouts/{telefono} + confirmación cortés. Ley 21.719: la salida
 *     siempre disponible y automática.
 *
 * Seguridad: header x-webhook-token (configurado al crear la instancia).
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { enviarTexto } from "@/lib/waEvolution";
import { esOptOut } from "@/lib/waMarketing";

export async function POST(request: Request) {
  const token = process.env.WA_WEBHOOK_TOKEN?.trim();
  if (!token || request.headers.get("x-webhook-token") !== token) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 200 siempre que se procese: si Evolution acumula errores, pausa el webhook.
  try {
    const body = await request.json().catch(() => ({} as any));
    const event = String(body.event || "").toLowerCase();
    const estadoRef = adminDb.doc("wa_marketing/estado");

    if (event === "connection.update") {
      const state = body.data?.state || body.data?.connection;
      if (state === "open") {
        const prev = (await estadoRef.get()).data() || {};
        await estadoRef.set({
          estadoConexion: "connected",
          numeroVinculado: body.data?.wuid ? String(body.data.wuid).replace(/[:@].*$/, "") : null,
          conectadoEn: FieldValue.serverTimestamp(),
          ...(prev.vinculadoDesde ? {} : { vinculadoDesde: FieldValue.serverTimestamp() }),
          desconectadoEn: FieldValue.delete(),
        }, { merge: true });
      } else if (state === "close") {
        const prev = (await estadoRef.get()).data() || {};
        await estadoRef.set({
          estadoConexion: "disconnected",
          ...(prev.estadoConexion === "disconnected" && prev.desconectadoEn
            ? {} : { desconectadoEn: FieldValue.serverTimestamp() }),
        }, { merge: true });
      }
      return NextResponse.json({ ok: true });
    }

    if (event === "messages.upsert") {
      const data = body.data || {};
      const key = data.key || {};
      if (key.fromMe === true) return NextResponse.json({ ok: true }); // ecos propios
      const remoteJid = String(key.remoteJid || "");
      if (!remoteJid.endsWith("@s.whatsapp.net")) return NextResponse.json({ ok: true }); // grupos/otros
      const tel = remoteJid.replace(/@.*$/, "");
      const texto =
        data.message?.conversation ||
        data.message?.extendedTextMessage?.text ||
        "";

      if (tel && esOptOut(texto)) {
        await adminDb.doc(`wa_optouts/${tel}`).set({
          telefono: tel,
          mensaje: String(texto).slice(0, 200),
          fecha: FieldValue.serverTimestamp(),
        }, { merge: true });
        // Confirmación cortés (español neutro). Best-effort: si falla, el
        // opt-out ya quedó registrado igual.
        await enviarTexto(tel, "Listo ✅ No volverás a recibir mensajes del Club Patio. Si algún día quieres volver, escríbenos VOLVER.").catch(() => {});
      } else if (tel && /\bvolver\b/i.test(String(texto || ""))) {
        await adminDb.doc(`wa_optouts/${tel}`).delete().catch(() => {});
        await enviarTexto(tel, "¡Bienvenido de vuelta al Club Patio! 🎉").catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true, ignored: event });
  } catch (e) {
    console.error("[wa-webhook]", e);
    return NextResponse.json({ ok: false }, { status: 200 }); // no gatillar reintentos en loop
  }
}
