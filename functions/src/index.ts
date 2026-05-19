/**
 * Club Patio Curauma – Cloud Functions
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  FUNCIÓN: weeklyMarketingCampaign                               │
 * │  Cron: cada viernes a las 10:00 AM (America/Santiago)           │
 * │  Objetivo: generar mensajes IA personalizados por usuario y     │
 * │            enviarlos como Push via FCM + guardar en Firestore   │
 * └─────────────────────────────────────────────────────────────────┘
 */

import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Inicialización SDK ────────────────────────────────────────────────────────
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ── Cliente de IA (Gemini 2.0 Flash vía API REST) ─────────────────────────────
// La API key se guarda como Secret de Cloud Functions (nunca en código fuente).
// Configúrala con: firebase functions:secrets:set GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface UserDoc {
  uid: string;
  nombre?: string;
  correo?: string;
  comprasRealizadas?: number;
  ticketsSorteo?: number;
  totalCanjesHistoricos?: number;
  ultimaVisita?: string; // ISO string
  fcmToken?: string;    // Token de dispositivo para FCM
  baneado?: boolean;
  rol?: string;
}

interface PromoMessage {
  title: string;
  message: string;
  callToAction: string;
  context: "urgency" | "reengagement" | "welcome" | "celebration" | "reminder";
}

// ── Lógica de contexto ────────────────────────────────────────────────────────

function buildPrompt(user: UserDoc): string {
  const nombre = user.nombre || "Amigo";
  const sellos = user.comprasRealizadas ?? 0;
  const tickets = user.ticketsSorteo ?? 0;
  const totalCanjes = user.totalCanjesHistoricos ?? 0;
  const sellosRestantes = 10 - (sellos % 10) || 10;

  // Calcular días desde última visita
  let diasAusente = 0;
  if (user.ultimaVisita) {
    const ultima = new Date(user.ultimaVisita);
    diasAusente = Math.floor((Date.now() - ultima.getTime()) / (1000 * 60 * 60 * 24));
  }

  let contextoEspecial = "";
  if (diasAusente >= 30) {
    contextoEspecial = `⚠️ CRÍTICO: Lleva ${diasAusente} días sin visitar. Mensaje de re-engagement urgente y cálido.`;
  } else if (diasAusente >= 14) {
    contextoEspecial = `🕐 Lleva ${diasAusente} días sin visitar. Mensaje de "te echamos de menos".`;
  } else if (sellos === 0) {
    contextoEspecial = "🎁 Nunca ha acumulado sellos. El primer sello es de regalo al registrarse.";
  } else if (sellosRestantes === 1) {
    contextoEspecial = "🔥 MÁXIMA URGENCIA: le falta solo 1 sello para ganar su premio.";
  } else if (sellosRestantes <= 3) {
    contextoEspecial = `⚡ Alta urgencia: le faltan ${sellosRestantes} sellos para su próximo premio.`;
  } else if (tickets > 0) {
    contextoEspecial = `🎟️ Tiene ${tickets} tickets de sorteo activos. Recuérdale que puede ganar algo grande.`;
  } else if (totalCanjes === 0 && sellos >= 10) {
    contextoEspecial = "🏆 ¡Completó su primera tarjeta y nunca la ha canjeado! Motívale a canjear.";
  }

  return `Eres el community manager de Club Patio Curauma, un centro comercial en Valparaíso, Chile.
Escribe un mensaje de marketing personalizado y breve para motivar al cliente a volver.

DATOS:
- Nombre: ${nombre}
- Sellos acumulados: ${sellos} / 10
- Le faltan para el próximo premio: ${sellosRestantes}
- Tickets de sorteo: ${tickets}
${contextoEspecial ? `\nCONTEXTO ESPECIAL:\n${contextoEspecial}` : ""}

REGLAS ESTRICTAS:
- title: máximo 40 caracteres, llamativo.
- message: máximo 150 caracteres, persuasivo y local.
- callToAction: máximo 20 caracteres (ej: "Ir a Club Patio").
- context: uno de: urgency, reengagement, welcome, celebration, reminder.
- Usa máximo 2 emojis. Tono cercano y local chileno.

Responde ÚNICAMENTE con un JSON válido con estos 4 campos, sin markdown, sin explicación.`;
}

// ── Llamada a Gemini ──────────────────────────────────────────────────────────

async function generateMessage(user: UserDoc): Promise<PromoMessage> {
  const prompt = buildPrompt(user);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Limpiar posibles bloques markdown (```json ... ```)
    const clean = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(clean) as PromoMessage;

    // Validar campos mínimos
    if (!parsed.title || !parsed.message) throw new Error("Respuesta incompleta de la IA");

    return parsed;
  } catch (err) {
    logger.warn(`[IA] Fallback para usuario ${user.uid}:`, err);
    // Fallback determinístico si la IA falla
    return {
      title: "¡Te esperamos en Club Patio!",
      message: `Hola ${user.nombre ?? ""}! ${10 - ((user.comprasRealizadas ?? 0) % 10)} sellos más y tienes tu premio. ¡Ven hoy! 🎁`,
      callToAction: "Ver mis sellos",
      context: "reminder",
    };
  }
}

// ── Guardar notificación en Firestore ─────────────────────────────────────────

async function saveNotification(uid: string, promo: PromoMessage): Promise<void> {
  const notifRef = db.collection("usuarios").doc(uid).collection("notificaciones");
  await notifRef.add({
    titulo: promo.title,
    mensaje: promo.message,
    cta: promo.callToAction,
    isAI: true,
    leida: false,
    tipo: "AI_MARKETING_CAMPAIGN",
    context: promo.context,
    fecha: new Date().toISOString(),
    fuente: "cloud_function_weekly",
  });
}

// ── Enviar Push via FCM ───────────────────────────────────────────────────────

async function sendPushNotification(user: UserDoc, promo: PromoMessage): Promise<void> {
  // El FCM Token se guarda en el documento del usuario cuando el cliente lo registra
  if (!user.fcmToken) return;

  try {
    await messaging.send({
      token: user.fcmToken,
      notification: {
        title: promo.title,
        body: promo.message,
      },
      data: {
        type: "AI_CAMPAIGN",
        context: promo.context,
        cta: promo.callToAction,
        uid: user.uid,
      },
      android: {
        priority: "normal",
        notification: {
          channelId: "club_patio_marketing",
          icon: "ic_notification",
          color: "#4EAD1F",
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: "default",
          },
        },
      },
      webpush: {
        notification: {
          icon: "/Logo.png",
          badge: "/Logo.png",
          requireInteraction: false,
        },
        fcmOptions: {
          link: "https://club-patio-curauma.vercel.app/",
        },
      },
    });
    logger.info(`[FCM] Push enviado a ${user.nombre ?? user.uid}`);
  } catch (err: any) {
    // Token inválido/expirado → marcar para limpieza
    if (err.code === "messaging/registration-token-not-registered" ||
        err.code === "messaging/invalid-registration-token") {
      logger.warn(`[FCM] Token inválido para ${user.uid}. Limpiando...`);
      await db.collection("usuarios").doc(user.uid).update({ fcmToken: admin.firestore.FieldValue.delete() });
    } else {
      logger.error(`[FCM] Error enviando a ${user.uid}:`, err);
    }
  }
}

// ── Registrar métricas de la campaña ─────────────────────────────────────────

async function logCampaignRun(stats: {
  total: number;
  processed: number;
  pushSent: number;
  errors: number;
}): Promise<void> {
  await db.collection("campaign_logs").add({
    fecha: new Date().toISOString(),
    tipo: "WEEKLY_AI_CAMPAIGN",
    ...stats,
  });
}

// ── CLOUD FUNCTION PRINCIPAL ──────────────────────────────────────────────────

/**
 * weeklyMarketingCampaign
 *
 * Programada para ejecutarse cada viernes a las 10:00 AM (hora Chile).
 * Para pruebas inmediatas, despliega con schedule: "every 5 minutes"
 * y revierte después.
 *
 * Deploy: `firebase deploy --only functions`
 */
export const weeklyMarketingCampaign = onSchedule(
  {
    // Cron: cada viernes a las 10:00 AM, zona horaria de Chile
    schedule: "0 10 * * 5",
    timeZone: "America/Santiago",
    // La API key de Gemini se pasa como Secret (no hardcoded)
    // secrets: ["GEMINI_API_KEY"],
    // Timeout generoso para iterar muchos usuarios
    timeoutSeconds: 540,
    memory: "512MiB",
    region: "us-central1",
  },
  async () => {
    logger.info("=== Iniciando campaña semanal de marketing IA ===");

    const stats = { total: 0, processed: 0, pushSent: 0, errors: 0 };

    // 1. Obtener todos los socios activos (excluye admins, emprendedores y baneados)
    const snapshot = await db
      .collection("usuarios")
      .where("baneado", "!=", true)
      .get();

    stats.total = snapshot.size;
    logger.info(`Procesando ${stats.total} usuarios...`);

    // 2. Procesar en lotes de 10 para no saturar la API de Gemini
    const BATCH_SIZE = 10;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (docSnap) => {
          const data = docSnap.data() as Omit<UserDoc, "uid">;
          const user: UserDoc = { uid: docSnap.id, ...data };

          // Saltear admins y emprendedores (ellos tienen otro flujo)
          if (user.rol === "admin" || user.rol === "emprendedor") return;

          try {
            // 3. Generar mensaje personalizado con IA
            const promo = await generateMessage(user);

            // 4. Guardar en Firestore como notificación
            await saveNotification(user.uid, promo);

            // 5. Enviar push si el usuario tiene FCM token
            if (user.fcmToken) {
              await sendPushNotification(user, promo);
              stats.pushSent++;
            }

            stats.processed++;
            logger.debug(`[OK] ${user.nombre ?? user.uid} → context: ${promo.context}`);
          } catch (err) {
            stats.errors++;
            logger.error(`[ERROR] Usuario ${user.uid}:`, err);
          }
        })
      );

      // Pausa breve entre lotes para respetar rate limits de Gemini
      if (i + BATCH_SIZE < docs.length) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    // 6. Guardar métricas de la campaña
    await logCampaignRun(stats);

    logger.info(`=== Campaña completada ===`, {
      total: stats.total,
      processed: stats.processed,
      pushSent: stats.pushSent,
      errors: stats.errors,
    });
  }
);

// ── FUNCIÓN AUXILIAR: Guardar/actualizar FCM Token desde el cliente ───────────
// Esta función HTTP la llama el cliente cuando obtiene un nuevo token.
import { onRequest } from "firebase-functions/v2/https";

export const registerFcmToken = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { uid, token } = req.body;

    if (!uid || !token) {
      res.status(400).json({ error: "uid y token son requeridos" });
      return;
    }

    try {
      await db.collection("usuarios").doc(uid).update({
        fcmToken: token,
        fcmTokenUpdatedAt: new Date().toISOString(),
      });
      res.status(200).json({ success: true });
    } catch (err) {
      logger.error("Error guardando FCM token:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// ── Helper compartido: procesar un broadcast_messages doc ────────────────────

async function executeBroadcast(
  ref: admin.firestore.DocumentReference,
  messageData: admin.firestore.DocumentData
): Promise<void> {
  const { titulo, mensaje, destino, tipo = "info", cta = "/", vendedorFiltro, usuarioFiltro } = messageData;
  logger.info(`Iniciando envío de comunicado: ${ref.id} → destino="${destino}" tipo="${tipo}"`);

  // Guarda atómica: solo una instancia de la función puede procesar este documento.
  // Si Cloud Functions reintenta (retry automático tras timeout/error), las instancias
  // adicionales leen estado != "pendiente" y abortan sin enviar duplicados.
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const estadoActual = snap.data()?.estado;
      if (estadoActual !== "pendiente") {
        throw new Error(`SKIP: estado ya es "${estadoActual}" — instancia duplicada o reintento.`);
      }
      tx.update(ref, { estado: "procesando", inicioProceso: new Date().toISOString() });
    });
  } catch (err: any) {
    logger.warn(`[executeBroadcast] ${ref.id} abortado: ${err.message}`);
    return;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const currentMonth = new Date().getMonth();
  let docs: admin.firestore.QueryDocumentSnapshot[];

  if (destino === "emprendedor") {
    const snap = await db.collection("usuarios").where("rol", "==", "emprendedor").get();
    docs = snap.docs.filter(d => d.data().baneado !== true);
  } else {
    const snap = await db.collection("usuarios").get();
    const notBanned = snap.docs.filter(d => d.data().baneado !== true);
    if (destino === "cerca_de_premio") {
      docs = notBanned.filter(d => (d.data().comprasRealizadas ?? 0) >= 4);
    } else if (destino === "inactivos") {
      docs = notBanned.filter(d => {
        const last: string | undefined = d.data().lastPurchaseAt;
        return !last || last < thirtyDaysAgo;
      });
    } else if (destino === "activos_recientes") {
      docs = notBanned.filter(d => {
        const last: string | undefined = d.data().lastPurchaseAt;
        return !!last && last >= thirtyDaysAgo;
      });
    } else if (destino === "cumpleanios_mes") {
      docs = notBanned.filter(d => {
        const fn = d.data().fechaNacimiento;
        if (!fn) return false;
        const date = fn instanceof admin.firestore.Timestamp ? fn.toDate() : new Date(fn);
        return !isNaN(date.getTime()) && date.getMonth() === currentMonth;
      });
    } else if (destino === "aceptaPromoLocales") {
      docs = notBanned.filter(d => d.data().aceptaPromoLocales === true);
    } else if (destino === "visitaron_local") {
      if (!vendedorFiltro) {
        docs = [];
        logger.warn(`Comunicado ${ref.id}: destino=visitaron_local sin vendedorFiltro — cancelado.`);
      } else {
        docs = notBanned.filter(d => {
          const data = d.data();
          return (
            (data.sellosLocales?.[vendedorFiltro] ?? 0) > 0 ||
            !!data.lastVendorScans?.[vendedorFiltro]
          );
        });
      }
    } else if (destino === "usuario_especifico") {
      if (!usuarioFiltro) {
        docs = [];
        logger.warn(`Comunicado ${ref.id}: destino=usuario_especifico sin usuarioFiltro — cancelado.`);
      } else {
        const userDoc = notBanned.find(d => d.id === usuarioFiltro);
        docs = userDoc ? [userDoc] : [];
        if (!userDoc) {
          logger.warn(`Comunicado ${ref.id}: usuario ${usuarioFiltro} no encontrado o está baneado.`);
        }
      }
    } else {
      docs = notBanned; // "todos"
    }
  }

  let processed = 0;
  let pushSent = 0;
  let errors = 0;
  const tokens: string[] = [];
  const BATCH_SIZE = 500;

  const androidPriority: Record<string, "high" | "normal"> = {
    urgente: "high", promo: "high", info: "normal", sorteo: "normal",
  };

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batchDocs = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    batchDocs.forEach(userDoc => {
      const userData = userDoc.data();
      const notifRef = db.collection("usuarios").doc(userDoc.id).collection("notificaciones").doc();
      batch.set(notifRef, {
        titulo,
        mensaje,
        fecha: new Date().toISOString(),
        tipo: `BROADCAST_${tipo.toUpperCase()}`,
        leida: false,
        fuente: "director_panel",
        cta,
        broadcastId: ref.id,
      });
      if (userData.fcmToken) tokens.push(userData.fcmToken);
      processed++;
    });

    await batch.commit();
  }

  const BASE_URL = process.env.BASE_URL ?? "https://club-patio-curauma.vercel.app";

  for (let i = 0; i < tokens.length; i += 500) {
    const tokenBatch = tokens.slice(i, i + 500);
    if (tokenBatch.length === 0) continue;
    try {
      const cleanTitle = titulo.replace(/^[^\w\s]+\s/, "");
      const notifUrl = `${BASE_URL}/notificacion?id=${ref.id}`;
      const response = await messaging.sendEachForMulticast({
        tokens: tokenBatch,
        notification: { title: cleanTitle, body: mensaje },
        data: { type: `BROADCAST_${tipo.toUpperCase()}`, cta, url: notifUrl },
        android: {
          priority: androidPriority[tipo] ?? "normal",
          notification: { channelId: "club_patio_marketing", icon: "ic_notification", color: "#4EAD1F" },
        },
        apns: { payload: { aps: { badge: 1, sound: tipo === "urgente" ? "alert" : "default" } } },
        webpush: { fcmOptions: { link: notifUrl } },
      });
      pushSent += response.successCount;
      errors += response.failureCount;
    } catch (e) {
      logger.error("Error enviando push multicast", e);
      errors += tokenBatch.length;
    }
  }

  await ref.update({
    estado: "completado",
    finProceso: new Date().toISOString(),
    stats: { totalNotificados: processed, pushSent, errors },
  });

  logger.info(`Comunicado ${ref.id} completado. InApp: ${processed}, Push: ${pushSent}, Errores: ${errors}`);
}

// ── FUNCIÓN: processGlobalBroadcast (trigger inmediato) ───────────────────────
export const processGlobalBroadcast = onDocumentCreated(
  {
    document: "broadcast_messages/{messageId}",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const messageData = snap.data();
    // Verificación rápida con el snapshot del trigger
    if (messageData.estado !== "pendiente") return;

    // Re-lectura directa de Firestore para detectar reintentos del trigger:
    // Cloud Functions puede entregar el evento original (estado="pendiente") incluso
    // si ya lo procesamos. Leer el doc actualizado descarta la mayoría de duplicados
    // antes de entrar a la transacción de executeBroadcast.
    const freshSnap = await snap.ref.get();
    if (freshSnap.data()?.estado !== "pendiente") {
      logger.info(`[processGlobalBroadcast] ${snap.id} ya procesado — reintento ignorado.`);
      return;
    }

    try {
      await executeBroadcast(snap.ref, messageData);
    } catch (error) {
      logger.error(`Error procesando comunicado ${snap.id}:`, error);
      await snap.ref.update({
        estado: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// ── FUNCIÓN: processScheduledBroadcasts (cron cada 5 min) ────────────────────
export const processScheduledBroadcasts = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const now = new Date().toISOString();
    const snap = await db.collection("broadcast_messages")
      .where("estado", "==", "programado")
      .get();

    const ready = snap.docs.filter(d => {
      const enviarEn: string | undefined = d.data().enviarEn;
      return !!enviarEn && enviarEn <= now;
    });

    if (ready.length === 0) return;
    logger.info(`Procesando ${ready.length} comunicado(s) programado(s)...`);

    for (const docSnap of ready) {
      try {
        await executeBroadcast(docSnap.ref, docSnap.data());
      } catch (error) {
        logger.error(`Error procesando comunicado programado ${docSnap.id}:`, error);
        await docSnap.ref.update({
          estado: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
);
