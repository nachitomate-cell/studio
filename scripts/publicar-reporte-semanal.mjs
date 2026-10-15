/**
 * publicar-reporte-semanal.mjs — archiva el reporte semanal del Club para que la
 * administración del Patio lo descargue desde /moderador/reportes.
 *
 * Sube cada archivo a Storage en `reportes_semanales/<desde>_<hasta>/<nombre>`
 * (sin download token: esa carpeta cae en el deny-all de storage.rules y solo se
 * abre con la signed URL de /api/admin/reportes/url) y hace upsert del doc
 * `reportes_semanales/<desde>_<hasta>`.
 *
 * Idempotente: si el reporte ya existe, los archivos con el mismo nombre se
 * reemplazan (mismo path en Storage, misma entrada en el doc) y los demás se
 * conservan. Correrlo dos veces con lo mismo deja todo igual.
 *
 * Uso:
 *   node scripts/publicar-reporte-semanal.mjs <desde> <hasta> "<titulo>" <archivo1> [archivo2 ...]
 *
 * Ejemplo:
 *   node scripts/publicar-reporte-semanal.mjs 2026-10-05 2026-10-11 "Semana del 5 al 11 de octubre" \
 *     "C:/Users/.../Reporte semanal Club Patio.pdf" "C:/Users/.../Base socios Club Patio - 12-10-2026.xlsx"
 *
 * Solo acepta .pdf y .xlsx.
 */

import { readFileSync, statSync } from "fs";
import { resolve, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// ── Argumentos (se validan antes de tocar credenciales) ──────────────────────
const USO =
  'Uso: node scripts/publicar-reporte-semanal.mjs <desde AAAA-MM-DD> <hasta AAAA-MM-DD> "<titulo>" <archivo1> [archivo2 ...]';

const [desde, hasta, tituloArg, ...rutas] = process.argv.slice(2);

function fechaValida(f) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f ?? "")) return false;
  const [a, m, d] = f.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1, d));
  return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
}

function salir(msg) {
  console.error(`❌ ${msg}`);
  console.error(USO);
  process.exit(1);
}

if (!fechaValida(desde)) salir(`"desde" no es una fecha AAAA-MM-DD válida: ${desde ?? "(falta)"}`);
if (!fechaValida(hasta)) salir(`"hasta" no es una fecha AAAA-MM-DD válida: ${hasta ?? "(falta)"}`);
if (desde > hasta) salir(`"desde" (${desde}) es posterior a "hasta" (${hasta})`);
const titulo = String(tituloArg ?? "").trim();
if (!titulo) salir("Falta el título");
if (!rutas.length) salir("Falta al menos un archivo");

const TIPOS = {
  ".pdf": { tipo: "pdf", contentType: "application/pdf" },
  ".xlsx": {
    tipo: "xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

const id = `${desde}_${hasta}`;
const carpeta = `reportes_semanales/${id}`;

const locales = rutas.map((ruta) => {
  const abs = resolve(ruta);
  let st;
  try {
    st = statSync(abs);
  } catch {
    salir(`No existe el archivo: ${abs}`);
  }
  if (!st.isFile()) salir(`No es un archivo: ${abs}`);
  if (st.size === 0) salir(`El archivo está vacío: ${abs}`);
  const ext = extname(abs).toLowerCase();
  const t = TIPOS[ext];
  if (!t) salir(`Solo se aceptan .pdf y .xlsx: ${abs}`);
  // NFC: el mismo nombre escrito en Mac y en Windows no debe quedar como dos archivos.
  const nombre = basename(abs).normalize("NFC");
  return { abs, nombre, tamanoBytes: st.size, ...t };
});

const nombresRepetidos = locales
  .map((l) => l.nombre)
  .filter((n, i, arr) => arr.indexOf(n) !== i);
if (nombresRepetidos.length) salir(`Hay archivos con el mismo nombre: ${[...new Set(nombresRepetidos)].join(", ")}`);

// ── Cargar .env.local ────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(resolve(__dir, "../.env.local"), "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
} catch {
  console.error("❌ No se encontró .env.local");
  process.exit(1);
}

// ── Firebase Admin ───────────────────────────────────────────────────────────
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";
const privateKey = rawKey.includes("-----BEGIN")
  ? rawKey.replace(/\\n/g, "\n")
  : Buffer.from(rawKey, "base64").toString("utf-8");

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Faltan credenciales Firebase Admin en .env.local");
  process.exit(1);
}

// Mismo bucket que src/lib/firebaseAdmin.ts (STORAGE_BUCKET).
const storageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
  "studio-7914495232-557f1.firebasestorage.app";

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket });
}
const db = getFirestore();
const bucket = getStorage().bucket();

// ── Subir ────────────────────────────────────────────────────────────────────
console.log(`Reporte ${id} · "${titulo}"`);
console.log(`Bucket: ${bucket.name}\n`);

const subidos = [];
for (const l of locales) {
  const path = `${carpeta}/${l.nombre}`;
  // bucket.upload del Admin SDK no agrega firebaseStorageDownloadTokens: el
  // archivo queda privado. No agregarlo a mano.
  await bucket.upload(l.abs, {
    destination: path,
    resumable: false,
    metadata: { contentType: l.contentType, cacheControl: "private, max-age=0" },
  });
  subidos.push({ tipo: l.tipo, nombre: l.nombre, path, tamanoBytes: l.tamanoBytes });
  console.log(`  ✓ ${l.tipo.toUpperCase().padEnd(4)} ${path} (${(l.tamanoBytes / 1024).toFixed(0)} KB)`);
}

// ── Upsert del doc ───────────────────────────────────────────────────────────
const ref = db.collection("reportes_semanales").doc(id);
const ahora = new Date().toISOString();
const subidoPor = process.env.REPORTE_SUBIDO_POR?.trim() || "script:publicar-reporte-semanal";

const resultado = await db.runTransaction(async (tx) => {
  const snap = await tx.get(ref);
  const previo = snap.exists ? snap.data() : null;
  const anteriores = Array.isArray(previo?.archivos) ? previo.archivos : [];

  // Se conservan los archivos de antes que no vienen en esta corrida.
  const nuevosNombres = new Set(subidos.map((s) => s.nombre));
  const conservados = anteriores.filter((a) => !nuevosNombres.has(a?.nombre));

  // El PDF primero: es lo que se busca al abrir el reporte.
  const orden = { pdf: 0, xlsx: 1 };
  const archivos = [...conservados, ...subidos].sort(
    (a, b) =>
      (orden[a.tipo] ?? 9) - (orden[b.tipo] ?? 9) || String(a.nombre).localeCompare(String(b.nombre)),
  );

  tx.set(ref, {
    titulo,
    desde,
    hasta,
    archivos,
    creadoEn: previo?.creadoEn ?? ahora,
    actualizadoEn: ahora,
    subidoPor,
  });

  return { existia: !!previo, conservados: conservados.length, total: archivos.length };
});

console.log(
  `\n${resultado.existia ? "Actualizado" : "Creado"} reportes_semanales/${id}: ` +
    `${resultado.total} archivo(s) (${subidos.length} subido(s), ${resultado.conservados} conservado(s)).`,
);
console.log("Ya se puede descargar desde /moderador/reportes.");
process.exit(0);
