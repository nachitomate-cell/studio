/**
 * Seed: crea/actualiza el perfil Premium de Ruta de Curauma en entrepreneur_profiles.
 * Uso: node scripts/seed-ruta-curauma.mjs
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

// ── Datos de Ruta de Curauma ──────────────────────────────────────────────────
const RUTA_ID = "ruta-curauma-oficial";

const rutaData = {
  // Identificación
  businessName: "Ruta de Curauma",
  nombre:       "Ruta de Curauma",
  category:     "PORTAL",
  rubro:        "PORTAL",

  // Descripción
  description: "El portal oficial de Curauma. Descubre todos los beneficios, comercios y servicios de la zona en un solo lugar.",
  descripcion: "El portal oficial de Curauma. Descubre todos los beneficios, comercios y servicios de la zona en un solo lugar.",

  // Imágenes Premium (rutas locales en /public)
  imagenTarjeta: "/rutacurauma-banner.png",  // fondo del carrusel
  imagenPerfil:  "/rutacurauma.png",          // portada del detalle
  logoHeader:    "/rutacurauma.png",          // logo en tarjeta y avatar

  // Imágenes fallback para componentes estándar
  imageUrl:   "/rutacurauma-banner.png",
  imageUrls:  ["/rutacurauma-banner.png"],
  imagenUrl:  "/rutacurauma-banner.png",

  // Marca Ancla / Sponsor
  isPremium: true,
  promoText: "Conoce todos los beneficios y comercios de la zona aquí.",

  // Contacto (portal — sin WhatsApp directo)
  whatsapp:        "",
  instagram:       "",
  ubicacionTienda: "Curauma, Valparaíso",
  operatingHours:  "Disponible las 24 horas",

  // Medios de pago (N/A para portal)
  mediosPago: [],

  // Meta
  active:    true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Escribir en Firestore ─────────────────────────────────────────────────────
try {
  await db.collection("entrepreneur_profiles").doc(RUTA_ID).set(rutaData, { merge: true });
  console.log(`✅ Perfil Ruta de Curauma creado/actualizado con ID: ${RUTA_ID}`);
  console.log("   isPremium     →", rutaData.isPremium);
  console.log("   category      →", rutaData.category);
  console.log("   imagenTarjeta →", rutaData.imagenTarjeta);
  console.log("   imagenPerfil  →", rutaData.imagenPerfil);
  console.log("   logoHeader    →", rutaData.logoHeader);
  console.log("   promoText     →", rutaData.promoText);
  process.exit(0);
} catch (err) {
  console.error("❌ Error escribiendo en Firestore:", err.message);
  process.exit(1);
}
