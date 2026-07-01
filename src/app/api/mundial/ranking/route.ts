/**
 * GET /api/mundial/ranking
 *
 * Devuelve el leaderboard del torneo:
 *   - totalJugadores: cuántos usuarios tienen mundialUnlocked === true.
 *   - top5: los 5 usuarios con más `mundialPuntos` (fallback a 0 si el campo
 *     no existe todavía). Solo campos públicos: uid, nombre, mundialPuntos.
 *
 * Requiere un índice compuesto en `usuarios`:
 *   (mundialUnlocked ASC, mundialPuntos DESC)  → firestore.indexes.json
 *
 * Cualquier usuario autenticado puede consultarlo (los datos que expone son
 * públicos por naturaleza — nombre + puntaje del torneo).
 *
 * Headers: Authorization: Bearer <idToken>
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

type Top5Row = {
  uid: string;
  nombre: string;
  mundialPuntos: number;
};

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    try {
      await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const usuariosCol = adminDb.collection("usuarios");

    // Total de jugadores con pase libre.
    const totalSnap = await usuariosCol
      .where("mundialUnlocked", "==", true)
      .count()
      .get();
    const totalJugadores = totalSnap.data().count;

    // Top 5 por mundialPuntos desc. Requiere índice compuesto.
    const topSnap = await usuariosCol
      .where("mundialUnlocked", "==", true)
      .orderBy("mundialPuntos", "desc")
      .limit(5)
      .get();

    const top5: Top5Row[] = topSnap.docs.map((d) => {
      const data = d.data();
      const nombre: string =
        (typeof data.nombre === "string" && data.nombre.trim()) ||
        (typeof data.displayName === "string" && data.displayName.trim()) ||
        (typeof data.correo === "string" && data.correo.split("@")[0]) ||
        "Anónimo";
      const puntos = typeof data.mundialPuntos === "number" ? data.mundialPuntos : 0;
      return { uid: d.id, nombre, mundialPuntos: puntos };
    });

    return NextResponse.json({ ok: true, totalJugadores, top5 });
  } catch (error: any) {
    console.error("[mundial/ranking] Error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Error interno" },
      { status: 500 },
    );
  }
}
