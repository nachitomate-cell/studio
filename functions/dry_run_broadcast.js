/**
 * DRY RUN de executeBroadcast para usuario_especifico.
 * No escribe nada en Firestore ni envía push. Solo simula el filtro
 * y muestra cuántos usuarios recibirían el mensaje.
 *
 * Uso:
 *   node dry_run_broadcast.js <UID_del_destinatario>
 *
 * Ejemplo:
 *   node dry_run_broadcast.js 8gsIzHwaUWN9O6TOy8DWS5KETXM2
 */
require("dotenv").config({ path: "../.env.local" });
const admin = require("firebase-admin");

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = admin.firestore();
const usuarioFiltro = process.argv[2];

if (!usuarioFiltro) {
  console.error("Error: debes pasar el UID como argumento.");
  console.error("  node dry_run_broadcast.js <UID>");
  process.exit(1);
}

async function dryRun() {
  console.log(`\n=== DRY RUN: usuario_especifico ===`);
  console.log(`UID objetivo: ${usuarioFiltro}\n`);

  // Misma query que executeBroadcast (con el fix aplicado)
  const snap = await db.collection("usuarios").get();
  const notBanned = snap.docs.filter((d) => d.data().baneado !== true);

  console.log(`Total usuarios en Firestore:      ${snap.size}`);
  console.log(`Total usuarios no baneados:       ${notBanned.length}`);

  // Filtro usuario_especifico
  const userDoc = notBanned.find((d) => d.id === usuarioFiltro);

  if (!userDoc) {
    console.log(`\n❌ PROBLEMA: usuario ${usuarioFiltro} NO encontrado en la query.`);
    console.log(`   Esto causaría que docs=[] y nadie reciba el mensaje.`);

    // Diagnóstico extra: ¿existe el usuario pero está baneado?
    const allDocs = snap.docs.find((d) => d.id === usuarioFiltro);
    if (allDocs) {
      console.log(`   → El usuario SÍ existe en Firestore pero tiene baneado=true.`);
    } else {
      console.log(`   → El usuario NO existe en la colección 'usuarios'.`);
    }
    process.exit(1);
  }

  const data = userDoc.data();
  const destinatario = { uid: userDoc.id, nombre: data.nombre, correo: data.correo, fcmToken: data.fcmToken ? "✓ registrado" : "✗ ausente (no recibirá push)" };

  console.log(`\n✅ RESULTADO: el filtro funcionaría correctamente`);
  console.log(`   Usuarios que recibirían el mensaje: 1`);
  console.log(`\n   Destinatario:`);
  console.log(`     Nombre:    ${destinatario.nombre}`);
  console.log(`     Correo:    ${destinatario.correo}`);
  console.log(`     UID:       ${destinatario.uid}`);
  console.log(`     FCM Token: ${destinatario.fcmToken}`);
  console.log(`\n   El mensaje se guardaría en:`);
  console.log(`     usuarios/${userDoc.id}/notificaciones/{nuevo_doc}`);

  process.exit(0);
}

dryRun().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
