/**
 * sembrar-categorias.mjs
 *
 * Siembra las 8 categorías base del directorio en la colección
 * `categorias_negocios` de Firestore. Idempotente: solo crea las que faltan
 * (nunca sobrescribe una categoría existente que el director ya haya editado).
 *
 * Uso: node scripts/sembrar-categorias.mjs
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
  console.error("❌ No se encontró .env.local");
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

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Faltan credenciales Firebase Admin en .env.local");
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();

// ── Categorías base (espejo de CATEGORIES_BASE en src/lib/data.ts) ───────────
const CATEGORIAS_BASE = [
  { id: "deco",      nombre: "Deco & Hogar",           icono: "🏠", orden: 1 },
  { id: "gourmet",   nombre: "Gourmet & Licores",      icono: "🍽️", orden: 2 },
  { id: "joyeria",   nombre: "Joyería & Accesorios",   icono: "💎", orden: 3 },
  { id: "belleza",   nombre: "Belleza",                icono: "✨", orden: 4 },
  { id: "artesania", nombre: "Artesanías",             icono: "🎨", orden: 5 },
  { id: "papeleria", nombre: "Papelería & Juguetería", icono: "📚", orden: 6 },
  { id: "infantil",  nombre: "Infantil",               icono: "👶", orden: 7 },
  { id: "vestuario", nombre: "Vestuario",              icono: "👕", orden: 8 },
];

// ── Ejecución ────────────────────────────────────────────────────────────────
(async () => {
  console.log("→ Verificando qué categorías ya existen en Firestore…\n");

  const col = db.collection("categorias_negocios");
  const snap = await col.get();
  const existentes = new Set(snap.docs.map(d => d.id));

  const faltantes = CATEGORIAS_BASE.filter(c => !existentes.has(c.id));
  const yaEstaban = CATEGORIAS_BASE.filter(c => existentes.has(c.id));

  if (yaEstaban.length > 0) {
    console.log("○ Ya existentes (no se tocan):");
    for (const c of yaEstaban) console.log(`  ${c.icono}  ${c.id} → ${c.nombre}`);
    console.log("");
  }

  if (faltantes.length === 0) {
    console.log("✓ No hay nada que sembrar. Todas las categorías base ya están en Firestore.");
    process.exit(0);
  }

  console.log(`→ Sembrando ${faltantes.length} categoría(s) faltante(s)…\n`);

  await Promise.all(
    faltantes.map(cat =>
      col.doc(cat.id).set({
        nombre: cat.nombre,
        icono: cat.icono,
        orden: cat.orden,
        creadoEn: FieldValue.serverTimestamp(),
        creadoPor: "script:sembrar-categorias",
        sembrada: true,
      })
    )
  );

  for (const c of faltantes) console.log(`  ✓ ${c.icono}  ${c.id} → ${c.nombre}`);
  console.log(`\n✓ Listo. Se sembraron ${faltantes.length} categoría(s) base.`);
  process.exit(0);
})().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
