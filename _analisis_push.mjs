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
const snap = await db.collection("usuarios").get();

let conToken = 0, sinToken = 0, baneados = 0;
const porRol = {};
const sinTokenDetalle = [];

for (const doc of snap.docs) {
  const d = doc.data();
  const rol = d.rol || "socio";
  porRol[rol] = (porRol[rol] || 0) + 1;
  if (d.baneado) { baneados++; continue; }
  if (d.fcmToken) {
    conToken++;
  } else {
    sinToken++;
    sinTokenDetalle.push(d.correo || d.email || doc.id);
  }
}

console.log("\n📊 ANÁLISIS DE PUSH NOTIFICATIONS");
console.log("══════════════════════════════════════");
console.log(`Total usuarios:                ${snap.size}`);
console.log(`Baneados (excluidos):          ${baneados}`);
console.log(`✅ Con FCM token (reciben push): ${conToken}`);
console.log(`❌ Sin FCM token (no reciben):  ${sinToken}`);
console.log(`\n📱 Por rol:`);
for (const [rol, count] of Object.entries(porRol).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${rol}: ${count}`);
}
const total = conToken + sinToken;
console.log(`\n📈 Cobertura push: ${total > 0 ? Math.round(conToken / total * 100) : 0}%`);

if (sinTokenDetalle.length > 0 && sinTokenDetalle.length <= 20) {
  console.log(`\n👥 Usuarios sin token:`);
  sinTokenDetalle.forEach(e => console.log(`   - ${e}`));
}

process.exit(0);
