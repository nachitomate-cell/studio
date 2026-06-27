/** SOLO LECTURA — muestra la estructura completa de algunos entrepreneur_profiles. */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(__dirname, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}
initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = getFirestore();

// Un perfil vinculado a UID real (publicado) y uno con slug (Fika)
for (const id of ["fika-coffeshop", "el-refugio-coffe-house"]) {
  const d = await db.collection("entrepreneur_profiles").doc(id).get();
  console.log(`\n===== ${id} (exists:${d.exists}) =====`);
  if (d.exists) console.log(JSON.stringify(d.data(), null, 2));
}

// Muestra todas las claves vistas en la colección (unión de campos)
const snap = await db.collection("entrepreneur_profiles").get();
const keys = {};
snap.forEach((doc) => Object.entries(doc.data()).forEach(([k, v]) => { keys[k] = (keys[k] || 0) + 1; }));
console.log("\n===== CAMPOS USADOS (campo: nº de docs que lo tienen) =====");
Object.entries(keys).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k}: ${n}/${snap.size}`));

// Estructura de un doc de usuarios (para entender vinculación por correo)
const u = await db.collection("usuarios").limit(1).get();
u.forEach((doc) => { console.log("\n===== EJEMPLO usuarios (claves) =====\n", Object.keys(doc.data()).join(", ")); });
process.exit(0);
