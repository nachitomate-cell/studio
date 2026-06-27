/**
 * GET /api/cron/daily-notifications
 *
 * Cron job diario que envía notificaciones push segmentadas según la cantidad
 * de sellos acumulados de cada usuario.
 *
 * Segmentos (campaña Club Patio Curauma):
 *   VIP          — 10+ sellos  → socios más fieles, premios exclusivos
 *   CASI_VIP     — 7 a 9 sellos → a poco de los premios grandes
 *   PRIMER_CANJE — 5 a 6 sellos → ya pueden canjear sus primeros premios
 *   CASI_LLEGO   — 3 a 4 sellos → muy cerca del primer canje
 *   NUEVOS       — 1 a 2 sellos → recién empezando, mostrar todo lo que ganan
 *   REACTIVACION — 0 sellos     → aún no estrenan beneficios
 *
 * El saludo "Hola {nombre}" se personaliza con el nombre real del usuario, por
 * lo que cada notificación es individual (sendEach en lotes de 500).
 *
 * Protegido con CRON_SECRET para que solo Vercel pueda invocarlo.
 * Horario: 13:00 UTC = ~10:00 Chile (UTC-3 verano / UTC-4 invierno)
 */

import { NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging, Message } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

// ── Definición de segmentos ────────────────────────────────────────────────────
//
// `min` es la cantidad mínima de sellos (inclusive) para caer en el segmento.
// Se evalúan de mayor a menor, así que el primero que cumpla `sellos >= min` gana.
// `saludoEmoji` se concatena tras "Hola {nombre}"; `cuerpo` es el resto del texto.

type Segmento = {
  tipo: string;
  min: number;
  titulo: string;
  saludoEmoji: string;
  cuerpo: string;
  cta: string;
  link: string;
};

const SEGMENTOS: Segmento[] = [
  {
    tipo: "diaria_vip",
    min: 10,
    titulo: "👑 Eres socio VIP del Club Patio",
    saludoEmoji: "👑",
    cuerpo:
      "¡Eres uno de nuestros socios más especiales del Club Patio Curauma!\n\n" +
      "Con tus sellos ya tienes acceso a premios exclusivos 🎁:\n" +
      "☕ Cool Café → café de grano de origen gratis (15 sellos)\n" +
      "🍺 Magura → 15% de descuento en tu cuenta total\n" +
      "🍣 Sushi Pro → 20% de descuento en local y delivery\n" +
      "🏋️ JyM Gym → 1 semana gratis\n" +
      "🧘 Studio Grit → 15% descuento en membresía con PAT\n\n" +
      "Este finde también puedes pasar por el Bazar del Outlet 🍭 — con 5 sellos hay sorpresa dulce esperándote.",
    cta: "Ver premios",
    link: "/",
  },
  {
    tipo: "diaria_casi_vip",
    min: 7,
    titulo: "🔥 Estás a poco de los premios grandes",
    saludoEmoji: "☀️",
    cuerpo:
      "¡Estás muy cerca de los premios grandes del Club Patio Curauma! 💧\n\n" +
      "Con tus sellos te falta poquito para:\n" +
      "☕ 10 sellos → café gratis en Cool Café\n" +
      "🏋️ 10 sellos → 1 semana gratis en JyM Gym\n" +
      "🍣 10 sellos → 15% de descuento en Sushi Pro\n" +
      "🍺 10 sellos → Happy Hour extendido en Magura\n\n" +
      "Este finde es tu oportunidad perfecta 🤍 Pasa por el Bazar del Outlet 🍭 y suma sellos en tus locales favoritos del Patio.",
    cta: "Ver premios",
    link: "/",
  },
  {
    tipo: "diaria_primer_canje",
    min: 5,
    titulo: "🎁 ¡Ya puedes canjear tus primeros premios!",
    saludoEmoji: "🎁",
    cuerpo:
      "¡Ya tienes sellos suficientes para canjear tus primeros premios del Club Patio Curauma!\n\n" +
      "Muestra tu app en estos locales y recibe:\n" +
      "🏪 Patio Curauma Tienda → 1 premio dulce 🍬\n" +
      "☕ Cool Café → 1 Macaron o Brigadeiro delicioso\n" +
      "🍣 Sushi Pro → 10% de descuento\n" +
      "🏋️ JyM Gym → 3 días gratis para probar\n" +
      "🧘 Studio Grit → 1 clase de prueba gratis\n" +
      "🍺 Magura → Pisco Sour en tu almuerzo\n\n" +
      "Y este finde el Bazar del Outlet 🍭 tiene café especial esperándote con 5 sellos ✨",
    cta: "Canjear",
    link: "/",
  },
  {
    tipo: "diaria_casi_llego",
    min: 3,
    titulo: "⏳ ¡Te falta muy poquito para tu premio!",
    saludoEmoji: "🍭",
    cuerpo:
      "¡Te falta muy poquito para tu primer premio del Club Patio Curauma! 🎉\n\n" +
      "Con solo 1 o 2 sellos más podrás canjear:\n" +
      "🍬 Un dulce en Patio Curauma Tienda\n" +
      "☕ Un Macaron o Brigadeiro en Cool Café\n" +
      "🏋️ 3 días gratis en JyM Gym\n" +
      "🍣 10% de descuento en Sushi Pro\n" +
      "🍺 Pisco Sour gratis en Magura\n\n" +
      "👉 Este finde pasa por el Bazar del Outlet 🍭 en Patio Curauma y suma el sello que te falta.",
    cta: "Ver premios",
    link: "/",
  },
  {
    tipo: "diaria_nuevos",
    min: 1,
    titulo: "🎉 ¡Ya estás dentro del Club Patio!",
    saludoEmoji: "👋",
    cuerpo:
      "¡Ya estás dentro del Club Patio Curauma! 🎉\n\n" +
      "¿Sabías que con solo 5 sellos ya puedes canjear premios en 6 comercios? 🎁\n" +
      "☕ Cool Café → Macaron o Brigadeiro\n" +
      "🏪 Patio Curauma Tienda → Premio dulce\n" +
      "🏋️ JyM Gym → 3 días gratis\n" +
      "🍣 Sushi Pro → 10% de descuento\n" +
      "🍺 Magura → Pisco Sour gratis en almuerzo\n" +
      "🧘 Studio Grit → 1 clase de prueba gratis\n\n" +
      "👉 Este fin de semana pasa por el Bazar del Outlet 🍭 y suma sellos visitando tus locales favoritos del Patio.",
    cta: "Ver app",
    link: "/",
  },
  {
    tipo: "diaria_reactivacion",
    min: 0,
    titulo: "💛 Tus beneficios te esperan en el Patio",
    saludoEmoji: "👋",
    cuerpo:
      "¡Eres parte del Club Patio Curauma pero aún no has estrenado tus beneficios! 😊\n\n" +
      "La buena noticia: con tu primera visita a cualquier local del Patio ya empiezas a acumular sellos ☀️\n\n" +
      "Este finde tenemos algo especial: el Bazar del Outlet 🍭 en el Patio Curauma. Con 5 sellos hay regalos dulces para ti.\n\n" +
      "Solo muestra tu app del Club al pagar y el local te da tus sellos automáticamente.",
    cta: "Ver app",
    link: "/",
  },
];

function segmentoPara(sellos: number): Segmento {
  // SEGMENTOS está ordenado de mayor a menor `min`, así que el primero que
  // cumpla gana. El último (min: 0) siempre captura el caso 0 sellos.
  return SEGMENTOS.find((s) => sellos >= s.min) ?? SEGMENTOS[SEGMENTOS.length - 1];
}

function construirCuerpo(seg: Segmento, nombre: string): string {
  const primerNombre = (nombre || "").trim().split(/\s+/)[0];
  const saludo = primerNombre ? `Hola ${primerNombre}` : "Hola";
  return `${saludo} ${seg.saludoEmoji}\n\n${seg.cuerpo}`;
}

// ── Firebase Admin ─────────────────────────────────────────────────────────────
function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";
  const privateKey = rawKey.startsWith("LS0t")
    ? Buffer.from(rawKey, "base64").toString("utf8")
    : rawKey.replace(/\\n/g, "\n").replace(/^["']|["']$/g, "").trim();
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey,
    }),
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildMessage(
  token: string,
  titulo: string,
  cuerpo: string,
  link: string
): Message {
  return {
    token,
    notification: { title: titulo, body: cuerpo },
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
          alert: { title: titulo, body: cuerpo },
          sound: "default",
          badge: 1,
          "content-available": 1,
        },
      },
    },
    webpush: {
      headers: { Urgency: "high", TTL: "86400" },
      notification: {
        title: titulo,
        body: cuerpo,
        icon: "/Logo2.png",
        badge: "/Logo2.png",
        // tag deduplicates on the browser: si el cron reintenta, reemplaza
        // la notificación anterior en vez de apilarse encima de ella.
        tag: "club-patio-cron-diaria",
        renotify: false,
      },
      fcmOptions: { link },
    },
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminApp  = getAdminApp();
    const adminDb   = getFirestore(adminApp);
    const messaging = getMessaging(adminApp);

    const usersSnap = await adminDb
      .collection("usuarios")
      .where("fcmToken", "!=", null)
      .get();

    type Destinatario = {
      uid: string;
      token: string;
      titulo: string;
      cuerpo: string;
      tipo: string;
      cta: string;
      link: string;
    };

    const destinatarios: Destinatario[] = [];
    const conteoSegmentos: Record<string, number> = {};

    usersSnap.docs.forEach((docSnap) => {
      const data  = docSnap.data();
      const token = data.fcmToken;
      if (!token || typeof token !== "string" || token.length <= 10) return;
      if (data.baneado) return;

      // `comprasRealizadas` es el SALDO ACTUAL canjeable (baja al canjear), no un
      // acumulado de por vida. Por eso los mensajes "ya puedes canjear" usan este valor.
      const sellos = data.comprasRealizadas ?? 0;
      let seg      = segmentoPara(sellos);

      // Excepción: un cliente que canjeó todos sus sellos queda en 0 saldo pero NO
      // es un usuario inactivo. Evitamos mandarle el mensaje "aún no estrenas tus
      // beneficios" y le damos el de "Nuevos" (alentador) en su lugar.
      if (seg.tipo === "diaria_reactivacion") {
        const esClienteRecurrente =
          (data.sellosHistoricos ?? 0) > 0 || (data.totalCanjesHistoricos ?? 0) > 0;
        if (esClienteRecurrente) {
          seg = SEGMENTOS.find((s) => s.tipo === "diaria_nuevos") ?? seg;
        }
      }

      destinatarios.push({
        uid: docSnap.id,
        token,
        titulo: seg.titulo,
        cuerpo: construirCuerpo(seg, data.nombre ?? ""),
        tipo: seg.tipo,
        cta: seg.cta,
        link: seg.link,
      });
      conteoSegmentos[seg.tipo] = (conteoSegmentos[seg.tipo] ?? 0) + 1;
    });

    // ── Envío FCM (sendEach, lotes de 500) ──────────────────────────────────────
    const BATCH_SIZE = 500;
    const invalidTokens: string[] = [];
    let totalSuccess = 0;
    let totalFailed  = 0;

    for (let i = 0; i < destinatarios.length; i += BATCH_SIZE) {
      const batch = destinatarios.slice(i, i + BATCH_SIZE);
      const messages = batch.map((d) => buildMessage(d.token, d.titulo, d.cuerpo, d.link));
      const result = await messaging.sendEach(messages);
      totalSuccess += result.successCount;
      totalFailed  += result.failureCount;
      result.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
          invalidTokens.push(batch[idx].token);
        }
      });
    }

    // ── Guardar notificación individual en Firestore (500 por batch) ────────────
    const now = new Date().toISOString();
    const FIRESTORE_CHUNK = 500;

    for (let i = 0; i < destinatarios.length; i += FIRESTORE_CHUNK) {
      const chunk = destinatarios.slice(i, i + FIRESTORE_CHUNK);
      const batch = adminDb.batch();
      chunk.forEach((d) => {
        const ref = adminDb.collection("usuarios").doc(d.uid).collection("notificaciones").doc();
        batch.set(ref, {
          titulo:  d.titulo,
          mensaje: d.cuerpo,
          leida:   false,
          fecha:   now,
          tipo:    d.tipo,
          isAI:    false,
          cta:     d.cta,
        });
      });
      await batch.commit();
    }

    // ── Limpiar tokens inválidos de Firestore ───────────────────────────────────
    if (invalidTokens.length > 0) {
      const cleanupBatch = adminDb.batch();
      usersSnap.docs.forEach((docSnap) => {
        if (invalidTokens.includes(docSnap.data().fcmToken)) {
          cleanupBatch.update(docSnap.ref, { fcmToken: null });
        }
      });
      await cleanupBatch.commit();
    }

    console.log(
      `[cron/daily] Destinatarios: ${destinatarios.length} | ` +
      Object.entries(conteoSegmentos).map(([t, n]) => `${t}: ${n}`).join(" | ") +
      ` | OK: ${totalSuccess} | Fail: ${totalFailed} | Tokens limpios: ${invalidTokens.length}`
    );

    return NextResponse.json({
      success: true,
      sent:    totalSuccess,
      failed:  totalFailed,
      cleaned: invalidTokens.length,
      total:   destinatarios.length,
      segmentos: conteoSegmentos,
    });
  } catch (error: any) {
    console.error("[cron/daily] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
