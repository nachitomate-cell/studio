/**
 * POST /api/bioo/backfill
 *
 * Crea el Link in Bio (bioo.cl) para TODOS los emprendedores con perfil que aún
 * no lo tengan. Idempotente: omite los que ya tienen biooHandle y bioo deduplica
 * por email. Pensado para correr una vez (y cuando se quiera reconciliar).
 *
 * Solo admin/director/director_patio/moderador.
 * Body: { idToken: string, limit?: number }
 *
 * Env: BIOO_PROVISION_URL, BIOO_PROVISION_SECRET
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ADMIN_EMAIL } from "@/lib/constants";

const ROLES_PERMITIDOS = ["admin", "director", "director_patio", "moderador"];

export async function POST(request: Request) {
  try {
    const { idToken, limit } = await request.json();
    if (!idToken) {
      return NextResponse.json({ success: false, error: "Falta idToken" }, { status: 400 });
    }

    const provisionUrl = process.env.BIOO_PROVISION_URL;
    const provisionSecret = process.env.BIOO_PROVISION_SECRET;
    if (!provisionUrl || !provisionSecret) {
      return NextResponse.json({ success: false, error: "Integración bioo no configurada." }, { status: 500 });
    }

    // Auth + rol admin
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ success: false, error: "Token inválido" }, { status: 401 });
    }
    let autorizado = decoded.email === ADMIN_EMAIL;
    if (!autorizado) {
      const callerDoc = await adminDb.collection("usuarios").doc(decoded.uid).get();
      const cd = callerDoc.exists ? callerDoc.data() : null;
      const rol: string = cd?.rol ?? "";
      const roles: string[] = Array.isArray(cd?.roles) ? cd!.roles : [];
      autorizado = ROLES_PERMITIDOS.includes(rol) || roles.some((r) => ROLES_PERMITIDOS.includes(r));
    }
    if (!autorizado) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const max = Math.min(Number(limit) || 500, 1000);
    const snap = await adminDb.collection("entrepreneur_profiles").get();

    let provisioned = 0, skipped = 0, errors = 0, sinEmail = 0;
    const detalles: Array<{ id: string; handle?: string; status: string }> = [];

    for (const docSnap of snap.docs) {
      if (provisioned >= max) break;
      const v = docSnap.data();
      const vendorId = docSnap.id;

      if (v.biooHandle) { skipped++; continue; }

      // Email del emprendedor (su cuenta de Auth; vendorId === uid)
      let email = "";
      try {
        const u = await adminAuth.getUser(vendorId);
        email = u.email || "";
      } catch { /* sin cuenta de Auth */ }
      if (!email) { sinEmail++; detalles.push({ id: vendorId, status: "sin_email" }); continue; }

      const payload = {
        name: v.businessName || v.nombre || "Mi comercio",
        email,
        description: v.description || v.promoText || "",
        avatar: v.imagenTarjeta || v.imageUrl || v.imagenPerfil || "",
        whatsapp: v.whatsapp || "",
        instagram: v.instagram || "",
        website: v.website || "",
        handle: v.businessName || vendorId,
        plan: v.isPremium === true ? "premium" : "free",
        source: "club-patio",
      };

      try {
        const r = await fetch(provisionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-bioo-secret": provisionSecret },
          body: JSON.stringify(payload),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.handle) { errors++; detalles.push({ id: vendorId, status: "error_bioo" }); continue; }

        await docSnap.ref.set(
          {
            biooHandle: j.handle,
            biooClaimUrl: j.claimUrl,
            biooPublicUrl: j.publicUrl,
            biooProvisionedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        provisioned++;
        detalles.push({ id: vendorId, handle: j.handle, status: j.already ? "ya_existia" : "creado" });
      } catch {
        errors++;
        detalles.push({ id: vendorId, status: "error_fetch" });
      }
    }

    return NextResponse.json({
      success: true,
      total: snap.size,
      provisioned,
      skipped,
      sinEmail,
      errors,
      detalles,
    });
  } catch (e) {
    console.error("[bioo/backfill] error:", e);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
