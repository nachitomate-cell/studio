/**
 * Cliente Evolution API (server-only) — marketing WhatsApp del Club Patio.
 *
 * Habla con el VPS de SynapTech (wa.synaptechspa.cl) usando la instancia
 * dedicada del club (`instance_clubpatio`). Portado del client probado en
 * producción de la plataforma de barberías (Evolution v2.3.7).
 *
 * Env (solo servidor, configurar en Vercel):
 *   EVOLUTION_API_URL   → https://wa.synaptechspa.cl
 *   EVOLUTION_API_KEY   → apikey del VPS
 *   WA_WEBHOOK_TOKEN    → token propio para validar el webhook entrante
 *
 * ⚠ NUNCA importar desde componentes cliente: expone la apikey.
 */

export const WA_INSTANCE = "instance_clubpatio";

const EVENTS = ["CONNECTION_UPDATE", "MESSAGES_UPSERT", "QRCODE_UPDATED"];

function cfg() {
  const baseUrl = process.env.EVOLUTION_API_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    throw new Error("Faltan EVOLUTION_API_URL / EVOLUTION_API_KEY en el entorno.");
  }
  return { root: baseUrl.replace(/\/+$/, ""), apiKey };
}

async function req(method: string, path: string, body?: unknown) {
  const { root, apiKey } = cfg();
  const res = await fetch(`${root}${path}`, {
    method,
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const raw = (data as any)?.response?.message || (data as any)?.message || `HTTP ${res.status}`;
    throw new Error(`Evolution ${method} ${path}: ${Array.isArray(raw) ? raw.join("; ") : raw}`);
  }
  return data as any;
}

/** Crea (o recrea) la instancia del club y fija el webhook de entrada. */
export async function crearInstancia(webhookUrl: string, webhookToken: string) {
  const data = await req("POST", "/instance/create", {
    instanceName: WA_INSTANCE,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    webhook: {
      url: webhookUrl,
      byEvents: false,
      base64: true,
      headers: { "x-webhook-token": webhookToken },
      events: EVENTS,
    },
  });
  const qc = data.qrcode || data.qr || {};
  return { qr: qc.base64 ?? null, pairingCode: qc.pairingCode ?? null };
}

/** Estado de la sesión: 'open' | 'connecting' | 'close' | 'unknown'. */
export async function estadoConexion(): Promise<string> {
  try {
    const data = await req("GET", `/instance/connectionState/${WA_INSTANCE}`);
    return data?.instance?.state || data?.state || "unknown";
  } catch {
    return "unknown";
  }
}

/** QR fresco para el modal de vinculación. */
export async function obtenerQR() {
  const data = await req("GET", `/instance/connect/${WA_INSTANCE}`);
  return { qr: data.base64 ?? null, pairingCode: data.pairingCode ?? null };
}

/**
 * Envía un texto con pacing anti-ban: "escribiendo…" aleatorio 3–8 s antes
 * de soltar el mensaje (jitter del lado de Evolution, no quema tiempo acá).
 */
export async function enviarTexto(numero: string, texto: string) {
  const delay = 3000 + Math.floor(Math.random() * 5000);
  return req("POST", `/message/sendText/${WA_INSTANCE}`, {
    number: numero,
    text: texto,
    delay,
  });
}

/** Destruye la sesión (control 100% manual del moderador). */
export async function desvincular() {
  try { await req("DELETE", `/instance/logout/${WA_INSTANCE}`); } catch { /* puede no existir */ }
  try { await req("DELETE", `/instance/delete/${WA_INSTANCE}`); } catch { /* idem */ }
}
