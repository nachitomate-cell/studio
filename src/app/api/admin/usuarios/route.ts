/**
 * GET /api/admin/usuarios
 *
 * Devuelve todos los usuarios de la colección 'usuarios' usando Admin SDK,
 * saltando las reglas de seguridad de Firestore del cliente.
 *
 * Requiere header: Authorization: Bearer <idToken>
 * Solo accesible por: email admin o rol staff (moderador/director/admin)
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const ROLES_STAFF = ["moderador", "admin", "director", "director_patio"];
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "ignaciiio.mate@gmail.com";

export async function GET(request: Request) {
  try {
    const idToken = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar token
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (tokenError) {
      console.error("[admin/usuarios] Token inválido:", tokenError);
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // Verificar que es staff o admin email
    const callerDoc  = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : null;
    const callerRol  = callerData?.rol ?? "";
    const isAdmin    = decoded.email === ADMIN_EMAIL;

    if (!isAdmin && !ROLES_STAFF.includes(callerRol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // Traer todos los usuarios
    const snap     = await adminDb.collection("usuarios").get();
    const usuarios = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ usuarios });
  } catch (error: unknown) {
    // Logea el error real en la terminal del servidor para facilitar el diagnóstico
    console.error("[admin/usuarios] Error interno:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
