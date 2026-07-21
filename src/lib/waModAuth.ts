/**
 * Verificación de moderador para las rutas API de marketing WhatsApp.
 * Mismo criterio que /api/moderador/create-vendor: Bearer idToken + rol en
 * usuarios/{uid} (string legacy o array `roles`) o email master/allowlist.
 */

import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ADMIN_EMAIL, ALLOWED_MOD_EMAILS } from "@/lib/constants";

const ROLES_PERMITIDOS = ["admin", "director", "director_patio", "moderador"];

export async function verificarModerador(request: Request): Promise<
  { ok: true; uid: string; email: string } | { ok: false; status: number; error: string }
> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "No autorizado" };
  }
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
  } catch {
    return { ok: false, status: 401, error: "Token inválido" };
  }
  const email = String(decoded.email || "").toLowerCase();
  if (email === ADMIN_EMAIL.toLowerCase() || ALLOWED_MOD_EMAILS.map(e => e.toLowerCase()).includes(email)) {
    return { ok: true, uid: decoded.uid, email };
  }
  try {
    const doc = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const d = doc.data() || {};
    const roles: string[] = Array.isArray(d.roles) ? d.roles : [d.rol].filter(Boolean);
    if (roles.some(r => ROLES_PERMITIDOS.includes(String(r)))) {
      return { ok: true, uid: decoded.uid, email };
    }
  } catch { /* cae al deny */ }
  return { ok: false, status: 403, error: "Requiere rol moderador" };
}
