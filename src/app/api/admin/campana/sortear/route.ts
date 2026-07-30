/**
 * POST /api/admin/campana/sortear
 *
 * Elige un ganador al azar entre los socios inscritos desde una campaña.
 * La app no tenía ninguna función de sorteo: los premios del catálogo se canjean
 * con sellos, pero no había forma de extraer un ganador entre asistentes.
 *
 * Cada extracción queda registrada en `sorteos/` con la lista de participantes
 * del momento — si alguien reclama, hay respaldo de quién estaba y cuándo.
 * Por defecto no puede salir dos veces la misma persona en la misma campaña.
 *
 * Headers: Authorization: Bearer <idToken>  (rol staff)
 * Body: { campana: string, premio?: string, permitirRepetido?: boolean }
 */

import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS, ROLES_STAFF_PANEL } from "@/lib/constants";

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
      const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
      const d = snap.exists ? snap.data()! : null;
      const rol: string = d?.rol ?? "";
      const roles: string[] = Array.isArray(d?.roles) ? d.roles : [];
      autorizado = ROLES_STAFF_PANEL.includes(rol) || roles.some((r) => ROLES_STAFF_PANEL.includes(r));
    }
    if (!autorizado) {
      return NextResponse.json({ error: "Sin permisos de staff" }, { status: 403 });
    }

    const body = await request.json();
    const campana = String(body.campana ?? "").trim();
    const premio = String(body.premio ?? "").trim() || null;
    const permitirRepetido = body.permitirRepetido === true;
    if (!campana) return NextResponse.json({ error: "Falta la campaña" }, { status: 400 });

    // Participantes: inscritos desde esa campaña, no baneados.
    const snap = await adminDb.collection("usuarios").where("campanaRegistro", "==", campana).get();
    let participantes = snap.docs
      .filter((d) => d.data().baneado !== true)
      .map((d) => ({
        uid: d.id,
        nombre: String(d.data().nombre ?? "").trim() || "socio",
        correo: String(d.data().correo ?? "").trim(),
      }));

    if (!permitirRepetido) {
      const previos = await adminDb.collection("sorteos").where("campana", "==", campana).get();
      const yaGanaron = new Set(previos.docs.map((d) => String(d.data().ganadorUid)));
      participantes = participantes.filter((p) => !yaGanaron.has(p.uid));
    }

    if (!participantes.length) {
      return NextResponse.json(
        { error: "No quedan participantes disponibles en esta campaña" },
        { status: 404 },
      );
    }

    // randomInt del módulo crypto: aleatoriedad criptográfica, no Math.random.
    const ganador = participantes[randomInt(participantes.length)];

    const registro = await adminDb.collection("sorteos").add({
      campana,
      premio,
      ganadorUid: ganador.uid,
      ganadorNombre: ganador.nombre,
      ganadorCorreo: ganador.correo,
      totalParticipantes: participantes.length,
      participantes: participantes.map((p) => p.uid),
      realizadoPor: decoded.uid,
      realizadoPorEmail: callerEmail,
      fecha: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      sorteoId: registro.id,
      ganador,
      totalParticipantes: participantes.length,
    });
  } catch (error: any) {
    console.error("[campana/sortear] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
