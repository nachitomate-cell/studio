/**
 * GET /api/admin/reportes/planilla — descarga la planilla de socios al día.
 *
 * Solo staff (autorizarStaffPanel). Se arma en el momento desde `usuarios` y
 * `leads_marketing`, con la misma lógica que scripts/exportar-consentimiento.mjs
 * (ver src/lib/planillaSocios.ts). No se guarda en ningún lado: trae datos
 * personales de todos los socios y no tiene por qué quedar una copia suelta.
 *
 * Headers: Authorization: Bearer <idToken>
 * Resp:    el .xlsx como attachment ("Base socios Club Patio - DD-MM-AAAA.xlsx"),
 *          con X-Planilla-Autorizan y X-Planilla-Total para el aviso del panel.
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { autorizarStaffPanel } from "@/lib/autorizarStaffPanel";
import { planillaSociosBuffer } from "@/lib/planillaSocios";
import { contentDispositionAdjunto, nombreArchivoPlanilla } from "@/lib/reportesSemanales";

// xlsx y el Admin SDK necesitan Node. Leer ~1.300 socios y armar el libro toma
// unos segundos; 60 s deja margen sin pedir un plan mayor.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const staff = await autorizarStaffPanel(request);
    if (staff instanceof NextResponse) return staff;

    const [usuarios, leads] = await Promise.all([
      adminDb.collection("usuarios").get(),
      adminDb.collection("leads_marketing").get(),
    ]);

    const { buffer, resumen } = planillaSociosBuffer(usuarios.docs, leads.docs);
    const nombre = nombreArchivoPlanilla();

    console.log(
      `[admin/reportes/planilla] ${staff.email} descargó la planilla: ` +
        `${resumen.autorizanCorreo} autorizan correo de ${resumen.baseCompleta} socios`,
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDispositionAdjunto(nombre),
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
        "X-Planilla-Autorizan": String(resumen.autorizanCorreo),
        "X-Planilla-Total": String(resumen.baseCompleta),
      },
    });
  } catch (error: any) {
    console.error("[admin/reportes/planilla] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
