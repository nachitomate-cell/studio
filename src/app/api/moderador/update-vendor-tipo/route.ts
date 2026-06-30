/**
 * POST /api/moderador/update-vendor-tipo
 *
 * Cambia el `tipo` de un local existente (emprendedor / asociado / membresia).
 * Solo staff (moderador/admin/director). Actualiza entrepreneur_profiles/{vendorId}.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { vendorId: string, tipo: "emprendedor" | "asociado" | "membresia" }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ADMIN_EMAIL, ALLOWED_MOD_EMAILS } from "@/lib/constants";
import type { TipoComercio } from "@/lib/tipoComercio";

const ROLES_PERMITIDOS = ["admin", "director", "director_patio", "moderador"];
const TIPOS_VALIDOS: TipoComercio[] = ["emprendedor", "asociado", "membresia"];

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

    const callerDoc = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : null;
    const callerRol: string = callerData?.rol ?? "";
    const callerRoles: string[] = Array.isArray(callerData?.roles) ? callerData!.roles : [];
    const callerEmail = (decoded.email ?? "").trim().toLowerCase();

    const hasPermission =
      ROLES_PERMITIDOS.includes(callerRol) ||
      callerRoles.some((r: string) => ROLES_PERMITIDOS.includes(r)) ||
      callerEmail === ADMIN_EMAIL ||
      ALLOWED_MOD_EMAILS.includes(callerEmail);

    if (!hasPermission) {
      return NextResponse.json({ error: "No tienes permisos de moderador." }, { status: 403 });
    }

    const body = await request.json();
    const vendorId: string = (body.vendorId ?? "").trim();
    const tipoRaw: string = (body.tipo ?? "").trim();
    if (!vendorId) {
      return NextResponse.json({ error: "vendorId requerido" }, { status: 400 });
    }
    if (!(TIPOS_VALIDOS as string[]).includes(tipoRaw)) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }
    const tipo = tipoRaw as TipoComercio;

    const ref = adminDb.collection("entrepreneur_profiles").doc(vendorId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Local no encontrado." }, { status: 404 });
    }

    await ref.update({
      tipo,
      tipoUpdatedAt: new Date().toISOString(),
      tipoUpdatedBy: decoded.uid,
    });

    return NextResponse.json({ ok: true, vendorId, tipo });
  } catch (error: any) {
    console.error("[update-vendor-tipo] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
