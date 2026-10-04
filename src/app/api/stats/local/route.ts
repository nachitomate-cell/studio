/**
 * GET /api/stats/local?localId=…&dias=30 — lo que el Club le generó a un local.
 *
 * Auth: Bearer idToken. Puede verlo el dueño del local (su uid es el id del
 * perfil, o el perfil lo tiene en `userId`) o el staff del Club.
 *
 * Devuelve totales y serie diaria de:
 *   - apariciones, vistas y toques (stats_locales, ver /api/stats/evento),
 *   - sellos entregados y clientes distintos (usuarios/{vendedor}/ventas_registradas,
 *     donde escriben todos los flujos de sello y donde anular-sello corrige).
 * `medidoDesde` es el primer día con datos: la medición empezó en octubre 2026
 * y el panel tiene que decirlo para no sugerir que antes no hubo visitas.
 */

import { NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS } from "@/lib/constants";
import { getUserRoles } from "@/lib/roles";

const ROLES_STAFF = ["moderador", "admin", "director", "director_patio"];
const COLECCION = process.env.NODE_ENV === "production" ? "stats_locales" : "stats_locales_dev";
const TIPOS = ["impresion", "vista", "whatsapp", "instagram", "mapa", "contacto", "bioo"] as const;
// Sellos que no los dio el local en su caja.
const METODOS_NO_LOCAL = new Set(["BIENVENIDA", "REFERIDO", "SISTEMA", "MODERADOR_GRANT"]);

function fechaChile(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
}

export async function GET(request: Request) {
  try {
    const idToken = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const url = new URL(request.url);
    const localId = url.searchParams.get("localId") ?? "";
    const dias = Math.min(90, Math.max(7, Number(url.searchParams.get("dias")) || 30));
    if (!/^[A-Za-z0-9_-]{2,80}$/.test(localId)) {
      return NextResponse.json({ error: "Local inválido" }, { status: 400 });
    }

    const perfil = await adminDb.collection("entrepreneur_profiles").doc(localId).get();
    if (!perfil.exists) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
    const vendedorUid: string = perfil.data()?.userId || localId;

    // Autorización: dueño o staff
    let autorizado = decoded.uid === localId || decoded.uid === vendedorUid;
    if (!autorizado) {
      const caller = await adminDb.collection("usuarios").doc(decoded.uid).get();
      autorizado =
        ALLOWED_MOD_EMAILS.includes((decoded.email ?? "").toLowerCase()) ||
        getUserRoles(caller.exists ? caller.data() : null).some((r) => ROLES_STAFF.includes(r));
    }
    if (!autorizado) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const desde = fechaChile(new Date(Date.now() - (dias - 1) * 86_400_000));

    // ── Directorio: un doc por día ──
    const diasSnap = await adminDb
      .collection(COLECCION).doc(localId).collection("dias")
      .where(FieldPath.documentId(), ">=", desde)
      .get();

    const serie: Record<string, Record<string, number>> = {};
    const totales: Record<string, number> = Object.fromEntries(TIPOS.map((t) => [t, 0]));
    for (const d of diasSnap.docs) {
      const data = d.data();
      serie[d.id] = {};
      for (const t of TIPOS) {
        const n = typeof data[t] === "number" ? data[t] : 0;
        serie[d.id][t] = n;
        totales[t] += n;
      }
    }

    // ── Sellos entregados en el mismo período ──
    // Rango sobre un solo campo dentro de la subcolección del local: no necesita
    // índice compuesto. `fecha` es ISO UTC; se compara desde el inicio del día
    // en UTC, que en Chile cae unas horas antes: diferencia despreciable en 30 días.
    const ventasSnap = await adminDb
      .collection("usuarios").doc(vendedorUid).collection("ventas_registradas")
      .where("fecha", ">=", `${desde}T00:00:00`)
      .get();

    let sellos = 0;
    const clientes = new Set<string>();
    for (const v of ventasSnap.docs) {
      const data = v.data();
      if (data.anulada === true) continue;
      if (data.metodo && METODOS_NO_LOCAL.has(data.metodo)) continue;
      sellos += typeof data.numSellos === "number" && data.numSellos > 0 ? data.numSellos : 1;
      if (data.clienteId) clientes.add(data.clienteId);
      const dia = typeof data.fecha === "string" ? fechaChile(new Date(data.fecha)) : null;
      if (dia && dia >= desde) {
        serie[dia] = serie[dia] ?? {};
        serie[dia].sellos = (serie[dia].sellos ?? 0) + 1;
      }
    }

    // Primer día con datos de directorio (de toda la historia, no solo del período)
    const primero = await adminDb
      .collection(COLECCION).doc(localId).collection("dias")
      .orderBy(FieldPath.documentId()).limit(1).get();

    return NextResponse.json({
      localId,
      dias,
      desde,
      medidoDesde: primero.empty ? null : primero.docs[0].id,
      totales: { ...totales, sellos, clientes: clientes.size },
      serie,
    });
  } catch (error) {
    console.error("[stats/local]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
