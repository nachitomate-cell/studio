#!/usr/bin/env node
/**
 * limpiar-marcha-blanca.js
 *
 * Elimina SOLO los datos de prueba de marcha blanca:
 *   - pending_stamps
 *   - system_logs
 *   - canjes
 *
 * NO toca la colección users ni ningún campo de usuario.
 *
 * Uso:
 *   node scripts/limpiar-marcha-blanca.js <ruta-service-account.json>
 *
 * Ejemplo:
 *   node scripts/limpiar-marcha-blanca.js ./serviceAccount.json
 */

const path = require('path');
const fs   = require('fs');

// ── Cargar firebase-admin desde functions/node_modules ──────────────────────
const adminPath = path.resolve(__dirname, '../functions/node_modules/firebase-admin');
let admin;
try {
  admin = require(adminPath);
} catch {
  console.error('❌  No se encontró firebase-admin en functions/node_modules.');
  console.error('    Ejecuta: cd functions && npm install');
  process.exit(1);
}

// ── Leer ruta del Service Account ───────────────────────────────────────────
const serviceAccountArg = process.argv[2];
if (!serviceAccountArg) {
  console.error('❌  Falta el archivo de Service Account.');
  console.error('    Uso: node scripts/limpiar-marcha-blanca.js <ruta-service-account.json>');
  console.error('');
  console.error('    Obtén el archivo en:');
  console.error('    Firebase Console → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada');
  process.exit(1);
}

const serviceAccountPath = path.resolve(process.cwd(), serviceAccountArg);
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌  Archivo no encontrado: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// ── Inicializar Admin SDK ────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

// ── Constantes ───────────────────────────────────────────────────────────────
const BATCH_SIZE   = 500;
const COLLECTIONS  = ['pending_stamps', 'system_logs', 'canjes'];
const DEMO_PROFILES = ['demo_1', 'demo_2', 'demo_3', 'demo_4'];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Lee todos los documentos de una colección (solo id + data para backup) */
async function leerColeccion(nombre) {
  const snapshot = await db.collection(nombre).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/** Elimina todos los documentos de una colección en lotes de BATCH_SIZE */
async function eliminarColeccion(nombre) {
  let totalEliminados = 0;

  while (true) {
    const snapshot = await db.collection(nombre).limit(BATCH_SIZE).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    totalEliminados += snapshot.docs.length;
    process.stdout.write(`\r  ${nombre}: ${totalEliminados} eliminados...`);
  }

  process.stdout.write('\n');
  return totalEliminados;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║      LIMPIEZA DE DATOS - MARCHA BLANCA               ║');
  console.log('║      Proyecto:', serviceAccount.project_id.padEnd(37) + '║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // ── 1. Backup ───────────────────────────────────────────────────────────
  console.log('📦  Creando backup...');
  const backupData = {};
  let totalDocumentos = 0;

  for (const col of COLLECTIONS) {
    process.stdout.write(`  Leyendo ${col}... `);
    backupData[col] = await leerColeccion(col);
    console.log(`${backupData[col].length} documentos`);
    totalDocumentos += backupData[col].length;
  }

  // Leer los perfiles demo que existen
  process.stdout.write(`  Leyendo perfiles demo de entrepreneur_profiles... `);
  const demoSnaps = await Promise.all(
    DEMO_PROFILES.map(id => db.collection('entrepreneur_profiles').doc(id).get())
  );
  const demoExistentes = demoSnaps.filter(s => s.exists).map(s => ({ id: s.id, ...s.data() }));
  backupData['entrepreneur_profiles_demo'] = demoExistentes;
  console.log(`${demoExistentes.length} documentos demo`);
  totalDocumentos += demoExistentes.length;

  if (totalDocumentos === 0) {
    console.log('');
    console.log('ℹ️  No hay datos de prueba que eliminar. Las colecciones ya están vacías.');
    process.exit(0);
  }

  const fecha       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile  = path.resolve(__dirname, `../backup_${fecha}.json`);

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`✅  Backup guardado: ${path.basename(backupFile)}`);
  console.log('');

  // ── 2. Confirmación ─────────────────────────────────────────────────────
  console.log('⚠️   ATENCIÓN: Se eliminarán los siguientes documentos:');
  for (const col of COLLECTIONS) {
    console.log(`      - ${col}: ${backupData[col].length} documentos`);
  }
  console.log(`      - entrepreneur_profiles (demo): ${demoExistentes.length} documentos`);
  for (const d of demoExistentes) {
    console.log(`          • ${d.id} — ${d.businessName || '(sin nombre)'}`);
  }
  console.log('');
  console.log('    La colección "users" NO será modificada.');
  console.log('    Los campos stampsCount y ticketsSorteo NO serán tocados.');
  console.log('');

  // Confirmación interactiva (se puede omitir con --force)
  if (!process.argv.includes('--force')) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const respuesta = await new Promise(resolve => {
      rl.question('    ¿Continuar? Escribe "SI" para confirmar: ', resolve);
    });
    rl.close();

    if (respuesta.trim().toUpperCase() !== 'SI') {
      console.log('');
      console.log('❌  Operación cancelada.');
      process.exit(0);
    }
  }

  console.log('');

  // ── 3. Eliminación ──────────────────────────────────────────────────────
  console.log('🗑️   Eliminando datos...');
  const resultados = {};

  for (const col of COLLECTIONS) {
    resultados[col] = await eliminarColeccion(col);
  }

  // Eliminar perfiles demo
  process.stdout.write(`  entrepreneur_profiles (demo): eliminando...`);
  if (demoExistentes.length > 0) {
    const batch = db.batch();
    for (const id of DEMO_PROFILES) {
      batch.delete(db.collection('entrepreneur_profiles').doc(id));
    }
    await batch.commit();
  }
  process.stdout.write(` ${demoExistentes.length} eliminados\n`);
  resultados['demo_profiles'] = demoExistentes.length;

  // ── 4. Resumen ──────────────────────────────────────────────────────────
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  ✅ Limpieza completada:                             ║');
  console.log(`║  - pending_stamps eliminados: ${String(resultados['pending_stamps']).padEnd(22)}║`);
  console.log(`║  - system_logs eliminados:    ${String(resultados['system_logs']).padEnd(22)}║`);
  console.log(`║  - canjes eliminados:         ${String(resultados['canjes']).padEnd(22)}║`);
  console.log(`║  - perfiles demo eliminados:  ${String(resultados['demo_profiles']).padEnd(22)}║`);
  console.log('║  - Usuarios: sin cambios                             ║');
  console.log(`║  - Backup: ${path.basename(backupFile).padEnd(41)}║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
}

main().catch(err => {
  console.error('');
  console.error('❌  Error inesperado:', err.message || err);
  process.exit(1);
});
