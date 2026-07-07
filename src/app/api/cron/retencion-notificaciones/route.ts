/**
 * GET /api/cron/retencion-notificaciones
 *
 * Cron diario de retención de la bandeja de mensajes. Objetivo: evitar que un
 * cliente acumule cientos de notificaciones — con los push diarios + eventos
 * (sellos, premios, referidos) se llegaba a 100+ por usuario.
 *
 * Regla:
 *   - Máximo 5 notificaciones por usuario.
 *   - Solo se borran notificaciones con más de 7 días de antigüedad.
 *   - Las < 7 días son intocables (aun si el total queda > 5 temporalmente).
 *   - Dentro de las viejas, priorizamos conservar las NO leídas (por si el
 *     cliente aún no vio una alerta importante).
 *
 * Ejemplo: 3 recientes + 40 viejas → conserva las 3 recientes + 2 viejas
 * (priorizando no-leídas) = 5 totales. Se borran 38.
 *
 * Protegido con CRON_SECRET. Horario: 07:00 UTC = ~04:00 Chile (baja actividad).
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const MAX_POR_USUARIO = 5;
const EDAD_MINIMA_DIAS = 7;
const BATCH_DELETE_SIZE = 400;   // Firestore permite 500; margen por si escalamos
const USER_CONCURRENCY  = 20;    // usuarios procesados en paralelo por lote

async function procesarUsuario(userRef: FirebaseFirestore.DocumentReference, cutoffISO: string): Promise<number> {
  const snap = await userRef.collection("notificaciones").orderBy("fecha", "desc").get();
  if (snap.size <= MAX_POR_USUARIO) return 0;

  const recientes: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  const viejas:    FirebaseFirestore.QueryDocumentSnapshot[] = [];
  for (const doc of snap.docs) {
    const fecha = doc.data().fecha;
    if (typeof fecha === "string" && fecha >= cutoffISO) recientes.push(doc);
    else viejas.push(doc);
  }

  const slotsViejas = Math.max(0, MAX_POR_USUARIO - recientes.length);
  if (viejas.length <= slotsViejas) return 0;

  // Priorizar: no-leídas primero (dentro de ellas la más reciente gana), luego
  // leídas más recientes. Fecha es ISO string → orden lexicográfico es cronológico.
  const viejasOrdenadas = [...viejas].sort((a, b) => {
    const la = a.data().leida ? 1 : 0;
    const lb = b.data().leida ? 1 : 0;
    if (la !== lb) return la - lb;
    return (b.data().fecha ?? "").localeCompare(a.data().fecha ?? "");
  });

  const aConservar = new Set(viejasOrdenadas.slice(0, slotsViejas).map(d => d.id));
  const aBorrar = viejas.filter(d => !aConservar.has(d.id));

  for (let i = 0; i < aBorrar.length; i += BATCH_DELETE_SIZE) {
    const batch = adminDb.batch();
    for (const d of aBorrar.slice(i, i + BATCH_DELETE_SIZE)) batch.delete(d.ref);
    await batch.commit();
  }

  return aBorrar.length;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inicio = Date.now();
  const cutoffISO = new Date(Date.now() - EDAD_MINIMA_DIAS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const userRefs = await adminDb.collection("usuarios").listDocuments();
    let usuariosProcesados = 0;
    let usuariosAfectados  = 0;
    let notifsBorradas     = 0;
    const errores: string[] = [];

    for (let i = 0; i < userRefs.length; i += USER_CONCURRENCY) {
      const lote = userRefs.slice(i, i + USER_CONCURRENCY);
      const resultados = await Promise.allSettled(
        lote.map(ref => procesarUsuario(ref, cutoffISO))
      );
      for (let j = 0; j < resultados.length; j++) {
        const r = resultados[j];
        usuariosProcesados++;
        if (r.status === "fulfilled") {
          if (r.value > 0) { usuariosAfectados++; notifsBorradas += r.value; }
        } else {
          errores.push(`${lote[j].id}: ${r.reason?.message ?? r.reason}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      usuariosProcesados,
      usuariosAfectados,
      notifsBorradas,
      erroresCount: errores.length,
      erroresSample: errores.slice(0, 5),
      durationMs: Date.now() - inicio,
      cutoffISO,
      maxPorUsuario: MAX_POR_USUARIO,
    });
  } catch (e: any) {
    console.error("[retencion-notificaciones] Error fatal:", e);
    return NextResponse.json(
      { error: e?.message ?? "Error interno", durationMs: Date.now() - inicio },
      { status: 500 }
    );
  }
}
