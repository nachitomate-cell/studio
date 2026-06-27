/**
 * Migra una tienda (entrepreneur_profiles) creada a mano con un slug
 * hacia el UID del emprendedor dueño, para que pueda editarla desde /tienda y /vendedor.
 * Opcionalmente la publica (isHiddenFromFeed = false).
 *
 * Uso:
 *   Dry-run:   node _migrar_tienda.mjs --email=correo@x.com --doc=slug-tienda
 *   Aplicar:   node _migrar_tienda.mjs --email=correo@x.com --doc=slug-tienda --apply
 *   + publicar:node _migrar_tienda.mjs --email=correo@x.com --doc=slug-tienda --publica --apply
 *   Solo publicar (ya migrada): node _migrar_tienda.mjs --email=correo@x.com --publica --apply
 *
 * Flags:
 *   --email=   (obligatorio) correo del emprendedor dueño, debe existir en 'usuarios'
 *   --doc=     (opcional) ID/slug del documento origen a migrar. Si se omite, solo publica.
 *   --publica  fuerza isHiddenFromFeed = false en el documento destino
 *   --apply    ejecuta los cambios (sin esta flag es DRY-RUN)
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const env = {};
const envContent = readFileSync(resolve(__dirname, ".env.local"), "utf8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n");
initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = getFirestore();

// --- Parseo de argumentos ---
const arg = (name) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=").slice(1).join("=") : null;
};
const has = (name) => process.argv.includes(`--${name}`);

const TARGET_EMAIL = arg("email");
const OLD_DOC_ID = arg("doc");          // opcional
const PUBLICAR = has("publica");
const DRY_RUN = !has("apply");

if (!TARGET_EMAIL) {
  console.log("❌ Falta --email=correo@x.com");
  process.exit(1);
}

console.log(`\n🔧 MIGRAR/PUBLICAR TIENDA  ${DRY_RUN ? "(DRY-RUN, no escribe)" : "(APLICANDO CAMBIOS)"}`);
console.log("══════════════════════════════════════════════════");

// 1) Encontrar UID del emprendedor por correo (case-insensitive)
const usuariosSnap = await db.collection("usuarios").get();
let owner = null;
for (const doc of usuariosSnap.docs) {
  const d = doc.data();
  const correo = (d.correo || d.email || "").trim().toLowerCase();
  if (correo === TARGET_EMAIL.toLowerCase()) {
    owner = { uid: doc.id, ...d };
    break;
  }
}
if (!owner) {
  console.log(`❌ No se encontró un usuario con correo ${TARGET_EMAIL} en 'usuarios'.`);
  process.exit(1);
}
console.log(`\n👤 Dueño: ${owner.nombre || "(sin nombre)"} | UID ${owner.uid} | rol ${owner.rol}`);
if (owner.rol !== "emprendedor") {
  console.log(`⚠️  Ojo: su rol es "${owner.rol}", no "emprendedor". No podrá acceder a /vendedor hasta corregirlo.`);
}

const newRef = db.collection("entrepreneur_profiles").doc(owner.uid);
const newSnap = await newRef.get();

// ── CASO A: migrar desde un doc origen ──────────────────────────────
if (OLD_DOC_ID) {
  const oldRef = db.collection("entrepreneur_profiles").doc(OLD_DOC_ID);
  const oldSnap = await oldRef.get();
  if (!oldSnap.exists) {
    console.log(`\n❌ No existe entrepreneur_profiles/${OLD_DOC_ID}. Nada que migrar.`);
    process.exit(1);
  }
  if (newSnap.exists) {
    console.log(`\n🛑 Ya existe entrepreneur_profiles/${owner.uid}. No se sobrescribe. Revisa manualmente.`);
    process.exit(1);
  }
  const oldData = oldSnap.data();
  const newData = { ...oldData, id: owner.uid, userId: owner.uid, updatedAt: new Date().toISOString() };
  if (PUBLICAR) newData.isHiddenFromFeed = false;

  console.log(`\n🏪 Origen: entrepreneur_profiles/${OLD_DOC_ID} ("${oldData.businessName || oldData.nombre}")`);
  console.log(`📋 PLAN:`);
  console.log(`   1. Crear  entrepreneur_profiles/${owner.uid} (copia, id/userId = UID)`);
  if (PUBLICAR) console.log(`      → isHiddenFromFeed = false (pública)`);
  console.log(`   2. Borrar entrepreneur_profiles/${OLD_DOC_ID}`);
  console.log(`   3. Set    usuarios/${owner.uid}.nombreTienda`);

  if (DRY_RUN) {
    console.log(`\n✅ DRY-RUN. Para aplicar añade --apply\n`);
    process.exit(0);
  }
  await newRef.set(newData);
  console.log(`\n✅ Creado entrepreneur_profiles/${owner.uid}`);
  await oldRef.delete();
  console.log(`✅ Borrado entrepreneur_profiles/${OLD_DOC_ID}`);
  await db.collection("usuarios").doc(owner.uid).set(
    { nombreTienda: newData.businessName || newData.nombre || "" }, { merge: true }
  );
  console.log(`✅ Actualizado usuarios/${owner.uid}.nombreTienda`);
  console.log(`\n🎉 Listo. El emprendedor ya puede editar su tienda desde /tienda y /vendedor.\n`);
  process.exit(0);
}

// ── CASO B: solo publicar/ajustar la tienda ya migrada ──────────────
if (!newSnap.exists) {
  console.log(`\n❌ No existe entrepreneur_profiles/${owner.uid}. Migra primero con --doc=slug.`);
  process.exit(1);
}
const data = newSnap.data();
console.log(`\n🏪 Tienda: "${data.businessName || data.nombre}" (entrepreneur_profiles/${owner.uid})`);
console.log(`   isHiddenFromFeed actual: ${data.isHiddenFromFeed === true}`);
if (!PUBLICAR) {
  console.log(`\nℹ️  Nada que hacer. Añade --publica para hacerla visible en el feed.\n`);
  process.exit(0);
}
console.log(`📋 PLAN: set isHiddenFromFeed = false  (hacerla pública)`);
if (DRY_RUN) {
  console.log(`\n✅ DRY-RUN. Para aplicar añade --apply\n`);
  process.exit(0);
}
await newRef.set({ isHiddenFromFeed: false, updatedAt: new Date().toISOString() }, { merge: true });
console.log(`\n✅ Tienda publicada (isHiddenFromFeed = false).\n`);
process.exit(0);
