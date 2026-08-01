/**
 * Premios del momento de una campaña — la cola que consume el sorteo.
 *
 * Cada documento es UNA unidad de premio, no un tipo con stock. Si hay tres
 * cajas de vino, son tres documentos: así "quemar" un premio es marcar uno solo
 * y no hay que llevar contadores que se desincronizan cuando algo falla a
 * medio camino.
 *
 * GET    ?campana=x   → lista (disponibles y entregados)
 * POST   { campana, nombre, cantidad? }  → agrega N unidades
 * DELETE { campana, id }                 → borra uno disponible
 *
 * Headers: Authorization: Bearer <idToken> (rol staff)
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS, ROLES_STAFF_PANEL } from "@/lib/constants";

const MAX_UNIDADES = 50;

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
  const email = (decoded.email ?? "").trim().toLowerCase();
  let ok = ALLOWED_MOD_EMAILS.includes(email);
  if (!ok) {
    const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const d = snap.exists ? snap.data()! : null;
    const rol: string = d?.rol ?? "";
    const roles: string[] = Array.isArray(d?.roles) ? d.roles : [];
    ok = ROLES_STAFF_PANEL.includes(rol) || roles.some((r) => ROLES_STAFF_PANEL.includes(r));
  }
  if (!ok) return { ok: false as const, error: "Sin permisos de staff", status: 403 };
  return { ok: true as const, uid: decoded.uid, email };
}

export async function GET(request: Request) {
  try {
    const auth = await verificarStaff(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const campana = (new URL(request.url).searchParams.get("campana") ?? "").trim().toLowerCase();
    if (!campana) return NextResponse.json({ error: "Falta la campaña" }, { status: 400 });

    const snap = await adminDb.collection("premios_campana").where("campana", "==", campana).get();
    const premios = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => String(a.creadoEn).localeCompare(String(b.creadoEn)));

    return NextResponse.json({
      premios,
      disponibles: premios.filter((p) => p.estado === "disponible").length,
    });
  } catch (error: any) {
    console.error("[campana/premios GET]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verificarStaff(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const campana = String(body.campana ?? "").trim().toLowerCase();
    const nombre = String(body.nombre ?? "").trim().slice(0, 60);
    const cantidad = Math.max(1, Math.min(MAX_UNIDADES, Number(body.cantidad) || 1));
    if (!campana || !nombre) {
      return NextResponse.json({ error: "Falta la campaña o el nombre" }, { status: 400 });
    }

    const ahora = new Date().toISOString();
    const batch = adminDb.batch();
    for (let i = 0; i < cantidad; i++) {
      batch.set(adminDb.collection("premios_campana").doc(), {
        campana,
        nombre,
        estado: "disponible",
        // Milisegundo distinto por unidad para que el orden de la cola sea estable.
        creadoEn: new Date(Date.parse(ahora) + i).toISOString(),
        creadoPor: auth.email,
      });
    }
    await batch.commit();

    return NextResponse.json({ ok: true, agregados: cantidad });
  } catch (error: any) {
    console.error("[campana/premios POST]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await verificarStaff(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const campana = String(body.campana ?? "").trim().toLowerCase();
    const id = String(body.id ?? "").trim();
    if (!campana || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

    const ref = adminDb.collection("premios_campana").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "No existe" }, { status: 404 });
    const d = snap.data()!;
    if (d.campana !== campana) {
      return NextResponse.json({ error: "El premio no es de esa campaña" }, { status: 400 });
    }
    // Un premio ya entregado es historial: borrarlo dejaría a un ganador sin
    // respaldo de qué se llevó.
    if (d.estado !== "disponible") {
      return NextResponse.json({ error: "Ese premio ya fue entregado" }, { status: 409 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[campana/premios DELETE]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
