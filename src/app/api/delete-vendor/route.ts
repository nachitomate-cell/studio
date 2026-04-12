/**
 * POST /api/delete-vendor
 *
 * Elimina un emprendedor/tienda completamente:
 * - Cancela sus pending_stamps activos
 * - Borra entrepreneur_profiles/{vendorId}
 * - Borra usuarios/{vendorId}
 * - Borra el usuario de Firebase Authentication
 *
 * Requiere que el llamador sea director, director_patio o admin.
 * Body: { vendorId: string, idToken: string }
 */

import { NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan variables de entorno: FIREBASE_ADMIN_PROJECT_ID, " +
      "FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY"
    );
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const ROLES_PERMITIDOS = ["admin", "director", "director_patio"];

export async function POST(request: Request) {
  try {
    const { vendorId, idToken } = await request.json();

    if (!vendorId || !idToken) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros: vendorId, idToken" },
        { status: 400 }
      );
    }

    const adminApp = getAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb   = getFirestore(adminApp);

    // 1. Verificar el token del llamador
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ success: false, error: "Token inválido" }, { status: 401 });
    }

    // 2. Verificar rol del llamador (soporta rol string legacy y roles array)
    const callerDoc = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : null;
    const callerRol: string = callerData?.rol ?? "";
    const callerRoles: string[] = Array.isArray(callerData?.roles) ? callerData.roles : [];
    const isAdminEmail = decoded.email === (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "ignaciiio.mate@gmail.com");

    const hasPermission = ROLES_PERMITIDOS.includes(callerRol) ||
      callerRoles.some((r: string) => ROLES_PERMITIDOS.includes(r));

    if (!hasPermission && !isAdminEmail) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    // 3. Cancelar pending_stamps activos del vendedor
    const pendingSnap = await adminDb
      .collection("pending_stamps")
      .where("vendorId", "==", vendorId)
      .where("status", "==", "pending")
      .get();

    await Promise.all(
      pendingSnap.docs.map(d => d.ref.update({ status: "cancelled" }))
    );

    // 4. Eliminar entrepreneur_profiles/{vendorId}
    try {
      await adminDb.collection("entrepreneur_profiles").doc(vendorId).delete();
    } catch (e) {
      console.warn("[delete-vendor] No se encontró entrepreneur_profiles:", e);
    }

    // 5. Eliminar usuarios/{vendorId}
    try {
      await adminDb.collection("usuarios").doc(vendorId).delete();
    } catch (e) {
      console.warn("[delete-vendor] No se encontró usuario:", e);
    }

    // 6. Eliminar de Firebase Authentication
    try {
      await adminAuth.deleteUser(vendorId);
    } catch (e: any) {
      if (e.code !== "auth/user-not-found") {
        console.error("[delete-vendor] Error eliminando de Auth:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[delete-vendor] Error inesperado:", error);
    return NextResponse.json(
      { success: false, error: error.message ?? "Error interno" },
      { status: 500 }
    );
  }
}
