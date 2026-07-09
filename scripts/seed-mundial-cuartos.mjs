/**
 * seed-mundial-cuartos.mjs
 *
 * Corre el mismo sembrado que POST /api/mundial/seed, pero desde CLI
 * usando firebase-admin con las credenciales de .env.local — evita
 * tener que generar un idToken de Firebase Auth.
 *
 * Idempotente: usa set(doc, { merge: true }) con IDs deterministas.
 * NO toca los octavos (se dejaron fuera del array `partidosReales`
 * para preservar los `finalizado:true` guardados por /api/mundial/resolver).
 *
 * Uso: node scripts/seed-mundial-cuartos.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

// ── Cargar .env.local ────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env.local");

try {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
    process.env[key] = val;
  }
} catch {
  console.error("No se encontró .env.local");
  process.exit(1);
}

// ── Firebase Admin ───────────────────────────────────────────────────────────
const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
const rawKey      = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";

let privateKey;
if (!rawKey.includes("-----BEGIN")) {
  privateKey = Buffer.from(rawKey, "base64").toString("utf-8");
} else {
  privateKey = rawKey.replace(/\\n/g, "\n");
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

// ── IDs legacy (mismos que POST /api/mundial/seed) ───────────────────────────
const LEGACY_IDS = [
  "seed-arg-fra", "seed-bra-esp", "seed-ale-por",
  "mex-ecu", "ing-rdc", "bel-sen", "usa-bih",
  "esp-aut", "por-cro", "sui-arg",
  "aus-egi", "arg-cab", "col-gha",
  "can-mar", "par-fra", "bra-nor",
  "qf-arg-ecu", "qf-esp-ale", "qf-fra-por", "qf-bra-uru",
];

// ── Calendario (mismo array que la ruta seed) ────────────────────────────────
const partidosReales = [
  // Octavos: intencionalmente fuera. Sus docs quedan intactos en Firestore.

  // ── Cuartos de final ────────────────────────────────────────────────────
  { id: "qf-01", equipoA: "Francia",   banderaA: "🇫🇷", equipoB: "Marruecos",  banderaB: "🇲🇦",                     fase: "Cuartos de final", fechaInicio: "2026-07-09T16:00:00-04:00", finalizado: false },
  { id: "qf-02", equipoA: "España",    banderaA: "🇪🇸", equipoB: "Bélgica",    banderaB: "🇧🇪",                     fase: "Cuartos de final", fechaInicio: "2026-07-10T15:00:00-04:00", finalizado: false },
  { id: "qf-03", equipoA: "Noruega",   banderaA: "🇳🇴", equipoB: "Inglaterra", banderaB: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", fase: "Cuartos de final", fechaInicio: "2026-07-11T17:00:00-04:00", finalizado: false },
  { id: "qf-04", equipoA: "A definir", banderaA: "❓",  equipoB: "A definir",  banderaB: "❓",                      fase: "Cuartos de final", fechaInicio: "2026-07-11T21:00:00-04:00", finalizado: false },

  // ── Semifinales ─────────────────────────────────────────────────────────
  { id: "sf-01", equipoA: "A definir", banderaA: "❓", equipoB: "A definir", banderaB: "❓", fase: "Semifinal", fechaInicio: "2026-07-14T15:00:00-04:00", finalizado: false },
  { id: "sf-02", equipoA: "A definir", banderaA: "❓", equipoB: "A definir", banderaB: "❓", fase: "Semifinal", fechaInicio: "2026-07-15T15:00:00-04:00", finalizado: false },

  // ── Tercer lugar ────────────────────────────────────────────────────────
  { id: "third-place", equipoA: "A definir", banderaA: "🥉", equipoB: "A definir", banderaB: "🥉", fase: "Eliminatoria por el tercer lugar", fechaInicio: "2026-07-18T17:00:00-04:00", finalizado: false },

  // ── Final ───────────────────────────────────────────────────────────────
  { id: "final-01", equipoA: "A definir", banderaA: "🏆", equipoB: "A definir", banderaB: "🏆", fase: "Final", fechaInicio: "2026-07-19T15:00:00-04:00", finalizado: false },
];

// ── Ejecutar ─────────────────────────────────────────────────────────────────
console.log("[mundial-seed-cli] Limpiando legacy IDs…");
const batch = db.batch();
let legacyPartidosBorrados = 0;
let legacyPronosticosBorrados = 0;

for (const legacyId of LEGACY_IDS) {
  const ref = db.collection("mundial_partidos").doc(legacyId);
  const snap = await ref.get();
  if (snap.exists) {
    batch.delete(ref);
    legacyPartidosBorrados++;
  }
}

// Firestore permite máx. 30 en `in`, tenemos 20.
const pronosLegacy = await db
  .collection("mundial_pronosticos")
  .where("partidoId", "in", LEGACY_IDS)
  .get();
pronosLegacy.forEach((d) => {
  batch.delete(d.ref);
  legacyPronosticosBorrados++;
});

console.log("[mundial-seed-cli] Sembrando calendario…");
for (const p of partidosReales) {
  const ref = db.collection("mundial_partidos").doc(p.id);
  const payload = {
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
    seededBy: "script:seed-mundial-cuartos",
  };
  if (p.finalizado) {
    payload.golesA = p.golesA ?? 0;
    payload.golesB = p.golesB ?? 0;
    payload.resueltoEn = FieldValue.serverTimestamp();
  } else if (p.enJuego) {
    payload.golesA = p.golesA ?? 0;
    payload.golesB = p.golesB ?? 0;
  }
  batch.set(ref, payload, { merge: true });
}

await batch.commit();

await db.collection("system_logs").add({
  usuarioId: "script:seed-mundial-cuartos",
  usuario: "cli",
  accion:
    `sembró ${partidosReales.length} partidos (cuartos+semis+3ro+final) en mundial_partidos` +
    (legacyPartidosBorrados ? ` (limpió ${legacyPartidosBorrados} legacy + ${legacyPronosticosBorrados} pronósticos huérfanos)` : ""),
  fecha: new Date().toISOString(),
  tipo: "MUNDIAL_SEED",
});

console.log("");
console.log("──────────── RESUMEN ────────────");
console.log(`  Partidos sembrados        : ${partidosReales.length}`);
console.log(`  Legacy partidos borrados  : ${legacyPartidosBorrados}`);
console.log(`  Pronósticos huérfanos     : ${legacyPronosticosBorrados}`);
console.log("─────────────────────────────────");
console.log("IDs:", partidosReales.map((p) => p.id).join(", "));
process.exit(0);
