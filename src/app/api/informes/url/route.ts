/**
 * POST /api/informes/url
 *
 * Devuelve una signed URL corta para abrir el PDF de un informe.
 *
 * El archivo vive en `informes/`, que es deny-all en storage.rules: no hay
 * ninguna URL permanente que se pueda reenviar por WhatsApp y quedar circulando.
 * Aquí se decide quién puede verlo — el comercio dueño, cualquier comercio si el
 * informe es general, o el staff — y recién ahí se firma el acceso.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { id: string }   — id del documento en `informes`
 * Resp:    { url: string, expiresAt: string, nombreArchivo: string }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS, ROLES_STAFF_PANEL } from "@/lib/constants";
import { INFORMES_COLLECTION } from "@/lib/informes";

const URL_TTL_MS = 15 * 60 * 1000;

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

    const { id } = await request.json();
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Falta el id del informe" }, { status: 400 });
    }

    const snap = await adminDb.collection(INFORMES_COLLECTION).doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Ese informe ya no existe" }, { status: 404 });
    }
    const informe = snap.data()!;
    const archivoPath = String(informe.archivoPath ?? "");
    if (!archivoPath.startsWith("informes/")) {
      return NextResponse.json({ error: "Informe sin archivo válido" }, { status: 400 });
    }

    const uid = decoded.uid;
    const email = (decoded.email ?? "").trim().toLowerCase();

    let permitido = informe.alcance === "comercio" && informe.vendorId === uid;

    if (!permitido) {
      const [usuarioSnap, perfilSnap] = await Promise.all([
        adminDb.collection("usuarios").doc(uid).get(),
        adminDb.collection("entrepreneur_profiles").doc(uid).get(),
      ]);
      const data = usuarioSnap.exists ? usuarioSnap.data()! : null;
      const rol: string = data?.rol ?? "";
      const roles: string[] = Array.isArray(data?.roles) ? data.roles : [];

      const esStaff =
        ALLOWED_MOD_EMAILS.includes(email) ||
        ROLES_STAFF_PANEL.includes(rol) ||
        roles.some((r) => ROLES_STAFF_PANEL.includes(r));

      // Los informes generales son del club, no públicos: los ve quien tiene
      // ficha de comercio o rol de emprendedor, no cualquier socio con sesión.
      const esComercio =
        perfilSnap.exists || rol === "emprendedor" || roles.includes("emprendedor");

      permitido = esStaff || (informe.alcance === "general" && esComercio);
    }

    if (!permitido) {
      return NextResponse.json({ error: "Este informe no es tuyo" }, { status: 403 });
    }

    const expiresAt = Date.now() + URL_TTL_MS;
    const [url] = await adminStorage
      .bucket()
      .file(archivoPath)
      .getSignedUrl({ action: "read", expires: expiresAt });

    return NextResponse.json({
      url,
      expiresAt: new Date(expiresAt).toISOString(),
      nombreArchivo: String(informe.nombreArchivo ?? "informe.pdf"),
    });
  } catch (error: any) {
    console.error("[informes/url] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
