/**
 * GET /api/geopush/config
 *
 * Zonas y textos del aviso de llegada. Lo baja la app nativa al abrirse y se lo
 * pasa al teléfono, que avisa por su cuenta aunque la app esté cerrada.
 * Público: son coordenadas de un centro comercial y textos de marketing.
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { GEOPUSH_POR_DEFECTO, normalizarConfig } from "@/lib/geopushConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snap = await adminDb.collection("configuracion").doc("geopush").get();
    const cfg = normalizarConfig(snap.exists ? (snap.data() as any) : null);
    return NextResponse.json(cfg, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  } catch (e) {
    console.error("[geopush/config] Error leyendo config, uso la de por defecto:", e);
    return NextResponse.json(GEOPUSH_POR_DEFECTO);
  }
}
