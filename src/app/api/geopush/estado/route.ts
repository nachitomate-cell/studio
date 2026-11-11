/**
 * POST /api/geopush/estado
 *
 * La app nativa cuenta qué permisos tiene el socio para el aviso de llegada
 * (ubicación, "todo el tiempo"/"Siempre", notificaciones). Queda en
 * `usuarios/{uid}.geopush` para medir cuántos llegan a tener el aviso activo y
 * en qué paso se quedan.
 *
 * Body: { plataforma, ubicacion, segundoPlano, avisos, modo?, activo, zonas }
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { checkRateLimit } from "@/lib/rateLimit";

const PERMISO = new Set(["granted", "denied", "prompt"]);
const MODO = new Set(["siempre", "mientras_se_usa", "ninguno"]);

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
  if (!checkRateLimit(`geopush-estado:${uid}`, 10, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let b: any;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const plataforma = b?.plataforma === "ios" || b?.plataforma === "android" ? b.plataforma : null;
  if (!plataforma || !PERMISO.has(b?.ubicacion) || !PERMISO.has(b?.segundoPlano) || !PERMISO.has(b?.avisos)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  await adminDb.collection("usuarios").doc(uid).set(
    {
      geopush: {
        plataforma,
        ubicacion: b.ubicacion,
        segundoPlano: b.segundoPlano,
        avisos: b.avisos,
        modo: MODO.has(b?.modo) ? b.modo : null,
        activo: b.activo === true,
        zonas: Number.isFinite(b?.zonas) ? Math.max(0, Math.min(50, Math.floor(b.zonas))) : 0,
        actualizado: FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  );
  return NextResponse.json({ ok: true });
}
