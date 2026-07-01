/**
 * POST /api/mundial/crear-partido
 *
 * Alta manual de un partido por parte del staff (moderador/admin/director).
 * El cliente jamás escribe en `mundial_partidos` — este endpoint es el único
 * camino además del seeder.
 *
 * Genera un ID legible a partir de las 3 primeras letras de cada equipo +
 * sufijo aleatorio corto (evita colisiones cuando dos partidos comparten
 * equipo — típico si un equipo pasa a la siguiente fase).
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { equipoA: string, equipoB: string, fase: string, fechaInicio: string(ISO) }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { ADMIN_EMAIL, ALLOWED_MOD_EMAILS } from "@/lib/constants";

const ROLES_PERMITIDOS = ["admin", "director", "director_patio", "moderador"];

function slug(equipo: string): string {
  // Toma letras/dígitos, quita acentos, corta a 3, minúsculas.
  return equipo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 3) || "xxx";
}

function generarPartidoId(equipoA: string, equipoB: string): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${slug(equipoA)}-${slug(equipoB)}-${suffix}`;
}

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
        { error: "Solo staff (moderador/admin) puede crear partidos." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const equipoA: string = (body?.equipoA ?? "").toString().trim();
    const equipoB: string = (body?.equipoB ?? "").toString().trim();
    const fase: string = (body?.fase ?? "").toString().trim();
    const fechaInicioRaw: string = (body?.fechaInicio ?? "").toString().trim();

    if (!equipoA || !equipoB) {
      return NextResponse.json({ error: "Nombres de equipos requeridos." }, { status: 400 });
    }
    if (!fase) {
      return NextResponse.json({ error: "Fase requerida." }, { status: 400 });
    }
    if (!fechaInicioRaw) {
      return NextResponse.json({ error: "Fecha de inicio requerida." }, { status: 400 });
    }
    const fechaDate = new Date(fechaInicioRaw);
    if (Number.isNaN(fechaDate.getTime())) {
      return NextResponse.json({ error: "Fecha de inicio inválida." }, { status: 400 });
    }

    // ID legible con sufijo aleatorio para permitir múltiples partidos con
    // los mismos equipos (por ejemplo si un equipo avanza y vuelve a jugar).
    let partidoId = generarPartidoId(equipoA, equipoB);
    // Guarda contra colisión (extremadamente improbable, pero es barato verificar).
    for (let intento = 0; intento < 3; intento++) {
      const existing = await adminDb.collection("mundial_partidos").doc(partidoId).get();
      if (!existing.exists) break;
      partidoId = generarPartidoId(equipoA, equipoB);
    }

    await adminDb.collection("mundial_partidos").doc(partidoId).set({
      equipoA,
      equipoB,
      fase,
      fechaInicio: Timestamp.fromDate(fechaDate),
      finalizado: false,
      creadoManualmente: true,
      creadoPor: decoded.uid,
      creadoEn: FieldValue.serverTimestamp(),
    });

    (async () => {
      try {
        await adminDb.collection("system_logs").add({
          usuarioId: decoded.uid,
          usuario: decoded.email ?? "staff",
          accion: `creó partido ${partidoId}: ${equipoA} vs ${equipoB} (${fase})`,
          fecha: new Date().toISOString(),
          tipo: "MUNDIAL_CREAR_PARTIDO",
        });
      } catch (e) {
        console.warn("[mundial/crear-partido] Log falló:", e);
      }
    })();

    return NextResponse.json({
      ok: true,
      partidoId,
      equipoA,
      equipoB,
      fase,
      fechaInicio: fechaDate.toISOString(),
    });
  } catch (error: any) {
    console.error("[mundial/crear-partido] Error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Error interno" },
      { status: 500 },
    );
  }
}
