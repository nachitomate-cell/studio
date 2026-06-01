/**
 * Singleton de Firebase Admin SDK.
 *
 * Importa `adminAuth` y `adminDb` desde este módulo en cualquier Route Handler
 * o Server Action — nunca llames a initializeApp() directamente en otro archivo.
 *
 * Variables de entorno requeridas (no públicas, solo servidor):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY   ← los \n literales se corrigen aquí automáticamente
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

function createAdminApp(): App {
  // Evita re-inicialización en Fast Refresh (dev) y en Workers concurrentes
  if (getApps().length > 0) return getApps()[0];

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();

  // La clave privada puede llegar en tres formatos distintos según el entorno:
  //   1. PEM con saltos de línea reales (desarrollo local con .env.local)
  //   2. PEM con literales "\\n" (copia directa del JSON de servicio)
  //   3. Base64 del PEM completo (Vercel dashboard — codifica automáticamente)
  // Esta función normaliza los tres casos al PEM correcto.
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";
  let privateKey: string;
  if (!rawKey.includes("-----BEGIN")) {
    // Caso 3: valor Base64 — decodificar primero
    privateKey = Buffer.from(rawKey, "base64").toString("utf-8");
  } else {
    // Casos 1 y 2: reemplazar literales \\n por saltos de línea reales
    privateKey = rawKey.replace(/\\n/g, "\n");
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin: faltan variables de entorno. " +
      "Verifica FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL y FIREBASE_ADMIN_PRIVATE_KEY."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

function getAdminApp(): App {
  return createAdminApp();
}

// Lazy proxies: createAdminApp() is never called at module load time (build-safe).
// Methods are bound to the real instance so `this` is correct in all call sites.
function lazyProxy<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_, prop) {
      const instance = factory();
      const value = (instance as any)[prop];
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}

export const adminAuth:      Auth      = lazyProxy(() => getAuth(getAdminApp()));
export const adminDb:        Firestore = lazyProxy(() => getFirestore(getAdminApp()));
export const adminMessaging: Messaging = lazyProxy(() => getMessaging(getAdminApp()));
