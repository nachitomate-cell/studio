/**
 * GET /api/mundial/ranking
 *
 * Devuelve el leaderboard del torneo:
 *   - totalJugadores: cuántos usuarios tienen mundialUnlocked === true.
 *   - top5: los 5 con más `mundialPuntos` (incluye usuarios en 0 puntos).
 *
 * IMPORTANTE: no usamos `orderBy('mundialPuntos', 'desc')` en Firestore
 * porque excluye documentos donde el campo no existe todavía (usuarios que
 * desbloquearon pero aún no ganaron sellos). En su lugar ordenamos en memoria
 * — el conjunto se mantendrá pequeño incluso en producción (≤ cientos).
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
    const totalJugadoresCount = totalSnap.data().count;

    // Top jugadores por puntaje. NO usamos orderBy en Firestore porque
    // `orderBy('mundialPuntos')` excluye documentos donde el campo no existe
    // (usuarios que desbloquearon pero aún no han ganado sellos). Traemos todos
    // los que tienen pase libre y ordenamos en memoria — el conjunto es chico
    // (≤ cientos) y así incluimos usuarios con 0 puntos.
    const jugadoresSnap = await usuariosCol
      .where("mundialUnlocked", "==", true)
      .get();

    const jugadores = jugadoresSnap.docs.map((d) => {
      const data = d.data();
      const nombre: string =
        (typeof data.nombre === "string" && data.nombre.trim()) ||
        (typeof data.displayName === "string" && data.displayName.trim()) ||
        (typeof data.correo === "string" && data.correo.split("@")[0]) ||
        "Anónimo";
      const puntos = typeof data.mundialPuntos === "number" ? data.mundialPuntos : 0;
      return { uid: d.id, nombre, mundialPuntos: puntos };
    });

    jugadores.sort((a, b) => b.mundialPuntos - a.mundialPuntos);
    const top5: Top5Row[] = jugadores.slice(0, 5);

    // Fallback defensivo: si por alguna razón el count() devolvió 0 pero
    // vinieron docs en el fetch, prefiere el conteo real de docs.
    const totalJugadores = Math.max(totalJugadoresCount, jugadores.length);

    console.log(
      `[mundial/ranking] count()=${totalJugadoresCount} · docs=${jugadores.length} · top5=${top5.length}`,
    );

    return NextResponse.json({ ok: true, totalJugadores, top5 });
  } catch (error: any) {
    console.error("[mundial/ranking] Error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Error interno" },
      { status: 500 },
    );
  }
}
