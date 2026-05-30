/**
 * Seed: crea/actualiza el perfil Premium Dark de Omega Studio en entrepreneur_profiles.
 * Uso: node scripts/seed-omega-studio.mjs
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

// ── Datos de Omega Studio ─────────────────────────────────────────────────────
const OMEGA_ID = "omega-studio";

const omegaData = {
  // Identificación
  businessName: "Omega Studio",
  nombre:       "Omega Studio",
  category:     "belleza",
  rubro:        "belleza",

  // Descripción
  description: "Omega Studio es una barbería y salón premium de primer nivel. Disfruta de la mejor atención de Viña del Mar en un ambiente de alta fidelidad, elegante y sofisticado con barberos altamente experimentados.",
  descripcion: "Omega Studio es una barbería y salón premium de primer nivel. Disfruta de la mejor atención de Viña del Mar en un ambiente de alta fidelidad, elegante y sofisticado con barberos altamente experimentados.",

  // Tema Premium Dark
  theme: "premium-dark",
  isPremium: true,
  promoText: "Reserva tu servicio hoy con lavado de cortesía y ritual de toallas calientes 💈",

  // Imágenes Premium (Unsplash high-quality dark barber shop photos)
  imagenTarjeta: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80", // carrusel inicio
  imagenPerfil:  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80", // detalle/portada
  logoHeader:    "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&q=80", // logo redondo/avatar
  imageUrl:      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80",
  imageUrls:     [
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80",
    "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80"
  ],
  imagenUrl:     "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80",

  // Contacto y Ubicación
  whatsapp:        "+56972302811",
  instagram:       "omega.studio",
  website:         "",
  ubicacionTienda: "Quinta 200, Viña del Mar, Valparaíso, Chile",
  address:         "Quinta 200, Viña del Mar, Valparaíso, Chile",
  operatingHours:  "Lun–Sáb 10:00 – 20:00",
  horario:         "Lun–Sáb 10:00 – 20:00",

  // Coordenadas aproximadas para Viña del Mar (Quinta 200)
  lat: -33.023253,
  lng: -71.552809,

  // Medios de pago
  mediosPago: ["efectivo", "debito", "transferencia"],

  // Barberos / Staff
  barbers: [
    { id: "TC", name: "Thomas Castillo", initials: "TC" },
    { id: "AM", name: "Antonio Morales", initials: "AM" },
    { id: "JB", name: "Julian Beltrán", initials: "JB" }
  ],

  // Servicios
  services: [
    {
      id: "s1",
      name: "Perfilado de cejas y/o diseño",
      duration: "5 min",
      price: 2000,
      description: "Perfilado estilizado y diseño de cejas adaptado a tu rostro."
    },
    {
      id: "s2",
      name: "Corte de Cabello",
      duration: "1 hrs",
      price: 15000,
      description: "Incluye cortesía (té, café, agua o refresco), asesoramiento, lavado de cabello y aplicación de producto premium (cera, crema o polvo)."
    },
    {
      id: "s3",
      name: "Corte de cabello + cejas",
      duration: "1 hrs",
      price: 16000,
      description: "Servicio combinado de corte de cabello y perfilado de cejas."
    },
    {
      id: "s4",
      name: "Corte de cabello + limpieza facial",
      duration: "1 hrs 20 min",
      price: 25000,
      description: "Servicio premium de corte combinado con una revitalizante limpieza facial profunda."
    },
    {
      id: "s5",
      name: "Barba tradicional",
      duration: "40 min",
      price: 13000,
      description: "Rebajar y perfilar con ritual de toallas calientes mas vapor, logrando detalles impecables con afeitado tradicional a navaja."
    },
    {
      id: "s6",
      name: "Barba expréss",
      duration: "30 min",
      price: 10000,
      description: "Servicio rápido para rebajar, perfilar y/o rasurar el vello facial utilizando únicamente máquina."
    },
    {
      id: "s7",
      name: "Limpieza facial",
      duration: "40 min",
      price: 13000,
      description: "Exfoliación y masajes, vaporización profunda para abrir poros, mascarilla dorada purificante para puntos negros e hidratación con crema restauradora de la piel."
    },
    {
      id: "s8",
      name: "Corte de cabello + barba tradicional",
      duration: "1 hrs 20 min",
      price: 25000,
      description: "Promoción especial que combina el corte de cabello completo con el afeitado y toallas de la barba tradicional."
    },
    {
      id: "s9",
      name: "Corte de cabello + Barba express",
      duration: "1 hrs 10 min",
      price: 22000,
      description: "Excelente promoción de corte de cabello acompañado del perfilado y rasurado express de barba."
    },
    {
      id: "s10",
      name: "Servicio full",
      duration: "1 hrs 30 min",
      price: 35000,
      description: "La experiencia VIP total de Omega Studio: combina el Corte de Cabello, la Barba Tradicional y la Limpieza Facial en una sola sesión premium."
    },
    {
      id: "s11",
      name: "Ondulación permanente",
      duration: "4 hrs",
      price: 60000,
      description: "Servicio especializado de ondulación permanente para caballeros realizado por expertos."
    },
    {
      id: "s12",
      name: "Visos color",
      duration: "5 hrs",
      price: 65000,
      description: "Proceso premium de coloración con visos/reflejos profesionales adaptados a tu estilo."
    },
    {
      id: "s13",
      name: "Color global",
      duration: "5 hrs",
      price: 75000,
      description: "Cambio o matización total de color de cabello con tinturas de la más alta gama."
    }
  ],

  // Meta
  active:    true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Escribir en Firestore ─────────────────────────────────────────────────────
try {
  await db.collection("entrepreneur_profiles").doc(OMEGA_ID).set(omegaData, { merge: true });
  console.log(`✅ Perfil Omega Studio creado/actualizado con ID: ${OMEGA_ID}`);
  console.log("   isPremium  →", omegaData.isPremium);
  console.log("   theme      →", omegaData.theme);
  console.log("   barbers    →", omegaData.barbers.length);
  console.log("   services   →", omegaData.services.length);
  process.exit(0);
} catch (err) {
  console.error("❌ Error escribiendo en Firestore:", err.message);
  process.exit(1);
}
