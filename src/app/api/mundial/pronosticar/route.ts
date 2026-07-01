/**
 * POST /api/mundial/pronosticar
 *
 * Registra o actualiza el pronóstico de un usuario para un partido.
 * Requisitos:
 *   - El usuario debe tener `mundialUnlocked === true` (paywall pagado).
 *   - El partido debe existir y `Timestamp.now() < partido.fechaInicio`
 *     (no se aceptan pronósticos después del inicio).
 *
 * El documento se guarda en `mundial_pronosticos/{uid}_{partidoId}` para
 * garantizar idempotencia (un solo pronóstico por usuario/partido).
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { partidoId: string, golesA: number, golesB: number }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { checkRateLimit } from "@/lib/rateLimit";

function normalizarGoles(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < 0 || n > 30) return null;
  return n;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(`mundial-pron:${ip}`, 30, 60_000)) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta en un momento." },
        { status: 429 },
      );
    }

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

    const body = await request.json();
    const partidoId: string = (body?.partidoId ?? "").toString().trim();
    const golesA = normalizarGoles(body?.golesA);
    const golesB = normalizarGoles(body?.golesB);

    if (!partidoId) {
      return NextResponse.json({ error: "partidoId requerido" }, { status: 400 });
    }
    if (golesA === null || golesB === null) {
      return NextResponse.json(
        { error: "Los goles deben ser enteros entre 0 y 30." },
        { status: 400 },
      );
    }

    const userId = decoded.uid;
    const userRef = adminDb.collection("usuarios").doc(userId);
    const partidoRef = adminDb.collection("mundial_partidos").doc(partidoId);
    const pronosticoRef = adminDb
      .collection("mundial_pronosticos")
      .doc(`${userId}_${partidoId}`);

    await adminDb.runTransaction(async (tx) => {
      const [userSnap, partidoSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(partidoRef),
      ]);

      if (!userSnap.exists) throw new Error("Usuario no encontrado.");
      const u = userSnap.data()!;
      if (u.baneado) throw new Error("Usuario baneado.");
      if (u.mundialUnlocked !== true) {
        const err: any = new Error(
          "Necesitas desbloquear el Pase Libre Mundialista antes de pronosticar.",
        );
        err.status = 403;
        throw err;
      }

      if (!partidoSnap.exists) throw new Error("Partido no encontrado.");
      const p = partidoSnap.data()!;

      const fechaInicio: Timestamp | undefined = p.fechaInicio;
      if (!fechaInicio || typeof (fechaInicio as any).toMillis !== "function") {
        throw new Error("El partido no tiene fecha de inicio válida.");
      }
      if (Timestamp.now().toMillis() >= fechaInicio.toMillis()) {
        throw new Error("El partido ya comenzó. No se aceptan pronósticos.");
      }

      tx.set(
        pronosticoRef,
        {
          userId,
          partidoId,
          golesA,
          golesB,
          equipoA: p.equipoA ?? null,
          equipoB: p.equipoB ?? null,
          creadoEn: FieldValue.serverTimestamp(),
          actualizadoEn: FieldValue.serverTimestamp(),
          resuelto: false,
        },
        { merge: true },
      );
    });

    return NextResponse.json({ ok: true, partidoId, golesA, golesB });
  } catch (error: any) {
    const status = error?.status ?? 400;
    console.error("[mundial/pronosticar] Error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Error interno" },
      { status },
    );
  }
}
