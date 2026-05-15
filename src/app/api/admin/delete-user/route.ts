/**
 * POST /api/admin/delete-user
 *
 * Elimina un usuario cliente completamente:
 * - Borra usuarios/{userId} de Firestore
 * - Borra el usuario de Firebase Authentication
 *
 * Solo ejecutable por los emails moderadores autorizados.
 * Body: { userId: string, idToken: string }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

import { ALLOWED_MOD_EMAILS as ALLOWED_EMAILS } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const { userId, idToken } = await request.json();

    if (!userId || !idToken) {
      return NextResponse.json({ error: "Faltan parámetros: userId, idToken" }, { status: 400 });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const callerEmail = (decoded.email ?? "").trim().toLowerCase();
    if (!ALLOWED_EMAILS.includes(callerEmail)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Borrar de Firestore primero — si falla, abortar para evitar zombie records
    try {
      await adminDb.collection("usuarios").doc(userId).delete();
    } catch (e: any) {
      console.error("[delete-user] Firestore delete failed:", e);
      return NextResponse.json({ error: "No se pudo eliminar el registro del usuario" }, { status: 500 });
    }

    // Borrar de Firebase Auth — Firestore ya fue eliminado correctamente
    try {
      await adminAuth.deleteUser(userId);
    } catch (e: any) {
      if (e.code !== "auth/user-not-found") {
        console.error("[delete-user] Auth delete failed:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[delete-user] Error inesperado:", error);
    return NextResponse.json({ error: error.message ?? "Error interno" }, { status: 500 });
  }
}
