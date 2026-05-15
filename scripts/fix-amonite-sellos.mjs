/**
 * fix-amonite-sellos.mjs
 *
 * Corrige los contadores de sellos de Amonite Joyas sumando +2
 * al mes actual y al histórico, compensando 2 sellos que fallaron.
 *
 * Uso: node scripts/fix-amonite-sellos.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

// ── Buscar y corregir ────────────────────────────────────────────────────────
const MES = new Date().toISOString().substring(0, 7); // "2026-05"
const SELLOS_A_SUMAR = 2;

const snapshot = await db.collection("usuarios")
  .where("nombreTienda", "==", "Amonite Joyas")
  .get();

let found = snapshot.docs;

// Fallback: buscar por campo nombre si no hay nombreTienda
if (found.length === 0) {
  const snap2 = await db.collection("usuarios")
    .where("nombre", "==", "Amonite Joyas")
    .get();
  found = snap2.docs;
}

if (found.length === 0) {
  console.log("⚠️  No se encontró ningún usuario con nombreTienda/nombre == 'Amonite Joyas'");
  console.log("   Prueba buscar manualmente en Firebase Console y pasa el UID como argumento.");
  process.exit(1);
}

for (const docSnap of found) {
  const data = docSnap.data();
  const mesActual = data.sellosEntregadosMensual?.[MES] ?? 0;
  const historico = data.sellosEntregadosHistorico ?? 0;

  console.log(`\n✅ Encontrado: ${docSnap.id}`);
  console.log(`   nombreTienda: ${data.nombreTienda || data.nombre}`);
  console.log(`   sellosEntregadosMensual[${MES}]: ${mesActual} → ${mesActual + SELLOS_A_SUMAR}`);
  console.log(`   sellosEntregadosHistorico: ${historico} → ${historico + SELLOS_A_SUMAR}`);

  await docSnap.ref.update({
    [`sellosEntregadosMensual.${MES}`]: FieldValue.increment(SELLOS_A_SUMAR),
    sellosEntregadosHistorico: FieldValue.increment(SELLOS_A_SUMAR),
  });

  console.log("   ✔ Actualizado correctamente.");
}

console.log("\nListo. El ranking en /director se actualizará en tiempo real.");
