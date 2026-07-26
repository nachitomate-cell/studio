/**
 * POST /api/admin/upload-imagen
 *
 * Sube imágenes al Storage con el Admin SDK, saltándose las Storage Rules.
 *
 * POR QUÉ EXISTE: las reglas de `entrepreneur_photos/` y `publicidad/` dependen
 * de una lectura cross-service (`firestore.get()` sobre usuarios/{uid}) para
 * verificar el rol director/admin. Esa lectura falla en producción para varios
 * directores — si el documento no existe o el service agent de Storage no puede
 * leer Firestore, la regla lanza error y Storage responde
 * `storage/unauthorized`. El vendedor subiendo SU propia foto no se ve afectado
 * (esa rama de la regla es `uid == vendorId`, sin cross-service), por eso el
 * síntoma aparece solo en los paneles de staff. Mismo criterio que
 * /api/admin/boleta-url.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body (multipart/form-data):
 *   file:     File            — imagen (image/*, máx 15 MB)
 *   destino:  "local" | "publicidad"
 *   vendorId: string          — requerido cuando destino === "local"
 * Resp: { url: string, path: string }
 */

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminAuth, adminDb, adminStorage, STORAGE_BUCKET } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS, ROLES_STAFF_PANEL } from "@/lib/constants";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — igual que isValidImage() en storage.rules

export async function POST(request: Request) {
  try {
    // 1. Autenticación
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

    // 2. Autorización: allowlist de email O rol staff en Firestore
    const callerEmail = (decoded.email ?? "").trim().toLowerCase();
    let autorizado = ALLOWED_MOD_EMAILS.includes(callerEmail);
    if (!autorizado) {
      const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
      const data = snap.exists ? snap.data()! : null;
      const rol: string = data?.rol ?? "";
      const roles: string[] = Array.isArray(data?.roles) ? data.roles : [];
      autorizado =
        ROLES_STAFF_PANEL.includes(rol) ||
        roles.some((r) => ROLES_STAFF_PANEL.includes(r));
    }
    if (!autorizado) {
      return NextResponse.json({ error: "Sin permisos de staff" }, { status: 403 });
    }

    // 3. Validar payload
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Se esperaba multipart/form-data" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen supera los 15 MB" }, { status: 413 });
    }

    // En algunos navegadores móviles / PWA File.type llega vacío: asumimos JPEG,
    // igual que hace el cliente al pasar contentType explícito a uploadBytes().
    const contentType = file.type || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "El archivo debe ser una imagen" }, { status: 400 });
    }

    const destino = String(form.get("destino") ?? "").trim();
    let path: string;
    if (destino === "local") {
      const vendorId = String(form.get("vendorId") ?? "").trim();
      // El vendorId es un id de documento: sin "/" ni ".." para no escapar del prefijo.
      if (!vendorId || vendorId.includes("/") || vendorId.includes("..")) {
        return NextResponse.json({ error: "vendorId inválido" }, { status: 400 });
      }
      path = `entrepreneur_photos/${vendorId}/profile_${Date.now()}`;
    } else if (destino === "publicidad") {
      path = `publicidad/afiche_${Date.now()}`;
    } else {
      return NextResponse.json({ error: "destino inválido" }, { status: 400 });
    }

    // 4. Subir con Admin SDK
    const buffer = Buffer.from(await file.arrayBuffer());
    const downloadToken = randomUUID();
    await adminStorage
      .bucket()
      .file(path)
      .save(buffer, {
        contentType,
        metadata: {
          // Este token es lo que convierte la URL en pública sin pasar por reglas,
          // igual que la URL que devuelve getDownloadURL() en el cliente.
          metadata: { firebaseStorageDownloadTokens: downloadToken },
        },
      });

    const url =
      `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/` +
      `${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;

    return NextResponse.json({ url, path });
  } catch (error: any) {
    console.error("[admin/upload-imagen] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
