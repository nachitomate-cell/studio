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
const LEGACY_IDS = [
  // Sembrados iniciales dummy
  "seed-arg-fra", "seed-bra-esp", "seed-ale-por",
  // Eliminatoria de 32 (jugada antes del 4 de julio)
  "mex-ecu", "ing-rdc", "bel-sen", "usa-bih",
  "esp-aut", "por-cro", "sui-arg",
  "aus-egi", "arg-cab", "col-gha",
  // Octavos legacy con IDs cortos (reemplazados por -oct o ya jugados)
  "can-mar", "par-fra", "bra-nor",
  // Cuartos inventados de la iteración anterior (equipos incorrectos)
  "qf-arg-ecu", "qf-esp-ale", "qf-fra-por", "qf-bra-uru",
];

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
  enJuego?: boolean;
  golesA?: number;
  golesB?: number;
};

const partidosReales: PartidoSeed[] = [
  // ── Octavos de final (Sáb 04-07 → Mar 07-07) ───────────────────────────
  // Ya se jugaron/están cerrándose. Se dejan fuera del seed para no revertir
  // los `finalizado:true` con sus goles reales guardados vía /api/mundial/resolver.
  // Sus documentos permanecen en Firestore (no se tocan al reejecutar el seed).

  // ── Cuartos de final (Jue 09-07 → Sáb 11-07) ───────────────────────────
  // qf-04 queda "A definir" hasta que se jueguen Argentina-Egipto y Suiza-Colombia.
  { id: "qf-01", equipoA: "Francia",    banderaA: "🇫🇷", equipoB: "Marruecos",  banderaB: "🇲🇦",                    fase: "Cuartos de final", fechaInicio: "2026-07-09T16:00:00-04:00", finalizado: false },
  { id: "qf-02", equipoA: "España",     banderaA: "🇪🇸", equipoB: "Bélgica",    banderaB: "🇧🇪",                    fase: "Cuartos de final", fechaInicio: "2026-07-10T15:00:00-04:00", finalizado: false },
  { id: "qf-03", equipoA: "Noruega",    banderaA: "🇳🇴", equipoB: "Inglaterra", banderaB: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", fase: "Cuartos de final", fechaInicio: "2026-07-11T17:00:00-04:00", finalizado: false },
  { id: "qf-04", equipoA: "A definir",  banderaA: "❓",  equipoB: "A definir",  banderaB: "❓",                     fase: "Cuartos de final", fechaInicio: "2026-07-11T21:00:00-04:00", finalizado: false },

  // ── Semifinales (Mar 14-07 → Mié 15-07) ────────────────────────────────
  { id: "sf-01", equipoA: "A definir", banderaA: "❓", equipoB: "A definir", banderaB: "❓", fase: "Semifinal", fechaInicio: "2026-07-14T15:00:00-04:00", finalizado: false },
  { id: "sf-02", equipoA: "A definir", banderaA: "❓", equipoB: "A definir", banderaB: "❓", fase: "Semifinal", fechaInicio: "2026-07-15T15:00:00-04:00", finalizado: false },

  // ── Tercer lugar (Sáb 18-07) ───────────────────────────────────────────
  { id: "third-place", equipoA: "A definir", banderaA: "🥉", equipoB: "A definir", banderaB: "🥉", fase: "Eliminatoria por el tercer lugar", fechaInicio: "2026-07-18T17:00:00-04:00", finalizado: false },

  // ── Final (Dom 19-07) ──────────────────────────────────────────────────
  { id: "final-01", equipoA: "A definir", banderaA: "🏆", equipoB: "A definir", banderaB: "🏆", fase: "Final", fechaInicio: "2026-07-19T15:00:00-04:00", finalizado: false },
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
        enJuego: p.enJuego === true && !p.finalizado,
        seed: true,
        seededAt: FieldValue.serverTimestamp(),
        seededBy: decoded.uid,
      };
      if (p.finalizado) {
        payload.golesA = p.golesA ?? 0;
        payload.golesB = p.golesB ?? 0;
        payload.resueltoEn = FieldValue.serverTimestamp();
      } else if (p.enJuego) {
        // Marcador en vivo al momento del seed. Sin resueltoEn.
        payload.golesA = p.golesA ?? 0;
        payload.golesB = p.golesB ?? 0;
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
