import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCGwNEBNmyrOl1mrpZhGNEktneNtxYgxj0",
  authDomain: "studio-7914495232-557f1.firebaseapp.com",
  projectId: "studio-7914495232-557f1",
  storageBucket: "studio-7914495232-557f1.firebasestorage.app",
  messagingSenderId: "120681935080",
  appId: "1:120681935080:web:d41757280ca888b46bd95d"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// IndexedDB puede fallar en modo privado (Safari), cuota llena o storage corrupto.
// Si no está disponible, usamos memoria para evitar errores de caché en el registro.
const _idbAvailable = typeof window !== 'undefined' && Boolean(window.indexedDB);
const db = initializeFirestore(app, {
  localCache: _idbAvailable
    ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    : memoryLocalCache(),
});
const storage = getStorage(app);

// ── Emuladores (solo en ambiente de pruebas) ────────────────────────────────
// El servidor inyecta window.__USE_EMULATORS__ en el <head> del layout (lee la
// variable en runtime; ver layout.tsx). Es robusto sin importar el bundler:
// no depende del inlining de NEXT_PUBLIC_* (que Turbopack no garantiza).
// En producción el flag es false, así que NUNCA se conecta a emuladores.
// El flag global evita reconectar en Fast Refresh (HMR) — lanzaría error.
if (
  typeof window !== "undefined" &&
  (window as any).__USE_EMULATORS__ === true &&
  !(globalThis as any).__EMULATORS_CONNECTED__
) {
  (globalThis as any).__EMULATORS_CONNECTED__ = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  console.info("🧪 Firebase conectado a EMULADORES locales (auth:9099 firestore:8080 storage:9199)");
}

// Initialize Analytics conditionally (only in browser)
let analytics: any;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, db, storage, analytics };

