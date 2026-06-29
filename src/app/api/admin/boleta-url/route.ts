/**
 * POST /api/admin/boleta-url
 *
 * Genera una URL firmada (signed URL) corta para que el staff (admin, director,
 * director_patio, moderador) pueda ver/auditar la foto de una boleta sin
 * depender de las Storage Rules cross-service (firestore.get() desde Storage
 * a veces falla silenciosamente y es difícil de debuggear).
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { boletaPath: string }
 * Resp:    { url: string, expiresAt: string }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS } from "@/lib/constants";

const ROLES_STAFF = ["admin", "director", "director_patio", "moderador"] as const;
const URL_TTL_MS = 15 * 60 * 1000; // 15 min — suficiente para auditar, corto para limitar leaks

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

    // Email allowlist O rol staff en Firestore
    const callerEmail = (decoded.email ?? "").trim().toLowerCase();
    let autorizado = ALLOWED_MOD_EMAILS.includes(callerEmail);
    if (!autorizado) {
      const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
      const data = snap.exists ? snap.data()! : null;
      const rol: string = data?.rol ?? "";
      const roles: string[] = Array.isArray(data?.roles) ? data.roles : [];
      autorizado =
        ROLES_STAFF.includes(rol as typeof ROLES_STAFF[number]) ||
        roles.some((r) => ROLES_STAFF.includes(r as typeof ROLES_STAFF[number]));
    }
    if (!autorizado) {
      return NextResponse.json({ error: "Sin permisos de staff" }, { status: 403 });
    }

    const { boletaPath } = await request.json();
    if (!boletaPath || typeof boletaPath !== "string" || !boletaPath.startsWith("boletas/")) {
      return NextResponse.json({ error: "boletaPath inválido" }, { status: 400 });
    }

    const expiresAt = Date.now() + URL_TTL_MS;
    const [url] = await adminStorage
      .bucket()
      .file(boletaPath)
      .getSignedUrl({ action: "read", expires: expiresAt });

    return NextResponse.json({ url, expiresAt: new Date(expiresAt).toISOString() });
  } catch (error: any) {
    console.error("[admin/boleta-url] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
