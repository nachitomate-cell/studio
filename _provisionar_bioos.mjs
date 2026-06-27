/**
 * BACKFILL — crea el Link in Bio (bioo.cl) para TODOS los emprendedores con
 * perfil que aún no lo tengan. Idempotente (bioo deduplica por email y se omite
 * a quien ya tiene biooHandle). La propiedad se reserva por EMAIL del emprendedor.
 *
 *   node _provisionar_bioos.mjs
 *
 * Requiere en .env.local: FIREBASE_ADMIN_*, BIOO_PROVISION_URL, BIOO_PROVISION_SECRET
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(__dirname, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const PROVISION_URL = env.BIOO_PROVISION_URL;
const PROVISION_SECRET = env.BIOO_PROVISION_SECRET;
if (!PROVISION_URL || !PROVISION_SECRET) {
  console.error("❌ Faltan BIOO_PROVISION_URL / BIOO_PROVISION_SECRET en .env.local");
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();
const auth = getAuth();

const snap = await db.collection("entrepreneur_profiles").get();
console.log(`\n📋 Total perfiles: ${snap.size}\n══════════════════════════════════════════════════`);

let creados = 0, yaTenian = 0, sinEmail = 0, errores = 0, sinNombre = 0;

for (const d of snap.docs) {
  const v = d.data();
  const id = d.id;
  const nombre = v.businessName || v.nombre || "";

  if (v.biooHandle) { yaTenian++; continue; }
  if (!nombre.trim() || nombre.trim() === "—") { sinNombre++; console.log(`  ⏭️  ${id} sin nombre — omitido`); continue; }

  let email = "";
  try { email = (await auth.getUser(id)).email || ""; } catch { /* sin cuenta Auth */ }
  if (!email) { sinEmail++; console.log(`  ⚠️  ${nombre} (${id}) sin email — omitido`); continue; }

  const payload = {
    name: nombre,
    email,
    description: v.description || v.promoText || "",
    avatar: v.imagenTarjeta || v.imageUrl || v.imagenPerfil || "",
    whatsapp: v.whatsapp || "",
    instagram: v.instagram || "",
    website: v.website || "",
    handle: nombre,
    plan: v.isPremium === true ? "premium" : "free",
    source: "club-patio",
  };

  try {
    const r = await fetch(PROVISION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bioo-secret": PROVISION_SECRET },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.handle) { errores++; console.log(`  ❌ ${nombre}: ${j.error || r.status}`); continue; }

    await d.ref.set({
      biooHandle: j.handle,
      biooClaimUrl: j.claimUrl,
      biooPublicUrl: j.publicUrl,
      biooProvisionedAt: new Date().toISOString(),
    }, { merge: true });

    creados++;
    console.log(`  ✅ ${nombre}  →  bioo.cl/${j.handle}  (${email})${j.already ? " [ya existía]" : ""}`);
  } catch (e) {
    errores++;
    console.log(`  ❌ ${nombre}: ${e.message}`);
  }
}

console.log(`\n══════════════════════════════════════════════════`);
console.log(`✅ Creados/vinculados: ${creados}`);
console.log(`↩️  Ya tenían handle:   ${yaTenian}`);
console.log(`⚠️  Sin email:          ${sinEmail}`);
console.log(`⏭️  Sin nombre:         ${sinNombre}`);
console.log(`❌ Errores:            ${errores}`);
process.exit(0);
