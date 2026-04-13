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
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan variables FIREBASE_ADMIN_* en .env");
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const ROLES_STAFF = ["moderador", "admin", "director", "director_patio"];
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "ignaciiio.mate@gmail.com";

export async function GET(request: Request) {
  try {
    const idToken = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const adminApp  = getAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb   = getFirestore(adminApp);

    // Verificar token
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
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
    const snap = await adminDb.collection("usuarios").get();
    const usuarios = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ usuarios });
  } catch (error: any) {
    console.error("[admin/usuarios] Error:", error);
    return NextResponse.json({ error: error.message ?? "Error interno" }, { status: 500 });
  }
}
