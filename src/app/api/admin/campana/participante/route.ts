/**
 * DELETE /api/admin/campana/participante
 *
 * Saca a alguien de una campaña. Dos modos, porque las pruebas y la operación
 * real necesitan cosas distintas:
 *
 *   modo "sacar"    → borra el campo campanaRegistro. La cuenta queda intacta,
 *                     solo deja de participar en el sorteo. Es lo reversible.
 *   modo "eliminar" → borra la cuenta completa (Firestore + Authentication).
 *                     Necesario al probar, porque si la cuenta sigue existiendo
 *                     no se puede volver a registrar el mismo correo.
 *
 * El modo destructivo exige estar en la allowlist de correos, no basta el rol:
 * borrar cuentas de socios reales no es algo que deba poder hacer cualquier
 * moderador desde un panel de eventos.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body: { uid: string, campana: string, eliminarCuenta?: boolean }
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS, ROLES_STAFF_PANEL } from "@/lib/constants";

export async function DELETE(request: Request) {
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
    const enAllowlist = ALLOWED_MOD_EMAILS.includes(callerEmail);
    let esStaff = enAllowlist;
    if (!esStaff) {
      const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
      const d = snap.exists ? snap.data()! : null;
      const rol: string = d?.rol ?? "";
      const roles: string[] = Array.isArray(d?.roles) ? d.roles : [];
      esStaff = ROLES_STAFF_PANEL.includes(rol) || roles.some((r) => ROLES_STAFF_PANEL.includes(r));
    }
    if (!esStaff) return NextResponse.json({ error: "Sin permisos de staff" }, { status: 403 });

    const body = await request.json();
    const uid = String(body.uid ?? "").trim();
    const campana = String(body.campana ?? "").trim().toLowerCase();
    const eliminarCuenta = body.eliminarCuenta === true;
    if (!uid || !campana) {
      return NextResponse.json({ error: "Faltan uid o campana" }, { status: 400 });
    }

    const ref = adminDb.collection("usuarios").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "El usuario no existe" }, { status: 404 });
    // Que un uid mal copiado no saque a alguien de otra campaña.
    if (snap.data()!.campanaRegistro !== campana) {
      return NextResponse.json({ error: "Esa persona no pertenece a la campaña" }, { status: 400 });
    }

    if (!eliminarCuenta) {
      await ref.update({
        campanaRegistro: FieldValue.delete(),
        campanaRegistroEn: FieldValue.delete(),
      });
      return NextResponse.json({ ok: true, modo: "sacado" });
    }

    if (!enAllowlist) {
      return NextResponse.json(
        { error: "Eliminar cuentas requiere un correo autorizado" },
        { status: 403 },
      );
    }

    // Firestore primero: si Auth falla queda una cuenta sin perfil, que es
    // menos dañino que un perfil apuntando a una cuenta que ya no existe.
    await ref.delete();
    try {
      await adminAuth.deleteUser(uid);
    } catch (e: any) {
      console.warn("[campana/participante] Auth no pudo borrarse:", e?.message);
      return NextResponse.json({
        ok: true, modo: "eliminado_parcial",
        aviso: "Se borró el perfil pero la cuenta de acceso sigue existiendo.",
      });
    }

    return NextResponse.json({ ok: true, modo: "eliminado" });
  } catch (error: any) {
    console.error("[campana/participante] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
