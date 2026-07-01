/**
 * POST /api/mundial/borrar-partido
 *
 * Elimina un partido de `mundial_partidos` y sus pronósticos asociados
 * (evita huérfanos en `mundial_pronosticos`). Solo staff.
 *
 * NO revierte sellos ya repartidos: si el partido estaba finalizado y los
 * pronósticos se resolvieron, `comprasRealizadas`/`mundialPuntos` de los
 * usuarios permanecen intactos. Este endpoint asume que se usa para corregir
 * errores de carga, no para deshacer premios pagados.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { partidoId: string }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ADMIN_EMAIL, ALLOWED_MOD_EMAILS } from "@/lib/constants";

const ROLES_PERMITIDOS = ["admin", "director", "director_patio", "moderador"];
const BATCH_MAX = 400;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const callerDoc = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : null;
    const callerRol: string = callerData?.rol ?? "";
    const callerRoles: string[] = Array.isArray(callerData?.roles) ? callerData!.roles : [];
    const callerEmail = (decoded.email ?? "").trim().toLowerCase();

    const hasPermission =
      ROLES_PERMITIDOS.includes(callerRol) ||
      callerRoles.some((r) => ROLES_PERMITIDOS.includes(r)) ||
      callerEmail === ADMIN_EMAIL ||
      ALLOWED_MOD_EMAILS.includes(callerEmail);

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Solo staff (moderador/admin) puede borrar partidos." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const partidoId: string = (body?.partidoId ?? "").toString().trim();
    if (!partidoId) {
      return NextResponse.json({ error: "partidoId requerido" }, { status: 400 });
    }

    const partidoRef = adminDb.collection("mundial_partidos").doc(partidoId);
    const partidoSnap = await partidoRef.get();
    if (!partidoSnap.exists) {
      return NextResponse.json({ error: "Partido no encontrado." }, { status: 404 });
    }

    // Borra pronósticos huérfanos en batches ≤400.
    const pronosSnap = await adminDb
      .collection("mundial_pronosticos")
      .where("partidoId", "==", partidoId)
      .get();

    let batch = adminDb.batch();
    let opsEnBatch = 0;
    const commits: Promise<any>[] = [];
    let pronosticosBorrados = 0;

    for (const doc of pronosSnap.docs) {
      batch.delete(doc.ref);
      opsEnBatch++;
      pronosticosBorrados++;
      if (opsEnBatch >= BATCH_MAX) {
        commits.push(batch.commit());
        batch = adminDb.batch();
        opsEnBatch = 0;
      }
    }

    batch.delete(partidoRef);
    opsEnBatch++;
    commits.push(batch.commit());

    await Promise.all(commits);

    (async () => {
      try {
        await adminDb.collection("system_logs").add({
          usuarioId: decoded.uid,
          usuario: decoded.email ?? "staff",
          accion: `borró partido ${partidoId} (${pronosticosBorrados} pronósticos huérfanos limpiados)`,
          fecha: new Date().toISOString(),
          tipo: "MUNDIAL_BORRAR_PARTIDO",
        });
      } catch (e) {
        console.warn("[mundial/borrar-partido] Log falló:", e);
      }
    })();

    return NextResponse.json({ ok: true, partidoId, pronosticosBorrados });
  } catch (error: any) {
    console.error("[mundial/borrar-partido] Error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Error interno" },
      { status: 500 },
    );
  }
}
