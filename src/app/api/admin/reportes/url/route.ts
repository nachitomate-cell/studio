/**
 * GET /api/admin/reportes/url?id=<desde_hasta>&i=<índice>
 *
 * Devuelve una signed URL corta para descargar un archivo de un reporte semanal.
 *
 * Solo staff (autorizarStaffPanel). Los archivos viven en `reportes_semanales/`,
 * que es deny-all en storage.rules: no hay URL permanente que se pueda reenviar
 * y quedar circulando con la base de socios adentro. La URL sale como attachment
 * con el nombre original, así el navegador la descarga en vez de abrirla.
 *
 * Headers: Authorization: Bearer <idToken>
 * Resp:    { url: string, expiresAt: string, nombre: string }
 */

import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { autorizarStaffPanel } from "@/lib/autorizarStaffPanel";
import {
  REPORTES_COLLECTION,
  REPORTES_STORAGE_PREFIX,
  contentDispositionAdjunto,
  esIdReporteValido,
} from "@/lib/reportesSemanales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lo justo para que empiece la descarga; si se reenvía, muere pronto. */
const URL_TTL_MS = 5 * 60 * 1000;

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(request: Request) {
  try {
    const staff = await autorizarStaffPanel(request);
    if (staff instanceof NextResponse) return staff;

    const params = new URL(request.url).searchParams;
    const id = params.get("id")?.trim() ?? "";
    const indice = Number(params.get("i"));
    if (!esIdReporteValido(id)) {
      return NextResponse.json({ error: "id de reporte inválido" }, { status: 400 });
    }
    if (!Number.isInteger(indice) || indice < 0) {
      return NextResponse.json({ error: "Índice de archivo inválido" }, { status: 400 });
    }

    const snap = await adminDb.collection(REPORTES_COLLECTION).doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Ese reporte ya no existe" }, { status: 404 });
    }
    const archivos = Array.isArray(snap.data()?.archivos) ? snap.data()!.archivos : [];
    const archivo = archivos[indice];
    if (!archivo) {
      return NextResponse.json({ error: "Ese archivo ya no existe" }, { status: 404 });
    }

    const path = String(archivo.path ?? "");
    // El doc lo escribe solo el script con Admin SDK, pero igual se exige que
    // apunte dentro de su propia carpeta: un path torcido no firma otra cosa.
    if (!path.startsWith(`${REPORTES_STORAGE_PREFIX}${id}/`) || path.includes("..")) {
      return NextResponse.json({ error: "Archivo sin ruta válida" }, { status: 400 });
    }

    const nombre = String(archivo.nombre ?? "").trim() || path.slice(path.lastIndexOf("/") + 1);
    const tipo = archivo.tipo === "xlsx" ? "xlsx" : "pdf";

    const expiresAt = Date.now() + URL_TTL_MS;
    const [url] = await adminStorage.bucket().file(path).getSignedUrl({
      action: "read",
      expires: expiresAt,
      responseDisposition: contentDispositionAdjunto(nombre),
      responseType: CONTENT_TYPES[tipo],
    });

    return NextResponse.json(
      { url, expiresAt: new Date(expiresAt).toISOString(), nombre },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    console.error("[admin/reportes/url] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
