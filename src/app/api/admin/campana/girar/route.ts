/**
 * POST /api/admin/campana/girar
 *
 * Sortea un premio entre los inscritos de la campaña y avisa al ganador.
 *
 * Los premios ya NO salen de una cola en Firestore: llegan en el cuerpo de la
 * petición, tal como están puestos en la rueda que el público está mirando. Es
 * la única forma de garantizar que lo que se entrega es lo que se ve — con una
 * cola aparte, editar la rueda y editar los premios eran dos cosas distintas y
 * bastaba olvidar una para que la rueda mostrara algo y se entregara otra cosa.
 *
 * El GANADOR y el SEGMENTO los decide el servidor, no la animación. Si la rueda
 * decidiera, el resultado dependería de dónde frena un navegador: imposible de
 * auditar y trivial de manipular. La rueda solo pone en escena un resultado que
 * ya está tomado y escrito.
 *
 * Se sortea entre quienes se inscribieron por la campaña y todavía no han
 * ganado nada, para que nadie se lleve dos premios mientras otros miran.
 *
 * Headers: Authorization: Bearer <idToken> (rol staff)
 * Body: { campana, bloques: string[], minutos?: number }
 */

import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS, ROLES_STAFF_PANEL } from "@/lib/constants";
import { avisarGanador } from "@/lib/avisarGanador";

/** Plazo por defecto para retirar, en minutos. */
const MINUTOS_POR_DEFECTO = 30;

export async function POST(request: Request) {
  try {
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
      const s = await adminDb.collection("usuarios").doc(decoded.uid).get();
      const d = s.exists ? s.data()! : null;
      const rol: string = d?.rol ?? "";
      const roles: string[] = Array.isArray(d?.roles) ? d.roles : [];
      autorizado = ROLES_STAFF_PANEL.includes(rol) || roles.some((r) => ROLES_STAFF_PANEL.includes(r));
    }
    if (!autorizado) return NextResponse.json({ error: "Sin permisos de staff" }, { status: 403 });

    const body = await request.json();
    const campana = String(body.campana ?? "").trim().toLowerCase();
    if (!campana) return NextResponse.json({ error: "Falta la campaña" }, { status: 400 });

    const bloques: string[] = Array.isArray(body.bloques)
      ? body.bloques.map((b: unknown) => String(b ?? "").trim()).filter(Boolean)
      : [];
    if (bloques.length < 2) {
      return NextResponse.json({ error: "La ruleta necesita al menos 2 premios" }, { status: 400 });
    }

    const minutos = Number.isFinite(Number(body.minutos))
      ? Math.max(5, Math.min(240, Math.round(Number(body.minutos))))
      : MINUTOS_POR_DEFECTO;

    // ── Participantes que aún no han ganado ─────────────────────────────────
    const [socios, previos] = await Promise.all([
      adminDb.collection("usuarios").where("campanaRegistro", "==", campana).get(),
      adminDb.collection("sorteos").where("campana", "==", campana).get(),
    ]);
    const yaGanaron = new Set(previos.docs.map((d) => String(d.data().ganadorUid)));
    const participantes = socios.docs
      .filter((d) => d.data().baneado !== true && !yaGanaron.has(d.id))
      .map((d) => ({
        uid: d.id,
        nombre: String(d.data().nombre ?? "").trim() || "socio",
        correo: String(d.data().correo ?? "").trim(),
      }));

    if (!participantes.length) {
      return NextResponse.json(
        { error: "No quedan inscritos sin premio. Todos los registrados ya ganaron algo." },
        { status: 409 },
      );
    }

    // ── El sorteo ───────────────────────────────────────────────────────────
    // randomInt del módulo crypto y no Math.random: un sorteo con premios de
    // verdad tiene que poder defenderse si alguien pregunta cómo se decidió.
    const indiceGanador = randomInt(bloques.length);
    const premio = bloques[indiceGanador];
    const ganador = participantes[randomInt(participantes.length)];

    const ahora = new Date();
    const expira = new Date(ahora.getTime() + minutos * 60_000);

    const sorteo = await adminDb.collection("sorteos").add({
      campana,
      premio,
      ganadorUid: ganador.uid,
      ganadorNombre: ganador.nombre,
      ganadorCorreo: ganador.correo,
      totalParticipantes: participantes.length,
      participantes: participantes.map((p) => p.uid),
      realizadoPor: decoded.uid,
      realizadoPorEmail: callerEmail,
      viaRuleta: true,
      // El plazo queda escrito en el sorteo, no solo en el mensaje: es lo que
      // permite después distinguir un premio no retirado de uno entregado.
      minutosRetiro: minutos,
      expiraEn: expira.toISOString(),
      retirado: false,
      fecha: ahora.toISOString(),
    });

    // ── Avisar al ganador ───────────────────────────────────────────────────
    // Va acá y no en una llamada aparte: la ruleta sortea sola y no hay nadie
    // escribiendo un mensaje. Nunca puede tumbar el sorteo ya escrito, porque
    // avisarGanador no lanza.
    const aviso = await avisarGanador({
      uid: ganador.uid,
      nombre: ganador.nombre,
      correo: ganador.correo,
      premio,
      minutos,
      expiraEn: expira.toISOString(),
    });
    if (aviso.detalle) console.warn("[campana/girar] aviso parcial:", aviso.detalle);

    return NextResponse.json({
      ok: true,
      sorteoId: sorteo.id,
      indiceGanador,
      premio,
      ganador: { nombre: ganador.nombre, pila: ganador.nombre.split(/\s+/)[0], correo: ganador.correo },
      participantes: participantes.length,
      quedan: participantes.length - 1,
      minutos,
      expiraEn: expira.toISOString(),
      aviso,
    });
  } catch (error: any) {
    console.error("[campana/girar] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
