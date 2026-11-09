/**
 * POST /api/resenas/denunciar
 *
 * Un socio denuncia la reseña de otro. Lo exige la política de contenido
 * generado por usuarios de Google Play (y la guía 1.2 de Apple): toda app con
 * contenido de usuarios visible para otros necesita una forma de denunciarlo y
 * un proceso de moderación.
 *
 * - Guarda la denuncia en `reportes_resenas` (una por socio y reseña).
 * - Con 2 denuncias de socios distintos, la reseña queda `oculta` para todos
 *   hasta que un moderador la revise (la puede borrar desde Firestore o reponer
 *   quitando `oculta`).
 * - Avisa por correo a soporte para revisarla dentro de 24 h.
 *
 * Body: { reviewId: string, motivo: string }
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { checkRateLimit } from "@/lib/rateLimit";

const MOTIVOS = new Set(["ofensivo", "spam", "falso", "datos_personales", "otro"]);
const UMBRAL_OCULTAR = 2;
const CORREO_MODERACION = "hola@synaptechspa.cl";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!checkRateLimit(`denunciar:${uid}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas denuncias" }, { status: 429 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const reviewId = typeof body?.reviewId === "string" ? body.reviewId : "";
  const motivo = MOTIVOS.has(body?.motivo) ? body.motivo : "otro";
  if (!reviewId) return NextResponse.json({ error: "Falta reviewId" }, { status: 400 });

  const reviewRef = adminDb.collection("reviews").doc(reviewId);
  const review = await reviewRef.get();
  if (!review.exists) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const r = review.data() as any;
  if (r.userId === uid) return NextResponse.json({ error: "Es tu reseña" }, { status: 400 });

  // Una denuncia por socio y reseña (id determinista).
  const reporteRef = adminDb.collection("reportes_resenas").doc(`${reviewId}_${uid}`);
  const nueva = !(await reporteRef.get()).exists;
  await reporteRef.set({
    reviewId,
    vendorId: r.vendorId || "",
    autorUid: r.userId || "",
    denuncianteUid: uid,
    motivo,
    comentario: (r.comment || "").slice(0, 1000),
    fecha: new Date().toISOString(),
    estado: "pendiente",
  });

  let oculta = r.oculta === true;
  if (nueva) {
    await reviewRef.update({ denuncias: FieldValue.increment(1) });
    const total = (r.denuncias || 0) + 1;
    if (total >= UMBRAL_OCULTAR && !oculta) {
      await reviewRef.update({ oculta: true, ocultaEn: new Date().toISOString() });
      oculta = true;
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      try {
        await new Resend(apiKey).emails.send({
          from: "Club Patio Curauma <soporte@synaptechspa.cl>",
          to: CORREO_MODERACION,
          subject: `Reseña denunciada (${motivo})${oculta ? " — ya oculta" : ""}`,
          text:
            `Reseña ${reviewId} del local ${r.vendorId}\n` +
            `Autor: ${r.userName || r.userId} · ${r.rating}★\n` +
            `Texto: ${r.comment || "(sin comentario)"}\n\n` +
            `Denuncias: ${total}. ${oculta ? "Quedó oculta para todos." : "Sigue visible."}\n` +
            `Revisar en Firestore: reviews/${reviewId} y reportes_resenas.`,
        });
      } catch (e) {
        console.warn("[denunciar] no se pudo enviar el correo:", e);
      }
    }
  }
  return NextResponse.json({ ok: true, oculta });
}
