/**
 * SOLO LECTURA — lista todos los entrepreneur_profiles y verifica cuáles de
 * los comercios buscados ya están registrados. No escribe nada.
 *   node _buscar_comercios.mjs
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

initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();

const BUSCADOS = ["Fika", "Master Brod", "Pomarus", "Moviclean", "Antojitos de la Nutri", "El Refugio"];
const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const snap = await db.collection("entrepreneur_profiles").get();
console.log(`\n📋 Total entrepreneur_profiles: ${snap.size}\n══════════════════════════════════════════════════`);

const todos = [];
snap.forEach((d) => {
  const x = d.data();
  const nombre = x.nombreTienda || x.nombre || x.storeName || x.businessName || "(sin nombre)";
  todos.push({ id: d.id, nombre, categoria: x.categoria || x.category || "?", oculto: x.isHiddenFromFeed === true });
});
todos.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
todos.forEach((t) => console.log(`  • ${t.nombre}  [${t.categoria}]${t.oculto ? "  (OCULTO)" : ""}  — id:${t.id}`));

console.log(`\n🔎 Verificación de comercios buscados\n══════════════════════════════════════════════════`);
for (const b of BUSCADOS) {
  const nb = norm(b);
  const tokens = nb.split(/\s+/).filter((w) => w.length > 2 && !["del", "los", "las", "the"].includes(w));
  const hit = todos.find((t) => {
    const nt = norm(t.nombre);
    return nt.includes(nb) || nb.includes(nt) || tokens.some((tok) => nt.includes(tok));
  });
  console.log(`  ${hit ? "✅" : "❌"} ${b}${hit ? `  →  "${hit.nombre}" (id:${hit.id})${hit.oculto ? " [OCULTO]" : ""}` : "  →  NO encontrado"}`);
}
console.log("");
process.exit(0);
