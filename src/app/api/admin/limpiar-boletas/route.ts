/**
 * POST /api/admin/limpiar-boletas
 *
 * Limpieza masiva de boletas antiguas: borra de Storage las imágenes de boletas
 * con más de N días, conservando el registro en system_logs (solo se limpian
 * boletaPath/boletaUrl). Libera almacenamiento sin perder la auditoría.
 *
 * Solo staff (moderador/director/admin).
 * Headers: Authorization: Bearer <idToken>
 * Body:    { olderThanDays?: number }   (default 90)
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebaseAdmin";

const ALLOWED_ROLES = ["admin", "moderador", "director", "director_patio"];

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let callerUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const callerSnap = await adminDb.collection("usuarios").doc(callerUid).get();
  const callerRol = callerSnap.data()?.rol as string | undefined;
  if (!callerSnap.exists || !callerRol || !ALLOWED_ROLES.includes(callerRol)) {
    return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 });
  }

  let olderThanDays = 90;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.olderThanDays === "number" && body.olderThanDays >= 0) {
      olderThanDays = body.olderThanDays;
    }
  } catch { /* usa default */ }

  const cutoffIso = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  // Buscar logs con boleta de cualquier flujo auto-servicio (asociado o
  // membresía). Query "in" evita un índice compuesto y cubre ambos métodos.
  const snap = await adminDb
    .collection("system_logs")
    .where("metodo", "in", ["CLIENT_BOLETA", "CLIENT_MEMBRESIA"])
    .get();

  const objetivos = snap.docs.filter((d) => {
    const data = d.data();
    return !!data.boletaPath && typeof data.fecha === "string" && data.fecha < cutoffIso;
  });

  const bucket = adminStorage.bucket();
  let borradas = 0;
  let errores = 0;

  // Procesar en serie para no saturar; el volumen de boletas antiguas es acotado.
  for (const d of objetivos) {
    const path = d.data().boletaPath as string;
    try {
      await bucket.file(path).delete({ ignoreNotFound: true } as any);
      borradas++;
    } catch (e) {
      errores++;
      console.warn("[limpiar-boletas] No se pudo borrar:", path, e);
    }
    // Limpiar las referencias en el log (conserva el registro de auditoría)
    await d.ref.update({ boletaPath: null, boletaUrl: null, boletaLimpiada: true }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    olderThanDays,
    encontradas: objetivos.length,
    borradas,
    errores,
  });
}
