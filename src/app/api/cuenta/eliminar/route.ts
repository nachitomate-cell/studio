/**
 * POST /api/cuenta/eliminar
 *
 * El socio borra SU cuenta desde Mi perfil. Lo exigen Apple (5.1.1(v)) y
 * Google Play (borrado de cuenta dentro de la app).
 *
 * Antes el perfil hacía deleteDoc(usuarios/{uid}) desde el navegador, pero las
 * reglas solo dejan borrar al staff: fallaba siempre con permission-denied y el
 * socio veía "No pudimos eliminar la cuenta".
 *
 * Borra: usuarios/{uid} (con su bandeja de notificaciones), leads_marketing/{uid}
 * y el usuario de Firebase Auth. Los canjes y sellos ya registrados quedan como
 * registro contable del local; en canjes/ se reemplaza el nombre del socio.
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    // checkRevoked: un token de una sesión cerrada no sirve para borrar.
    uid = (await adminAuth.verifyIdToken(idToken, true)).uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!checkRateLimit(`cuenta-eliminar:${uid}`, 3, 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  }

  try {
    const ref = adminDb.collection("usuarios").doc(uid);
    // Solo el perfil y su bandeja: si es un local, sus ventas_registradas quedan
    // (son el historial del Club, no datos personales del dueño).
    await adminDb.recursiveDelete(ref.collection("notificaciones"));
    await ref.delete();
    await adminDb.collection("leads_marketing").doc(uid).delete().catch(() => {});
    // Canjes: quedan para el local, sin el nombre del socio (mejor esfuerzo).
    try {
      const canjes = await adminDb.collection("canjes").where("clienteId", "==", uid).limit(400).get();
      if (!canjes.empty) {
        const b = adminDb.batch();
        canjes.forEach((d) => b.update(d.ref, { clienteNombre: "Socio eliminado" }));
        await b.commit();
      }
    } catch (e) {
      console.warn("[cuenta/eliminar] No se pudieron anonimizar los canjes:", e);
    }
    try {
      await adminAuth.deleteUser(uid);
    } catch (e: any) {
      if (e?.code !== "auth/user-not-found") throw e;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[cuenta/eliminar] Error:", e);
    return NextResponse.json({ error: "No se pudo eliminar la cuenta" }, { status: 500 });
  }
}
