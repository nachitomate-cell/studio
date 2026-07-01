/**
 * POST /api/mundial/seed
 *
 * Endpoint de sembrado (solo staff). Rellena `mundial_partidos` con el
 * calendario oficial del mundial (Julio 2026, zona horaria Chile -04:00).
 *
 * Idempotente: usa `set(doc, { merge: true })` con IDs deterministas, así
 * puedes reejecutarlo cuando se definan nuevos cruces sin romper los
 * pronósticos ya guardados por los usuarios ni los partidos ya resueltos
 * (los `finalizado:true` con `golesA/B` se preservan porque el merge no
 * borra campos ausentes en el nuevo payload — pero cuidado: si vuelves a
 * poner `finalizado:false` para un id que ya fue resuelto, sí lo revertirás).
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    (vacío)
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { ADMIN_EMAIL, ALLOWED_MOD_EMAILS } from "@/lib/constants";

const ROLES_PERMITIDOS = ["admin", "director", "director_patio", "moderador"];

// IDs de sembrados previos (dummy) que se limpian automáticamente al reejecutar.
// La eliminación es idempotente: si ya no existen, el batch.delete es un no-op.
const LEGACY_IDS = ["seed-arg-fra", "seed-bra-esp", "seed-ale-por"];

// Calendario oficial. Añade filas aquí conforme se definan los cruces.
// Fechas en ISO 8601 con offset -04:00 (hora de Chile).
type PartidoSeed = {
  id: string;
  equipoA: string;
  banderaA: string;
  equipoB: string;
  banderaB: string;
  fase: string;
  fechaInicio: string;
  finalizado: boolean;
  golesA?: number;
  golesB?: number;
};

const partidosReales: PartidoSeed[] = [
  // Partido ya finalizado (Ayer)
  { id: "mex-ecu", equipoA: "México", banderaA: "🇲🇽", equipoB: "Ecuador", banderaB: "🇪🇨", fase: "Eliminatoria de 32", fechaInicio: "2026-06-30T12:00:00-04:00", finalizado: true, golesA: 2, golesB: 0 },

  // Partidos de Hoy (1 de Julio)
  { id: "ing-rdc", equipoA: "Inglaterra", banderaA: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", equipoB: "RD Congo", banderaB: "🇨🇩", fase: "Eliminatoria de 32", fechaInicio: "2026-07-01T12:00:00-04:00", finalizado: false },
  { id: "bel-sen", equipoA: "Bélgica", banderaA: "🇧🇪", equipoB: "Senegal", banderaB: "🇸🇳", fase: "Eliminatoria de 32", fechaInicio: "2026-07-01T16:00:00-04:00", finalizado: false },
  { id: "usa-bih", equipoA: "Estados Unidos", banderaA: "🇺🇸", equipoB: "Bosnia y Herz.", banderaB: "🇧🇦", fase: "Eliminatoria de 32", fechaInicio: "2026-07-01T20:00:00-04:00", finalizado: false },

  // Partidos de Mañana (2 de Julio)
  { id: "esp-aut", equipoA: "España", banderaA: "🇪🇸", equipoB: "Austria", banderaB: "🇦🇹", fase: "Eliminatoria de 32", fechaInicio: "2026-07-02T15:00:00-04:00", finalizado: false },
  { id: "por-cro", equipoA: "Portugal", banderaA: "🇵🇹", equipoB: "Croacia", banderaB: "🇭🇷", fase: "Eliminatoria de 32", fechaInicio: "2026-07-02T19:00:00-04:00", finalizado: false },
  { id: "sui-arg", equipoA: "Suiza", banderaA: "🇨🇭", equipoB: "Argelia", banderaB: "🇩🇿", fase: "Eliminatoria de 32", fechaInicio: "2026-07-02T23:00:00-04:00", finalizado: false },

  // Partidos del Viernes (3 de Julio)
  { id: "aus-egi", equipoA: "Australia", banderaA: "🇦🇺", equipoB: "Egipto", banderaB: "🇪🇬", fase: "Eliminatoria de 32", fechaInicio: "2026-07-03T14:00:00-04:00", finalizado: false },
  { id: "arg-cab", equipoA: "Argentina", banderaA: "🇦🇷", equipoB: "Cabo Verde", banderaB: "🇨🇻", fase: "Eliminatoria de 32", fechaInicio: "2026-07-03T18:00:00-04:00", finalizado: false },
  { id: "col-gha", equipoA: "Colombia", banderaA: "🇨🇴", equipoB: "Ghana", banderaB: "🇬🇭", fase: "Eliminatoria de 32", fechaInicio: "2026-07-03T21:30:00-04:00", finalizado: false },

  // Octavos de final (Sábado 4 y Domingo 5)
  { id: "can-mar", equipoA: "Canadá", banderaA: "🇨🇦", equipoB: "Marruecos", banderaB: "🇲🇦", fase: "Octavos de final", fechaInicio: "2026-07-04T13:00:00-04:00", finalizado: false },
  { id: "par-fra", equipoA: "Paraguay", banderaA: "🇵🇾", equipoB: "Francia", banderaB: "🇫🇷", fase: "Octavos de final", fechaInicio: "2026-07-04T17:00:00-04:00", finalizado: false },
  { id: "bra-nor", equipoA: "Brasil", banderaA: "🇧🇷", equipoB: "Noruega", banderaB: "🇳🇴", fase: "Octavos de final", fechaInicio: "2026-07-05T16:00:00-04:00", finalizado: false },
];

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
        { error: "Solo staff (moderador/admin) puede sembrar partidos." },
        { status: 403 },
      );
    }

    const batch = adminDb.batch();

    // Limpieza de partidos legacy y sus pronósticos asociados
    let legacyPartidosBorrados = 0;
    let legacyPronosticosBorrados = 0;
    for (const legacyId of LEGACY_IDS) {
      const ref = adminDb.collection("mundial_partidos").doc(legacyId);
      const snap = await ref.get();
      if (snap.exists) {
        batch.delete(ref);
        legacyPartidosBorrados++;
      }
    }
    // Pronósticos huérfanos: partidoId ∈ LEGACY_IDS (máx 30 con `in`, tenemos 3).
    const pronosLegacy = await adminDb
      .collection("mundial_pronosticos")
      .where("partidoId", "in", LEGACY_IDS)
      .get();
    pronosLegacy.forEach((d) => {
      batch.delete(d.ref);
      legacyPronosticosBorrados++;
    });

    // Sembrado del calendario oficial
    for (const p of partidosReales) {
      const ref = adminDb.collection("mundial_partidos").doc(p.id);
      const payload: Record<string, unknown> = {
        equipoA: p.equipoA,
        banderaA: p.banderaA,
        equipoB: p.equipoB,
        banderaB: p.banderaB,
        fase: p.fase,
        fechaInicio: Timestamp.fromDate(new Date(p.fechaInicio)),
        finalizado: p.finalizado,
        seed: true,
        seededAt: FieldValue.serverTimestamp(),
        seededBy: decoded.uid,
      };
      if (p.finalizado) {
        payload.golesA = p.golesA ?? 0;
        payload.golesB = p.golesB ?? 0;
        payload.resueltoEn = FieldValue.serverTimestamp();
      }
      batch.set(ref, payload, { merge: true });
    }
    await batch.commit();

    (async () => {
      try {
        await adminDb.collection("system_logs").add({
          usuarioId: decoded.uid,
          usuario: decoded.email ?? "staff",
          accion: `sembró ${partidosReales.length} partidos oficiales en mundial_partidos${legacyPartidosBorrados ? ` (limpió ${legacyPartidosBorrados} legacy + ${legacyPronosticosBorrados} pronósticos huérfanos)` : ""}`,
          fecha: new Date().toISOString(),
          tipo: "MUNDIAL_SEED",
        });
      } catch (e) {
        console.warn("[mundial/seed] Log falló:", e);
      }
    })();

    return NextResponse.json({
      ok: true,
      count: partidosReales.length,
      ids: partidosReales.map((p) => p.id),
      legacyPartidosBorrados,
      legacyPronosticosBorrados,
    });
  } catch (error: any) {
    console.error("[mundial/seed] Error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Error interno" },
      { status: 500 },
    );
  }
}
