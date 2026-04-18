/**
 * Seed: crea/actualiza el perfil Premium de Fronza en entrepreneur_profiles.
 * Uso: node scripts/seed-fronza.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── Cargar .env.local manualmente ────────────────────────────────────────────
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
  console.error("No se encontró .env.local — asegúrate de correr desde la raíz del proyecto.");
  process.exit(1);
}

// ── Inicializar Firebase Admin ────────────────────────────────────────────────
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
  console.error("Faltan variables FIREBASE_ADMIN_* en .env.local");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

// ── Datos de Fronza ───────────────────────────────────────────────────────────
const FRONZA_ID = "fronza-premium";

const fronzaData = {
  // Identificación
  businessName: "Fronza",
  nombre:       "Fronza",
  category:     "gourmet",
  rubro:        "gourmet",

  // Descripción
  description: "La mejor experiencia gourmet del Patio Curauma. Productos artesanales, vinos de autor y charcutería fina seleccionada.",
  descripcion: "La mejor experiencia gourmet del Patio Curauma. Productos artesanales, vinos de autor y charcutería fina seleccionada.",

  // Imágenes Premium (rutas locales en /public)
  imagenTarjeta: "/logofronza1.png",   // carrusel de inicio
  imagenPerfil:  "/logofronza2.jpg",   // portada del detalle
  logoHeader:    "/logofronza3.png",   // logo/avatar

  // Imágenes fallback para componentes estándar
  imageUrl:   "/logofronza1.png",
  imageUrls:  ["/logofronza1.png"],
  imagenUrl:  "/logofronza1.png",

  // Marca Ancla
  isPremium: true,
  promoText: "Gana doble sello en compras sobre $15.000 este mes 🍷",

  // Contacto
  whatsapp:        "+56999690322",
  instagram:       "fronza.gourmet",
  ubicacionTienda: "Pasillo Principal, Local 1",
  operatingHours:  "Lun–Dom 10:00 – 20:00",

  // Medios de pago
  mediosPago: ["efectivo", "debito", "transferencia"],

  // Meta
  active:    true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Escribir en Firestore ─────────────────────────────────────────────────────
try {
  await db.collection("entrepreneur_profiles").doc(FRONZA_ID).set(fronzaData, { merge: true });
  console.log(`✅ Perfil Fronza creado/actualizado con ID: ${FRONZA_ID}`);
  console.log("   isPremium  →", fronzaData.isPremium);
  console.log("   imagenTarjeta →", fronzaData.imagenTarjeta);
  console.log("   imagenPerfil  →", fronzaData.imagenPerfil);
  console.log("   logoHeader    →", fronzaData.logoHeader);
  process.exit(0);
} catch (err) {
  console.error("❌ Error escribiendo en Firestore:", err.message);
  process.exit(1);
}
