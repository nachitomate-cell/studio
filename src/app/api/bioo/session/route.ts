/**
 * POST /api/bioo/session
 *
 * Devuelve una URL que abre el editor de bioo.cl con el emprendedor YA logueado
 * (SSO entre proyectos vía custom token), sin que tenga que iniciar sesión otra
 * vez. Lo llama el botón "Personalizar mi página" del panel del emprendedor.
 *
 * Flujo (1 sola llamada server-to-server):
 *   - Verifica la sesión del emprendedor en Club Patio (idToken).
 *   - Llama a `provisionPartnerUser` en bioo (aprovisiona la cuenta+página si no
 *     existe y firma un customToken), con el secret SOLO en el servidor.
 *   - Devuelve editUrl = https://bioo.cl/editor?token=<customToken>.
 *
 * SEGURIDAD: el BIOO_PROVISION_SECRET vive en variables de entorno del SERVIDOR
 * (no NEXT_PUBLIC), nunca se expone al navegador.
 *
 * Body: { idToken: string }
 * Env:  BIOO_PROVISION_URL, BIOO_PROVISION_SECRET, BIOO_EDITOR_URL (opcional)
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ success: false, error: "Falta idToken" }, { status: 400 });
    }

    const provisionUrl = process.env.BIOO_PROVISION_URL;
    const provisionSecret = process.env.BIOO_PROVISION_SECRET;
    if (!provisionUrl || !provisionSecret) {
      return NextResponse.json({ success: false, error: "Integración bioo no configurada." }, { status: 500 });
    }
    // URL de la función de SSO en bioo (deriva de la de provisión).
    const partnerUrl = provisionUrl.replace(/\/biooProvision$/, "/provisionPartnerUser");
    const editorBase = process.env.BIOO_EDITOR_URL || "https://bioo.cl/editor";

    // Identidad del emprendedor (su propia sesión en Club Patio).
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ success: false, error: "Token inválido" }, { status: 401 });
    }
    const vendorId = decoded.uid;
    const email = decoded.email || "";
    if (!email) {
      return NextResponse.json({ success: false, error: "Tu cuenta no tiene email." }, { status: 400 });
    }

    // Nombre del local (para prellenar la página en bioo).
    const vendorRef = adminDb.collection("entrepreneur_profiles").doc(vendorId);
    const vendorSnap = await vendorRef.get();
    if (!vendorSnap.exists) {
      return NextResponse.json({ success: false, error: "Configura tu local primero." }, { status: 404 });
    }
    const v = vendorSnap.data() || {};
    const storeName = v.businessName || v.nombre || "Mi comercio";

    // Una sola llamada: aprovisiona (si hace falta) + devuelve customToken.
    // El secret va en Authorization: Bearer (solo server-side).
    let r: Response;
    try {
      r = await fetch(partnerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provisionSecret}`,
        },
        body: JSON.stringify({
          email,
          storeName,
          handle: v.biooHandle || v.businessName || vendorId,
          source: "club-patio",
        }),
      });
    } catch (e) {
      console.error("[bioo/session] fetch error:", e);
      return NextResponse.json({ success: false, error: "No se pudo conectar con bioo." }, { status: 502 });
    }

    const j = await r.json().catch(() => ({} as any));
    if (!r.ok || !j.success || !j.customToken) {
      console.error("[bioo/session] bioo respondió error:", r.status, j);
      return NextResponse.json({ success: false, error: j.error || "No se pudo abrir el editor." }, { status: 502 });
    }

    // Guardar el handle en el perfil para mostrarlo en el panel.
    if (j.handle && j.handle !== v.biooHandle) {
      await vendorRef.set(
        {
          biooHandle: j.handle,
          biooPublicUrl: `https://bioo.cl/${j.handle}`,
          biooProvisionedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {/* no crítico */});
    }

    const editUrl = `${editorBase}?token=${encodeURIComponent(j.customToken)}`;
    return NextResponse.json({ success: true, handle: j.handle, editUrl });
  } catch (e) {
    console.error("[bioo/session] error:", e);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
