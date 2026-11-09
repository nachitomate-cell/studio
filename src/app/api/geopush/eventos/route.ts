/**
 * POST /api/geopush/eventos
 *
 * La app nativa sube aquí lo que pasó con los avisos de llegada mientras estaba
 * cerrada (avisó, la tocaron, se cortó por enfriamiento...). Sirve para medir
 * y para que el aviso quede también en la bandeja de notificaciones del socio.
 *
 * Body: { eventos: [{ zona, tipo, ts }], plataforma }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { checkRateLimit } from "@/lib/rateLimit";
import { normalizarConfig } from "@/lib/geopushConfig";

const TIPOS = new Set(["aviso", "toque", "prueba", "enfriamiento", "silencio", "paso_de_largo", "sin_permiso_avisos"]);

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!checkRateLimit(`geopush-eventos:${uid}`, 10, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const plataforma = body?.plataforma === "ios" || body?.plataforma === "android" ? body.plataforma : "desconocida";
  const ahora = Date.now();
  const eventos = (Array.isArray(body?.eventos) ? body.eventos : [])
    .filter((e: any) => e && typeof e.zona === "string" && TIPOS.has(e.tipo) && Number.isFinite(e.ts))
    // Nada del futuro ni de más de 60 días atrás.
    .filter((e: any) => e.ts <= ahora + 60_000 && e.ts >= ahora - 60 * 86_400_000)
    .slice(0, 50);
  if (!eventos.length) return NextResponse.json({ ok: true, guardados: 0 });

  const cfgSnap = await adminDb.collection("configuracion").doc("geopush").get().catch(() => null);
  const cfg = normalizarConfig(cfgSnap?.exists ? (cfgSnap.data() as any) : null);

  const batch = adminDb.batch();
  for (const e of eventos) {
    const fecha = new Date(e.ts).toISOString();
    batch.set(adminDb.collection("geopush_eventos").doc(), {
      uid,
      zona: e.zona.slice(0, 40),
      tipo: e.tipo,
      fecha,
      plataforma,
    });
    // El aviso real también queda en la bandeja de la app.
    if (e.tipo === "aviso") {
      const z = cfg.zonas.find((x) => x.id === e.zona);
      if (z) {
        batch.set(adminDb.collection("usuarios").doc(uid).collection("notificaciones").doc(), {
          titulo: z.titulo,
          mensaje: z.mensaje,
          leida: true,
          fecha,
          tipo: "geofence",
          cta: z.url || "/",
        });
      }
    }
  }
  await batch.commit();
  return NextResponse.json({ ok: true, guardados: eventos.length });
}
