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
import { FieldValue } from "firebase-admin/firestore";
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
 * DELETE — anula sorteos y DEVUELVE sus premios a la cola.
 *
 * Devolver el premio no es un extra, es parte de anular: sin eso el premio
 * quedaba quemado para siempre y la cuenta dejaba de cuadrar. Pasó de verdad
 * probando —6 premios entregados contra 4 sorteos— porque anular borraba el
 * registro y dejaba huérfano el consumo.
 *
 * Con `sorteoId` anula ese; sin él, todos los de la campaña. Con
 * `reiniciarTodo` además borra el estado de la ruleta, dejándola como recién
 * instalada.
 *
 * Body: { campana: string, sorteoId?: string, reiniciarTodo?: boolean }
 */
export async function DELETE(request: Request) {
  try {
    const auth = await verificarStaff(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const campana = String(body.campana ?? "").trim().toLowerCase();
    const sorteoId = String(body.sorteoId ?? "").trim();
    const reiniciarTodo = body.reiniciarTodo === true;
    if (!campana) return NextResponse.json({ error: "Falta la campaña" }, { status: 400 });

    const aAnular = sorteoId
      ? [await adminDb.collection("sorteos").doc(sorteoId).get()].filter((s) => s.exists)
      : (await adminDb.collection("sorteos").where("campana", "==", campana).get()).docs;

    if (sorteoId) {
      if (!aAnular.length) return NextResponse.json({ error: "Ese sorteo no existe" }, { status: 404 });
      // Que un id mal copiado no borre el sorteo de otra campaña.
      if (aAnular[0].data()!.campana !== campana) {
        return NextResponse.json({ error: "El sorteo no pertenece a esa campaña" }, { status: 400 });
      }
    }

    const batch = adminDb.batch();
    const limpio = {
      estado: "disponible",
      ganadorUid: FieldValue.delete(),
      ganadorNombre: FieldValue.delete(),
      entregadoEn: FieldValue.delete(),
    };
    let devueltos = 0;

    if (reiniciarTodo) {
      // Se reponen TODOS los premios de la campaña, no solo los que tienen un
      // sorteo apuntándolos. Si un sorteo se borró antes, su premio quedó
      // huérfano —entregado y sin registro— y recorrer sorteos jamás lo
      // alcanzaría. Reiniciar significa dejar todo como nuevo.
      const todosLosPremios = await adminDb.collection("premios_campana")
        .where("campana", "==", campana).get();
      todosLosPremios.docs
        .filter((d) => d.data().estado !== "disponible")
        .forEach((d) => { batch.update(d.ref, limpio); devueltos++; });
    } else {
      for (const s of aAnular) {
        const premioId = s.data()?.premioId;
        if (premioId) {
          batch.update(adminDb.collection("premios_campana").doc(String(premioId)), limpio);
          devueltos++;
        }
      }
    }

    aAnular.forEach((s) => batch.delete(s.ref));

    // Reinicio completo: además se limpia lo que la pantalla está mostrando.
    if (reiniciarTodo) batch.delete(adminDb.collection("ruleta").doc(campana));

    if (aAnular.length || reiniciarTodo) await batch.commit();

    return NextResponse.json({ ok: true, anulados: aAnular.length, premiosDevueltos: devueltos });
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
