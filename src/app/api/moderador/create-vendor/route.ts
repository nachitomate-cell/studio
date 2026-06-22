/**
 * POST /api/moderador/create-vendor
 *
 * Alta rápida de un emprendedor y su local en un solo paso:
 *   - Paso A: obtiene (o crea) el usuario de Auth por email.
 *   - Paso B: batch atómico → rol 'emprendedor' en usuarios/{uid} +
 *             perfil del local en entrepreneur_profiles/{uid}.
 *
 * NOTA DE INTEGRACIÓN: el vendorId ES el uid del usuario. El escáner del cliente
 * busca `entrepreneur_profiles/{uid}` y el panel /validar usa `user.uid` como
 * vendorId, así que el documento del perfil debe indexarse por el uid.
 *
 * Seguridad: requiere `Authorization: Bearer <idToken>` de un moderador/admin.
 * Body: { email, nombreLocal, categoria }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ADMIN_EMAIL, ALLOWED_MOD_EMAILS } from "@/lib/constants";

const ROLES_PERMITIDOS = ["admin", "moderador"];
const TEMP_PASSWORD = "PasswordTemporal123!";

export async function POST(request: Request) {
  try {
    // 1. Verificar Bearer token
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // 2. Verificar rol moderador/admin (soporta rol string legacy, roles array y email master)
    const callerDoc = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : null;
    const callerRol: string = callerData?.rol ?? "";
    const callerRoles: string[] = Array.isArray(callerData?.roles) ? callerData!.roles : [];
    const callerEmail = (decoded.email ?? "").trim().toLowerCase();
    const isAdminEmail = callerEmail === ADMIN_EMAIL;
    const isAllowedModEmail = ALLOWED_MOD_EMAILS.includes(callerEmail);

    const hasPermission =
      ROLES_PERMITIDOS.includes(callerRol) ||
      callerRoles.some((r: string) => ROLES_PERMITIDOS.includes(r)) ||
      isAdminEmail ||
      isAllowedModEmail;

    if (!hasPermission) {
      return NextResponse.json({ error: "No tienes permisos de moderador." }, { status: 403 });
    }

    // 3. Validar body
    const body = await request.json();
    const email: string = (body.email ?? "").trim().toLowerCase();
    const nombreLocal: string = (body.nombreLocal ?? "").trim();
    const categoria: string = (body.categoria ?? "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    }
    if (!nombreLocal) {
      return NextResponse.json({ error: "El nombre del local es obligatorio." }, { status: 400 });
    }
    if (!categoria) {
      return NextResponse.json({ error: "La categoría es obligatoria." }, { status: 400 });
    }

    // 4. Paso A — obtener o crear el usuario de Auth
    let uid: string;
    let createdNew = false;
    try {
      const existing = await adminAuth.getUserByEmail(email);
      uid = existing.uid;
    } catch (e: any) {
      if (e?.code === "auth/user-not-found") {
        const created = await adminAuth.createUser({
          email,
          password: TEMP_PASSWORD,
          displayName: nombreLocal,
        });
        uid = created.uid;
        createdNew = true;
      } else {
        throw e;
      }
    }

    // 5. Paso B — escrituras atómicas (batch)
    const timestamp = new Date().toISOString();
    const vendorId = uid; // el perfil se indexa por el uid (ver nota de integración)
    const batch = adminDb.batch();

    // usuarios/{uid}: rol emprendedor (merge para no pisar datos de uno existente)
    const userRef = adminDb.collection("usuarios").doc(uid);
    const userData: Record<string, any> = { rol: "emprendedor" };
    if (createdNew) {
      Object.assign(userData, {
        id: uid,
        correo: email,
        nombre: nombreLocal,
        comprasRealizadas: 0,
        puntos: 0,
        sellosEntregadosHistorico: 0,
        baneado: false,
        createdAt: timestamp,
      });
    }
    batch.set(userRef, userData, { merge: true });

    // entrepreneur_profiles/{uid}: perfil del local
    const profileRef = adminDb.collection("entrepreneur_profiles").doc(vendorId);
    batch.set(
      profileRef,
      {
        userId: uid,
        vendorId,
        nombre: nombreLocal,
        businessName: nombreLocal, // el directorio lee businessName || nombre
        categoria,
        category: categoria,       // el directorio lee category || rubro
        tipo: "emprendedor",
        activo: true,
        createdAt: timestamp,
        creadoPor: decoded.uid,
      },
      { merge: true }
    );

    await batch.commit();

    return NextResponse.json({
      success: true,
      vendorId,
      uid,
      createdNew,
      // Solo se devuelve la contraseña temporal cuando el usuario fue creado nuevo.
      tempPassword: createdNew ? TEMP_PASSWORD : null,
    });
  } catch (error: any) {
    console.error("[moderador/create-vendor] Error:", error);
    if (error?.code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Ese email ya está registrado en Auth." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message ?? "Error interno" }, { status: 500 });
  }
}
