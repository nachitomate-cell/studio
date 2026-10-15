/**
 * Guard de las rutas API que solo usa el panel /moderador. SOLO SERVIDOR.
 *
 * Bearer idToken + canAccessModPanel (allowlist de correo O rol/roles de staff en
 * usuarios/{uid}): exactamente el mismo criterio con que la pantalla deja entrar.
 * Si la API exigiera otra cosa, alguien vería el panel y le fallarían las
 * descargas, o al revés.
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { canAccessModPanel } from "@/lib/constants";

export async function autorizarStaffPanel(
  request: Request,
): Promise<{ uid: string; email: string } | NextResponse> {
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

  const email = (decoded.email ?? "").trim().toLowerCase();
  let autorizado = canAccessModPanel(email, null);
  if (!autorizado) {
    const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
    autorizado = canAccessModPanel(
      email,
      snap.exists ? (snap.data() as { rol?: string; roles?: string[] }) : null,
    );
  }
  if (!autorizado) {
    return NextResponse.json({ error: "Sin permisos de staff" }, { status: 403 });
  }

  return { uid: decoded.uid, email };
}
