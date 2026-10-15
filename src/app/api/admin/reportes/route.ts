/**
 * GET /api/admin/reportes — lista los reportes semanales archivados.
 *
 * Solo staff (autorizarStaffPanel). La colección `reportes_semanales` no tiene
 * match en firestore.rules, así que el cliente no la puede leer directo: en vez
 * de abrir una regla, el listado sale de aquí con el Admin SDK. Las rutas de
 * Storage no se devuelven; para descargar, /api/admin/reportes/url.
 *
 * Resp: { reportes: ReporteSemanalPublico[] } del más reciente al más antiguo.
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { autorizarStaffPanel } from "@/lib/autorizarStaffPanel";
import {
  REPORTES_COLLECTION,
  type ReporteSemanalPublico,
  type TipoArchivoReporte,
} from "@/lib/reportesSemanales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const staff = await autorizarStaffPanel(request);
    if (staff instanceof NextResponse) return staff;

    const snap = await adminDb
      .collection(REPORTES_COLLECTION)
      .orderBy("desde", "desc")
      .limit(200)
      .get();

    const reportes: ReporteSemanalPublico[] = snap.docs.map((d) => {
      const x = d.data();
      const archivos = Array.isArray(x.archivos) ? x.archivos : [];
      return {
        id: d.id,
        titulo: String(x.titulo ?? ""),
        desde: String(x.desde ?? ""),
        hasta: String(x.hasta ?? ""),
        creadoEn: String(x.creadoEn ?? ""),
        subidoPor: String(x.subidoPor ?? ""),
        archivos: archivos.map((a: any) => ({
          tipo: (a?.tipo === "xlsx" ? "xlsx" : "pdf") as TipoArchivoReporte,
          nombre: String(a?.nombre ?? ""),
          tamanoBytes: Number(a?.tamanoBytes ?? 0),
        })),
      };
    });

    return NextResponse.json(
      { reportes },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    console.error("[admin/reportes] Error al listar:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
