/**
 * Script temporal para enviar notificación de prueba.
 * Ejecutar una sola vez y borrar.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Leer .env.local manualmente
const env = {};
const envContent = readFileSync(resolve(__dirname, ".env.local"), "utf8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
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
const adminAuth = getAuth();

const TARGET_EMAIL = "ignaciomatelunaenf@gmail.com";

try {
  // Obtener UID del usuario destino
  const user = await adminAuth.getUserByEmail(TARGET_EMAIL);
  const uid = user.uid;
  console.log(`UID encontrado: ${uid}`);

  // Crear broadcast de prueba con tipo promo para mostrar el banner tienda.jpeg
  const ref = await db.collection("broadcast_messages").add({
    titulo: "🎉 ¡Oferta especial en Patio Curauma!",
    mensaje: "Visítanos esta semana y acumula sellos dobles en todos tus compras. ¡Te esperamos en Av. Universidad #134, local 1, Curauma!",
    destino: "usuario_especifico",
    usuarioFiltro: uid,
    tipo: "promo",
    cta: "/",
    estado: "pendiente",
    fechaCreacion: new Date().toISOString(),
  });

  console.log(`✅ Broadcast creado: ${ref.id}`);
  console.log(`   Enviando a: ${TARGET_EMAIL}`);
  console.log(`   La Cloud Function lo procesará en segundos.`);
  console.log(`   URL: https://clubpatiocurauma.synaptechspa.cl/notificacion?id=${ref.id}`);
} catch (err) {
  console.error("❌ Error:", err.message);
}

process.exit(0);
