/**
 * Seed del ambiente de pruebas (emuladores Firebase).
 *
 * Crea usuarios de Auth (con contraseña conocida) + sus documentos de Firestore
 * para probar el flujo completo de canje de sellos:
 *   - 1 moderador/admin
 *   - 1 emprendedor (flujo handshake: vendedor confirma)
 *   - 1 comercio asociado (flujo auto-servicio con boleta)
 *   - 2 clientes con sellos acumulados
 *   - premios (normal + sorteo)
 *
 * Ejecutar con: npm run seed:emu   (requiere el emulador corriendo: npm run emulators)
 *
 * NO toca producción: solo corre si FIRESTORE_EMULATOR_HOST está definido.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ── Guard de seguridad: jamás correr contra producción ───────────────────────
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("❌ ABORTADO: este seed solo corre contra emuladores.");
  console.error("   Usa `npm run seed:emu` (define FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST).");
  process.exit(1);
}

const PROJECT_ID = "studio-7914495232-557f1";
initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

const PASSWORD = "Test1234";
const now = new Date().toISOString();

// ── Definición de usuarios de prueba ─────────────────────────────────────────
const USERS = [
  {
    uid: "u_admin",
    email: "ignaciiio.mate@gmail.com",
    displayName: "Admin Pruebas",
    usuario: { rol: "moderador", nombre: "Admin Pruebas", comprasRealizadas: 0, puntos: 0, baneado: false },
  },
  {
    uid: "u_empre1",
    email: "empre1@test.cl",
    displayName: "Joyas Ana",
    usuario: { rol: "emprendedor", nombre: "Joyas Ana", comprasRealizadas: 0, puntos: 0, baneado: false, sellosEntregadosHistorico: 0 },
    profile: { businessName: "Joyas Ana", nombre: "Joyas Ana", category: "artesania", tipo: "emprendedor", activo: true },
  },
  {
    uid: "u_asoc1",
    email: "asoc1@test.cl",
    displayName: "Café Fika",
    usuario: { rol: "emprendedor", nombre: "Café Fika", comprasRealizadas: 0, puntos: 0, baneado: false, sellosEntregadosHistorico: 0 },
    profile: { businessName: "Café Fika", nombre: "Café Fika", category: "cafeteria", tipo: "asociado", activo: true },
  },
  {
    uid: "u_cliente1",
    email: "cliente1@test.cl",
    displayName: "Cliente Uno",
    usuario: { rol: "cliente", nombre: "Cliente Uno", comprasRealizadas: 4, puntos: 200, sellosHistoricos: 4, baneado: false, recompensaDisponible: false },
  },
  {
    uid: "u_cliente2",
    email: "cliente2@test.cl",
    displayName: "Cliente Dos",
    usuario: { rol: "cliente", nombre: "Cliente Dos", comprasRealizadas: 9, puntos: 450, sellosHistoricos: 9, baneado: false, recompensaDisponible: true },
  },
];

const PREMIOS = [
  { id: "p_cafe", nombre: "Café Gratis", icono: "☕", sellosRequeridos: 5, vendorId: "u_asoc1", vendorNombre: "Café Fika", stock: 10, esSorteo: false, activo: true },
  { id: "p_joya", nombre: "Dije de Plata", icono: "💍", sellosRequeridos: 5, vendorId: "u_empre1", vendorNombre: "Joyas Ana", stock: 3, esSorteo: false, activo: true },
  { id: "p_sorteo", nombre: "Sorteo del Mes", icono: "🎟️", sellosRequeridos: 3, vendorId: "u_asoc1", vendorNombre: "Café Fika", esSorteo: true, activo: true },
];

async function upsertAuthUser(u) {
  try {
    await auth.deleteUser(u.uid);
  } catch { /* no existía */ }
  await auth.createUser({
    uid: u.uid,
    email: u.email,
    emailVerified: true,
    password: PASSWORD,
    displayName: u.displayName,
  });
}

async function main() {
  console.log(`\n🌱 Sembrando ambiente de pruebas en el emulador (${PROJECT_ID})...\n`);

  for (const u of USERS) {
    await upsertAuthUser(u);
    await db.collection("usuarios").doc(u.uid).set({
      correo: u.email,
      createdAt: now,
      ...u.usuario,
    });
    if (u.profile) {
      await db.collection("entrepreneur_profiles").doc(u.uid).set(u.profile);
    }
    console.log(`  ✅ ${u.email}  (${u.usuario.rol}${u.profile ? " · " + u.profile.tipo : ""})`);
  }

  for (const p of PREMIOS) {
    const { id, ...data } = p;
    await db.collection("premios").doc(id).set({ ...data, creadoEn: FieldValue.serverTimestamp() });
    console.log(`  🎁 premio "${p.nombre}" (${p.sellosRequeridos} sellos${p.esSorteo ? " · sorteo" : ""})`);
  }

  console.log(`\n✅ Listo. Credenciales (password para todos: ${PASSWORD}):`);
  console.log("   • Moderador/Admin: ignaciiio.mate@gmail.com");
  console.log("   • Emprendedor:     empre1@test.cl   (uid u_empre1, QR: /scan?ref=u_empre1)");
  console.log("   • Comercio Asoc.:  asoc1@test.cl    (uid u_asoc1,  QR: /scan?ref=u_asoc1)");
  console.log("   • Cliente 1:       cliente1@test.cl (4 sellos)");
  console.log("   • Cliente 2:       cliente2@test.cl (9 sellos)\n");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Seed falló:", e);
  process.exit(1);
});
