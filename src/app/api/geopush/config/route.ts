/**
 * GET /api/geopush/config
 *
 * Zonas y textos del aviso de llegada. Lo baja la app nativa al abrirse y se lo
 * pasa al teléfono, que avisa por su cuenta aunque la app esté cerrada.
 * Público: son coordenadas de un centro comercial y textos de marketing.
 *
 * Zonas privadas: una zona con `soloUids` (p. ej. una prueba en la casa de
 * alguien del equipo) solo se entrega a quien manda un token de Firebase de una
 * de esas cuentas. Al resto ni siquiera le llega la coordenada. Por eso la
 * respuesta nunca se cachea: la CDN no distingue por token.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { GEOPUSH_POR_DEFECTO, normalizarConfig } from "@/lib/geopushConfig";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "private, no-store" };

async function uidDelToken(req: NextRequest): Promise<string | null> {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  try {
    return (await adminAuth.verifyIdToken(h.slice(7))).uid;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const [snap, uid] = await Promise.all([
      adminDb.collection("configuracion").doc("geopush").get(),
      uidDelToken(req),
    ]);
    const cfg = normalizarConfig(snap.exists ? (snap.data() as any) : null);
    cfg.zonas = cfg.zonas
      .filter((z) => !Array.isArray(z.soloUids) || z.soloUids.length === 0 || (!!uid && z.soloUids.includes(uid)))
      .map(({ soloUids: _soloUids, ...z }) => z);
    return NextResponse.json(cfg, { headers: SIN_CACHE });
  } catch (e) {
    console.error("[geopush/config] Error leyendo config, uso la de por defecto:", e);
    return NextResponse.json(GEOPUSH_POR_DEFECTO, { headers: SIN_CACHE });
  }
}
