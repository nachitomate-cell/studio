/**
 * notificar-mundial.mjs
 *
 * Broadcast one-shot para informar a todos los socios sobre los octavos
 * del Mundial. Lee `.env.local`, envía FCM en lotes de 500 con `sendEach`,
 * guarda la notificación en `usuarios/{uid}/notificaciones` y limpia tokens
 * inválidos (registration-token-not-registered).
 *
 * Uso: node scripts/notificar-mundial.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// ── Cargar .env.local ────────────────────────────────────────────────────────
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
  console.error("No se encontró .env.local");
  process.exit(1);
}

// ── Firebase Admin ───────────────────────────────────────────────────────────
const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
const rawKey      = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";

let privateKey;
if (!rawKey.includes("-----BEGIN")) {
  privateKey = Buffer.from(rawKey, "base64").toString("utf-8");
} else {
  privateKey = rawKey.replace(/\\n/g, "\n");
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db        = getFirestore();
const messaging = getMessaging();

// ── Contenido del push ───────────────────────────────────────────────────────
const TITULO = "⚽ ¡Ya están las semifinales del Mundial!";
const CUERPO =
  "Ya puedes dejar tu pronóstico en el Club:\n\n" +
  "• Francia vs España — mar 14, 15:00\n" +
  "• Inglaterra vs Argentina — mié 15, 15:00\n\n" +
  "Acierta el marcador y suma sellos. ¡Mucha suerte!";
const LINK  = "/mundial";
const TIPO  = "mundial_semifinales_broadcast";

function buildMessage(token) {
  return {
    token,
    notification: { title: TITULO, body: CUERPO },
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "club_patio_default",
        visibility: "public",
      },
    },
    apns: {
      headers: { "apns-priority": "10", "apns-push-type": "alert" },
      payload: {
        aps: {
          alert: { title: TITULO, body: CUERPO },
          sound: "default",
          badge: 1,
          "content-available": 1,
        },
      },
    },
    webpush: {
      headers: { Urgency: "high", TTL: "86400" },
      notification: {
        title: TITULO,
        body: CUERPO,
        icon: "/Logo2.png",
        badge: "/Logo2.png",
        tag: "club-patio-activacion-notif",
        renotify: false,
      },
      fcmOptions: { link: LINK },
    },
  };
}

// ── Lectura de destinatarios ─────────────────────────────────────────────────
console.log("[mundial-broadcast] Leyendo usuarios con fcmToken…");
const usersSnap = await db
  .collection("usuarios")
  .where("fcmToken", "!=", null)
  .get();

const destinatarios = [];
usersSnap.docs.forEach((docSnap) => {
  const data  = docSnap.data();
  const token = data.fcmToken;
  if (!token || typeof token !== "string" || token.length <= 10) return;
  if (data.baneado) return;
  destinatarios.push({ uid: docSnap.id, token });
});

console.log(`[mundial-broadcast] Destinatarios válidos: ${destinatarios.length}`);
if (destinatarios.length === 0) {
  console.log("Nada que enviar. Fin.");
  process.exit(0);
}

// Guard: no envía a menos que se pase --send. Evita disparos accidentales.
if (!process.argv.includes("--send")) {
  console.log("\n🔍 SIMULACIÓN (sin --send): no se envió ni guardó nada.");
  console.log(`   TÍTULO: ${TITULO}`);
  console.log(`   CUERPO:\n${CUERPO.split("\n").map((l) => "     " + l).join("\n")}`);
  console.log(`   Se enviaría a ${destinatarios.length} socios. Ejecuta con --send para disparar.`);
  process.exit(0);
}

// ── Envío FCM (lotes de 500) ─────────────────────────────────────────────────
const BATCH_SIZE   = 500;
const invalidTokens = [];
let totalSuccess = 0;
let totalFailed  = 0;

for (let i = 0; i < destinatarios.length; i += BATCH_SIZE) {
  const batch    = destinatarios.slice(i, i + BATCH_SIZE);
  const messages = batch.map((d) => buildMessage(d.token));
  const result   = await messaging.sendEach(messages);
  totalSuccess  += result.successCount;
  totalFailed   += result.failureCount;
  result.responses.forEach((resp, idx) => {
    if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
      invalidTokens.push(batch[idx].token);
    }
  });
  console.log(
    `  Lote ${Math.floor(i / BATCH_SIZE) + 1}: OK=${result.successCount} · FAIL=${result.failureCount}`
  );
}

// ── Guardar notificación en Firestore ────────────────────────────────────────
const now = new Date().toISOString();
const FIRESTORE_CHUNK = 500;
console.log("[mundial-broadcast] Guardando notificaciones en Firestore…");
for (let i = 0; i < destinatarios.length; i += FIRESTORE_CHUNK) {
  const chunk = destinatarios.slice(i, i + FIRESTORE_CHUNK);
  const batch = db.batch();
  chunk.forEach((d) => {
    const ref = db.collection("usuarios").doc(d.uid).collection("notificaciones").doc();
    batch.set(ref, {
      titulo:  TITULO,
      mensaje: CUERPO,
      leida:   false,
      fecha:   now,
      tipo:    TIPO,
      isAI:    false,
      cta:     "Ver Semifinales",
    });
  });
  await batch.commit();
}

// ── Limpiar tokens inválidos ─────────────────────────────────────────────────
let cleaned = 0;
if (invalidTokens.length > 0) {
  console.log(`[mundial-broadcast] Limpiando ${invalidTokens.length} tokens inválidos…`);
  const cleanupBatch = db.batch();
  usersSnap.docs.forEach((docSnap) => {
    if (invalidTokens.includes(docSnap.data().fcmToken)) {
      cleanupBatch.update(docSnap.ref, { fcmToken: null });
      cleaned++;
    }
  });
  await cleanupBatch.commit();
}

// ── Log ──────────────────────────────────────────────────────────────────────
await db.collection("system_logs").add({
  usuarioId: "script:notificar-mundial",
  usuario: "cli",
  accion:
    `Broadcast semifinales Mundial → destinatarios=${destinatarios.length} · ok=${totalSuccess} · fail=${totalFailed} · cleaned=${cleaned}`,
  fecha: now,
  tipo: "MUNDIAL_SEMIFINALES_BROADCAST",
});

console.log("");
console.log("──────────── RESUMEN ────────────");
console.log(`  Destinatarios válidos : ${destinatarios.length}`);
console.log(`  Entregados (success)  : ${totalSuccess}`);
console.log(`  Fallidos              : ${totalFailed}`);
console.log(`  Tokens limpiados      : ${cleaned}`);
console.log("─────────────────────────────────");
process.exit(0);
