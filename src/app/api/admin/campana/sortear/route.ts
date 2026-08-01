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

/** Autenticación + rol staff. Devuelve el uid y el email del que llama. */
async function verificarStaff(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false as const, error: "No autorizado", status: 401 };
  }
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
  } catch {
    return { ok: false as const, error: "Token inválido", status: 401 };
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
  if (!autorizado) return { ok: false as const, error: "Sin permisos de staff", status: 403 };
  return { ok: true as const, uid: decoded.uid, email: callerEmail };
}

/**
 * DELETE — anula un sorteo.
 *
 * Con `sorteoId` borra ese registro; sin él, borra TODOS los de la campaña.
 * Sirve para dejar la campaña limpia mientras se prueba: al no quedar registro,
 * la persona vuelve a entrar al bombo y la pantalla del stand deja de mostrar
 * un ganador.
 *
 * Body: { campana: string, sorteoId?: string }
 */
export async function DELETE(request: Request) {
  try {
    const auth = await verificarStaff(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const campana = String(body.campana ?? "").trim().toLowerCase();
    const sorteoId = String(body.sorteoId ?? "").trim();
    if (!campana) return NextResponse.json({ error: "Falta la campaña" }, { status: 400 });

    if (sorteoId) {
      const ref = adminDb.collection("sorteos").doc(sorteoId);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: "Ese sorteo no existe" }, { status: 404 });
      // Que el id no permita borrar sorteos de otra campaña por equivocación.
      if (snap.data()!.campana !== campana) {
        return NextResponse.json({ error: "El sorteo no pertenece a esa campaña" }, { status: 400 });
      }
      await ref.delete();
      return NextResponse.json({ ok: true, anulados: 1 });
    }

    const todos = await adminDb.collection("sorteos").where("campana", "==", campana).get();
    if (todos.empty) return NextResponse.json({ ok: true, anulados: 0 });
    const batch = adminDb.batch();
    todos.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return NextResponse.json({ ok: true, anulados: todos.size });
  } catch (error: any) {
    console.error("[campana/sortear DELETE] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verificarStaff(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const decoded = { uid: auth.uid };
    const callerEmail = auth.email;

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

    // ── Consumir un premio de la cola ────────────────────────────────────────
    // Va en transacción para que dos sorteos disparados a la vez —dos personas
    // tocando el botón, o un doble toque en un celular— no entreguen la misma
    // caja de vino dos veces.
    let premioEntregado: string | null = premio;
    let premioId: string | null = null;
    if (!premio) {
      const cola = adminDb.collection("premios_campana")
        .where("campana", "==", campana)
        .where("estado", "==", "disponible");
      try {
        const asignado = await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(cola);
          if (snap.empty) return null;
          // El más antiguo primero: la cola se respeta en el orden en que se cargó.
          const doc = snap.docs.sort((a, b) =>
            String(a.data().creadoEn).localeCompare(String(b.data().creadoEn)))[0];
          tx.update(doc.ref, {
            estado: "entregado",
            ganadorUid: ganador.uid,
            ganadorNombre: ganador.nombre,
            entregadoEn: new Date().toISOString(),
          });
          return { id: doc.id, nombre: String(doc.data().nombre) };
        });
        if (asignado) { premioEntregado = asignado.nombre; premioId = asignado.id; }
      } catch (e) {
        console.warn("[campana/sortear] no se pudo consumir premio de la cola:", e);
      }
    }

    const registro = await adminDb.collection("sorteos").add({
      campana,
      premio: premioEntregado,
      premioId,
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
      premio: premioEntregado,
      totalParticipantes: participantes.length,
    });
  } catch (error: any) {
    console.error("[campana/sortear] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
