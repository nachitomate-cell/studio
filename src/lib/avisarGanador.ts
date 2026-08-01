/**
 * Aviso al ganador de un sorteo, por los tres canales a la vez.
 *
 * Vive aparte porque lo necesitan dos caminos distintos: el botón del panel
 * (que arma el mensaje a mano) y la ruleta, que sortea sola y no tiene a nadie
 * escribiendo el texto. Sin esto, quien gana por la ruleta no se enteraba de
 * nada — el sorteo quedaba registrado y el premio quemado, pero en silencio.
 *
 * Los tres canales tienen alcances distintos y por eso van los tres:
 *   bandeja de la app → llega al 100% de los inscritos
 *   correo           → llega a todos los que dieron correo (prácticamente todos)
 *   push             → solo a quien activó notificaciones (al 2026-07-29, 9%)
 *
 * Nunca lanza: un fallo avisando no puede tumbar la entrega de un premio que ya
 * quedó registrada. Devuelve qué salió por cada canal para poder mostrarlo.
 */

import { Resend } from "resend";
import { adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { CANONICAL_BASE_URL } from "@/lib/constants";

export type ResultadoAviso = {
  bandeja: boolean;
  push: boolean;
  correo: boolean;
  detalle?: string;
};

function plantilla(nombre: string, premio: string, url: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#faf4e6;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:20px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,.06);">
    <div style="text-align:center;font-size:52px;line-height:1;margin-bottom:10px;">🏆</div>
    <h1 style="color:#1a1a2e;font-size:24px;font-weight:800;margin:0 0 16px;text-align:center;">¡Ganaste!</h1>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 12px;">Hola ${esc(nombre)},</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 22px;">
      Saliste sorteado en Expovino y te ganaste:
    </p>
    <div style="background:#faf4e6;border:1px solid #e8dcc0;border-radius:14px;padding:18px;text-align:center;margin-bottom:24px;">
      <p style="margin:0;font-size:19px;font-weight:800;color:#7B1E3A;">${esc(premio)}</p>
    </div>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 26px;">
      Acércate al <strong>mostrador del Club Patio Curauma</strong> para retirarlo.
    </p>
    <div style="text-align:center;">
      <a href="${url}" style="display:inline-block;background:#9DCC65;color:#fff;text-decoration:none;padding:14px 30px;border-radius:12px;font-weight:bold;font-size:15px;">Abrir Club Patio</a>
    </div>
  </div>
</body></html>`;
}

export async function avisarGanador(opts: {
  uid: string;
  nombre: string;
  correo: string;
  premio: string;
}): Promise<ResultadoAviso> {
  const { uid, nombre, correo, premio } = opts;
  const pila = nombre.split(/\s+/)[0] || nombre;
  const titulo = "¡Ganaste! 🏆";
  const mensaje = `Felicitaciones ${pila}: saliste sorteado y te ganaste ${premio}. ` +
    `Acércate al mostrador del Club Patio Curauma para retirarlo.`;
  const url = `${CANONICAL_BASE_URL}/expovino`;
  const r: ResultadoAviso = { bandeja: false, push: false, correo: false };

  // 1. Bandeja de la app — el canal que no falla
  try {
    await adminDb.collection("usuarios").doc(uid).collection("notificaciones").add({
      titulo, mensaje, fecha: new Date().toISOString(),
      tipo: "SORTEO", leida: false, cta: "/expovino",
    });
    r.bandeja = true;
  } catch (e: any) {
    r.detalle = `bandeja: ${e?.message}`;
  }

  // 2. Push — solo si tiene token
  try {
    const snap = await adminDb.collection("usuarios").doc(uid).get();
    const token = snap.exists ? snap.data()!.fcmToken : null;
    if (token) {
      await adminMessaging.send({
        token: String(token),
        notification: { title: titulo, body: mensaje },
        data: { type: "SORTEO", url },
        android: { priority: "high" },
        apns: { payload: { aps: { sound: "default", badge: 1 } } },
        webpush: { notification: { icon: "/Logo2.png" }, fcmOptions: { link: url } },
      });
      r.push = true;
    }
  } catch (e: any) {
    r.detalle = `${r.detalle ?? ""} push: ${e?.message}`.trim();
  }

  // 3. Correo — el que de verdad alcanza al ganador
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: "Club Patio Curauma <soporte@synaptechspa.cl>",
        to: correo,
        subject: `¡Ganaste! ${premio}`,
        html: plantilla(pila, premio, url),
      });
      if (error) throw new Error(String((error as any)?.message ?? error));
      r.correo = true;
    }
  } catch (e: any) {
    r.detalle = `${r.detalle ?? ""} correo: ${e?.message}`.trim();
  }

  return r;
}
