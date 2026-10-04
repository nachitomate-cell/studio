/**
 * POST /api/stats/evento — recibe lotes de eventos del directorio (ver src/lib/statsLocal.ts).
 *
 * Body: { eventos: [{ localId, tipo }] }  (máx 60)
 *
 * Escribe con Admin SDK en stats_locales/{localId}/dias/{YYYY-MM-DD hora Chile},
 * un contador por tipo con increment(). Sin reglas de Firestore para esa
 * colección: los clientes no pueden leerla ni escribirla directo, solo por aquí
 * (escritura) y por /api/stats/local (lectura del dueño o staff).
 *
 * Es público a propósito (los socios no siempre tienen sesión), así que:
 *   - solo acepta los tipos conocidos,
 *   - solo cuenta locales que existen en entrepreneur_profiles (cacheado),
 *   - una escritura por local por request, aunque el lote traiga varios eventos.
 *
 * En desarrollo escribe en stats_locales_dev: el entorno local apunta al
 * Firestore real y las pruebas no deben ensuciar los números de los locales.
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const TIPOS = new Set(["impresion", "vista", "whatsapp", "instagram", "mapa", "contacto", "bioo"]);
const ID_VALIDO = /^[A-Za-z0-9_-]{2,80}$/;
const COLECCION = process.env.NODE_ENV === "production" ? "stats_locales" : "stats_locales_dev";

// Cache por instancia de qué locales existen (10 min), para no leer el perfil en cada evento.
const existe = new Map<string, { ok: boolean; hasta: number }>();
async function localExiste(id: string): Promise<boolean> {
  const c = existe.get(id);
  if (c && c.hasta > Date.now()) return c.ok;
  let ok = false;
  try {
    ok = (await adminDb.collection("entrepreneur_profiles").doc(id).get()).exists;
  } catch {
    return false;
  }
  existe.set(id, { ok, hasta: Date.now() + 10 * 60 * 1000 });
  return ok;
}

/** Fecha de hoy en Chile (YYYY-MM-DD). La hora del servidor es UTC. */
function hoyChile(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const eventos: unknown[] = Array.isArray(body?.eventos) ? body.eventos.slice(0, 60) : [];

    // Agrupar: { localId: { tipo: n } }
    const porLocal = new Map<string, Record<string, number>>();
    for (const e of eventos) {
      const { localId, tipo } = (e ?? {}) as { localId?: unknown; tipo?: unknown };
      if (typeof localId !== "string" || !ID_VALIDO.test(localId)) continue;
      if (typeof tipo !== "string" || !TIPOS.has(tipo)) continue;
      const cuenta = porLocal.get(localId) ?? {};
      // Una persona no puede sumar más de 1 por tipo y local en un mismo lote.
      cuenta[tipo] = 1;
      porLocal.set(localId, cuenta);
    }

    const fecha = hoyChile();
    await Promise.all(
      [...porLocal.entries()].map(async ([localId, cuenta]) => {
        if (!(await localExiste(localId))) return;
        const incrementos: Record<string, unknown> = { fecha, actualizado: FieldValue.serverTimestamp() };
        for (const [tipo, n] of Object.entries(cuenta)) incrementos[tipo] = FieldValue.increment(n);
        await adminDb.collection(COLECCION).doc(localId).collection("dias").doc(fecha).set(incrementos, { merge: true });
      })
    );

    // 204: sendBeacon no lee la respuesta.
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[stats/evento]", error);
    return new NextResponse(null, { status: 204 }); // nunca devolver error al cliente por esto
  }
}
