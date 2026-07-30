/**
 * POST /api/admin/campana/notificar
 *
 * Envía un aviso a los socios de una campaña por los TRES canales a la vez:
 * bandeja de la app (llega al 100%), push (solo quien tiene token) y correo.
 *
 * El correo existe porque el push solo alcanza a una fracción: al 2026-07-29,
 * 69 de 746 usuarios tenían notificaciones activas. Para un sorteo de evento eso
 * no sirve — el ganador tiene que enterarse.
 *
 * Headers: Authorization: Bearer <idToken>  (rol staff)
 * Body: {
 *   campana: string,          // slug guardado en usuarios.campanaRegistro
 *   titulo: string,
 *   mensaje: string,
 *   cta?: string,             // ruta relativa, ej "/premios"
 *   userIds?: string[],       // si viene, se envía SOLO a estos (ej. el ganador)
 * }
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminAuth, adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS, ROLES_STAFF_PANEL, CANONICAL_BASE_URL } from "@/lib/constants";

const MAX_DESTINATARIOS = 2000;
const LOTE_CORREO = 100;   // tope de la API batch de Resend
const LOTE_PUSH = 500;     // tope de sendEachForMulticast

type Destinatario = { uid: string; nombre: string; correo: string; token: string | null };

function plantillaCorreo(nombre: string, titulo: string, mensaje: string, url: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#faf4e6;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:20px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,.06);">
    <div style="text-align:center;margin-bottom:22px;">
      <img src="${CANONICAL_BASE_URL}/Logo2.png" alt="Club Patio Curauma" width="110" style="object-fit:contain;" />
    </div>
    <h1 style="color:#1a1a2e;font-size:22px;font-weight:800;margin:0 0 14px;text-align:center;">${esc(titulo)}</h1>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">Hola ${esc(nombre)},</p>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 28px;white-space:pre-line;">${esc(mensaje)}</p>
    <div style="text-align:center;">
      <a href="${url}" style="display:inline-block;background:#9DCC65;color:#fff;text-decoration:none;padding:14px 30px;border-radius:12px;font-weight:bold;font-size:15px;">Abrir Club Patio</a>
    </div>
    <p style="margin-top:30px;color:#a0aec0;font-size:12px;text-align:center;line-height:1.5;">
      Recibes este correo porque eres parte del Club Patio Curauma.
    </p>
  </div>
</body></html>`;
}

export async function POST(request: Request) {
  try {
    // ── Autenticación y rol staff ───────────────────────────────────────────
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const callerEmail = (decoded.email ?? "").trim().toLowerCase();
    let autorizado = ALLOWED_MOD_EMAILS.includes(callerEmail);
    if (!autorizado) {
      const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
      const d = snap.exists ? snap.data()! : null;
      const rol: string = d?.rol ?? "";
      const roles: string[] = Array.isArray(d?.roles) ? d.roles : [];
      autorizado = ROLES_STAFF_PANEL.includes(rol) || roles.some((r) => ROLES_STAFF_PANEL.includes(r));
    }
    if (!autorizado) {
      return NextResponse.json({ error: "Sin permisos de staff" }, { status: 403 });
    }

    // ── Validar body ────────────────────────────────────────────────────────
    const body = await request.json();
    const campana = String(body.campana ?? "").trim();
    const titulo = String(body.titulo ?? "").trim();
    const mensaje = String(body.mensaje ?? "").trim();
    const cta = String(body.cta ?? "/premios").trim();
    const userIds: string[] | null = Array.isArray(body.userIds) ? body.userIds.map(String) : null;

    if (!campana) return NextResponse.json({ error: "Falta la campaña" }, { status: 400 });
    if (!titulo || !mensaje) {
      return NextResponse.json({ error: "El título y el mensaje son obligatorios" }, { status: 400 });
    }

    // ── Resolver destinatarios ──────────────────────────────────────────────
    const snap = await adminDb.collection("usuarios").where("campanaRegistro", "==", campana).get();
    let destinatarios: Destinatario[] = snap.docs
      .filter((d) => d.data().baneado !== true)
      .map((d) => {
        const x = d.data();
        return {
          uid: d.id,
          nombre: String(x.nombre ?? "").trim() || "socio",
          correo: String(x.correo ?? "").trim(),
          token: x.fcmToken ? String(x.fcmToken) : null,
        };
      });

    if (userIds && userIds.length) {
      const permitidos = new Set(userIds);
      destinatarios = destinatarios.filter((d) => permitidos.has(d.uid));
    }

    if (!destinatarios.length) {
      return NextResponse.json({ error: "No hay destinatarios para esa campaña" }, { status: 404 });
    }
    if (destinatarios.length > MAX_DESTINATARIOS) {
      return NextResponse.json({ error: `Demasiados destinatarios (${destinatarios.length})` }, { status: 413 });
    }

    const timestamp = new Date().toISOString();
    const url = `${CANONICAL_BASE_URL}${cta.startsWith("/") ? cta : `/${cta}`}`;

    // ── 1. Bandeja de la app: llega al 100%, es el canal confiable ──────────
    let bandeja = 0;
    for (let i = 0; i < destinatarios.length; i += 400) {
      const lote = destinatarios.slice(i, i + 400);
      const batch = adminDb.batch();
      for (const d of lote) {
        batch.set(
          adminDb.collection("usuarios").doc(d.uid).collection("notificaciones").doc(),
          { titulo, mensaje, fecha: timestamp, tipo: "CAMPANA", leida: false, cta, fuente: `campana:${campana}` },
        );
        bandeja++;
      }
      await batch.commit();
    }

    // ── 2. Push, solo a quien tenga token ──────────────────────────────────
    const tokens = destinatarios.map((d) => d.token).filter((t): t is string => !!t);
    let pushEnviados = 0;
    for (let i = 0; i < tokens.length; i += LOTE_PUSH) {
      const lote = tokens.slice(i, i + LOTE_PUSH);
      try {
        const res = await adminMessaging.sendEachForMulticast({
          tokens: lote,
          notification: { title: titulo, body: mensaje },
          data: { type: "CAMPANA", cta, url },
          android: { priority: "high", notification: { channelId: "club_patio_marketing", icon: "ic_notification", color: "#4EAD1F" } },
          apns: { payload: { aps: { badge: 1, sound: "default" } } },
          webpush: { notification: { tag: "club-patio-campana", icon: "/Logo2.png" }, fcmOptions: { link: url } },
        });
        pushEnviados += res.successCount;
      } catch (e) {
        console.warn("[campana/notificar] push falló en un lote:", e);
      }
    }

    // ── 3. Correo: el canal que sí alcanza a todos ─────────────────────────
    const conCorreo = destinatarios.filter((d) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.correo));
    let correosEnviados = 0;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[campana/notificar] RESEND_API_KEY ausente — se omite el correo");
    } else {
      const resend = new Resend(apiKey);
      for (let i = 0; i < conCorreo.length; i += LOTE_CORREO) {
        const lote = conCorreo.slice(i, i + LOTE_CORREO);
        try {
          const { error } = await resend.batch.send(
            lote.map((d) => ({
              from: "Club Patio Curauma <soporte@synaptechspa.cl>",
              to: d.correo,
              subject: titulo,
              html: plantillaCorreo(d.nombre, titulo, mensaje, url),
            })),
          );
          if (error) console.warn("[campana/notificar] Resend:", error);
          else correosEnviados += lote.length;
        } catch (e) {
          console.warn("[campana/notificar] correo falló en un lote:", e);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      campana,
      destinatarios: destinatarios.length,
      bandeja,
      pushEnviados,
      sinToken: destinatarios.length - tokens.length,
      correosEnviados,
      sinCorreo: destinatarios.length - conCorreo.length,
    });
  } catch (error: any) {
    console.error("[campana/notificar] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
