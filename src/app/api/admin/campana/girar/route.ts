/**
 * POST /api/admin/campana/girar
 *
 * Dispara un giro de la ruleta: extrae ganador, elige un premio y deja el
 * resultado en `ruleta/{campana}` para que la pantalla lo escuche y gire.
 *
 * A diferencia de /sortear, acá el premio se elige AL AZAR entre los
 * disponibles y no por orden de cola. Es coherencia con lo que se ve: si la
 * rueda muestra premios y se detiene en uno, ese tiene que ser el que se
 * entrega. Una rueda que gira sobre premios pero entrega "el más antiguo"
 * estaría mintiendo a la vista de todos.
 *
 * El estado se escribe en un documento aparte y no se deduce de `sorteos`
 * porque la pantalla necesita saber TAMBIÉN qué segmentos había en la rueda
 * en ese momento — si no, no puede aterrizar donde corresponde.
 *
 * Headers: Authorization: Bearer <idToken> (rol staff)
 * Body: { campana: string }
 */

import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS, ROLES_STAFF_PANEL } from "@/lib/constants";

/**
 * Segmentos de la rueda. Con 10 cada porción es de 36°: el nombre queda tan
 * angosto que hay que partirlo en trozos ilegibles. Con 6 la porción es de 60°
 * y el premio entra completo, que es lo que la gente tiene que poder leer.
 */
const MAX_SEGMENTOS = 6;

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
      return NextResponse.json({ error: "No quedan participantes sin premio" }, { status: 404 });
    }

    // ── Premios disponibles ─────────────────────────────────────────────────
    const dispSnap = await adminDb.collection("premios_campana")
      .where("campana", "==", campana).where("estado", "==", "disponible").get();
    if (dispSnap.empty) {
      return NextResponse.json({ error: "No quedan premios en la cola" }, { status: 404 });
    }
    const disponibles = dispSnap.docs
      .map((d) => ({ id: d.id, nombre: String(d.data().nombre) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    // La rueda muestra hasta MAX_SEGMENTOS. El premio elegido siempre entra.
    const elegido = disponibles[randomInt(disponibles.length)];
    const otros = disponibles.filter((p) => p.id !== elegido.id).slice(0, MAX_SEGMENTOS - 1);
    const segmentos = [elegido, ...otros];
    // Se mezcla para que el ganador no quede siempre en la misma posición.
    for (let i = segmentos.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [segmentos[i], segmentos[j]] = [segmentos[j], segmentos[i]];
    }
    const indiceGanador = segmentos.findIndex((p) => p.id === elegido.id);

    const ganador = participantes[randomInt(participantes.length)];
    const ahora = new Date().toISOString();

    // ── Consumir el premio de forma atómica ─────────────────────────────────
    const premioRef = adminDb.collection("premios_campana").doc(elegido.id);
    try {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(premioRef);
        if (!snap.exists || snap.data()!.estado !== "disponible") {
          throw new Error("El premio ya fue entregado");
        }
        tx.update(premioRef, {
          estado: "entregado",
          ganadorUid: ganador.uid,
          ganadorNombre: ganador.nombre,
          entregadoEn: ahora,
        });
      });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? "No se pudo asignar el premio" }, { status: 409 });
    }

    const sorteo = await adminDb.collection("sorteos").add({
      campana,
      premio: elegido.nombre,
      premioId: elegido.id,
      ganadorUid: ganador.uid,
      ganadorNombre: ganador.nombre,
      ganadorCorreo: ganador.correo,
      totalParticipantes: participantes.length,
      participantes: participantes.map((p) => p.uid),
      realizadoPor: decoded.uid,
      realizadoPorEmail: callerEmail,
      viaRuleta: true,
      fecha: ahora,
    });

    // Estado para la pantalla. `iniciadoEn` es lo que dispara el giro: cada
    // valor nuevo es una orden de girar.
    await adminDb.collection("ruleta").doc(campana).set({
      campana,
      sorteoId: sorteo.id,
      segmentos: segmentos.map((p) => p.nombre),
      indiceGanador,
      premio: elegido.nombre,
      ganadorNombre: ganador.nombre,
      ganadorPila: ganador.nombre.split(/\s+/)[0],
      quedan: disponibles.length - 1,
      iniciadoEn: ahora,
    });

    return NextResponse.json({
      ok: true,
      sorteoId: sorteo.id,
      ganador,
      premio: elegido.nombre,
      quedan: disponibles.length - 1,
    });
  } catch (error: any) {
    console.error("[campana/girar] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
