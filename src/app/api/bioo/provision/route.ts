/**
 * POST /api/bioo/provision
 *
 * Activa el "Link in Bio premium" (bioo.cl) de un comercio. Llama al endpoint
 * server-to-server `biooProvision` del producto bioo (proyecto barberia-elegance),
 * que crea una página bioo.cl/<handle> YA PRELLENADA con los datos del comercio
 * y devuelve un enlace de activación para que el comercio tome la propiedad con
 * su cuenta de Google.
 *
 * Guarda en entrepreneur_profiles/{vendorId}:
 *   biooHandle, biooClaimUrl, biooPublicUrl, biooProvisionedAt
 *
 * Requiere: el llamador es admin/director/director_patio O el propio comercio
 * (decoded.uid === vendorId), y el comercio debe ser premium (isPremium === true).
 *
 * Body: { vendorId: string, idToken: string }
 *
 * Env requeridas:
 *   BIOO_PROVISION_URL     → https://us-central1-barberia-elegance.cloudfunctions.net/biooProvision
 *   BIOO_PROVISION_SECRET  → mismo valor que el secret BIOO_PROVISION_SECRET en barberia-elegance
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ADMIN_EMAIL } from "@/lib/constants";

const ROLES_PERMITIDOS = ["admin", "director", "director_patio", "moderador"];

export async function POST(request: Request) {
  try {
    const { vendorId, idToken } = await request.json();

    if (!vendorId || !idToken) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros: vendorId, idToken" },
        { status: 400 }
      );
    }

    const provisionUrl = process.env.BIOO_PROVISION_URL;
    const provisionSecret = process.env.BIOO_PROVISION_SECRET;
    if (!provisionUrl || !provisionSecret) {
      return NextResponse.json(
        { success: false, error: "Integración bioo no configurada (faltan env vars)." },
        { status: 500 }
      );
    }

    // 1. Verificar token del llamador
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ success: false, error: "Token inválido" }, { status: 401 });
    }

    // 2. Permiso: admin/staff O el propio comercio
    const esPropioComercio = decoded.uid === vendorId;
    let autorizado = esPropioComercio || decoded.email === ADMIN_EMAIL;
    if (!autorizado) {
      const callerDoc = await adminDb.collection("usuarios").doc(decoded.uid).get();
      const callerData = callerDoc.exists ? callerDoc.data() : null;
      const callerRol: string = callerData?.rol ?? "";
      const callerRoles: string[] = Array.isArray(callerData?.roles) ? callerData.roles : [];
      autorizado = ROLES_PERMITIDOS.includes(callerRol) ||
        callerRoles.some((r: string) => ROLES_PERMITIDOS.includes(r));
    }
    if (!autorizado) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    // 3. Cargar el comercio
    const vendorRef = adminDb.collection("entrepreneur_profiles").doc(vendorId);
    const vendorSnap = await vendorRef.get();
    if (!vendorSnap.exists) {
      return NextResponse.json({ success: false, error: "Comercio no encontrado" }, { status: 404 });
    }
    const v = vendorSnap.data() || {};

    // Idempotente: si ya tiene página, la devolvemos.
    if (v.biooHandle) {
      return NextResponse.json({
        success: true,
        already: true,
        handle: v.biooHandle,
        claimUrl: v.biooClaimUrl || `https://bioo.cl/${v.biooHandle}`,
        publicUrl: v.biooPublicUrl || `https://bioo.cl/${v.biooHandle}`,
      });
    }

    // 4. Email del emprendedor = identidad común con bioo.cl (su cuenta Google).
    //    Si lo activa él mismo, es decoded.email; si lo activa un admin para otro
    //    comercio, lo obtenemos de su cuenta de Auth (vendorId === uid).
    let ownerEmail = "";
    if (esPropioComercio && decoded.email) {
      ownerEmail = decoded.email;
    } else {
      try {
        const vendorUser = await adminAuth.getUser(vendorId);
        ownerEmail = vendorUser.email || "";
      } catch {
        ownerEmail = "";
      }
    }
    if (!ownerEmail) {
      return NextResponse.json(
        { success: false, error: "El comercio no tiene un email asociado para vincular su bioo." },
        { status: 400 }
      );
    }

    // 5. Plan: todos los comercios pueden crear su Link in Bio; la personalización
    //    avanzada (temas/fondos/animaciones) se reserva a los Premium/Patrocinados.
    const plan = v.isPremium === true ? "premium" : "free";

    // 6. Llamar al aprovisionamiento de bioo (server-to-server, secret compartido)
    const payload = {
      name: v.businessName || "Mi comercio",
      email: ownerEmail,
      description: v.description || v.promoText || "",
      avatar: v.imagenTarjeta || v.imageUrl || v.imagenPerfil || "",
      whatsapp: v.whatsapp || "",
      instagram: v.instagram || "",
      website: v.website || "",
      handle: v.businessName || vendorId,
      plan,
      source: "club-patio",
    };

    let biooRes: Response;
    try {
      biooRes = await fetch(provisionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bioo-secret": provisionSecret },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("[bioo/provision] fetch error:", e);
      return NextResponse.json(
        { success: false, error: "No se pudo conectar con bioo. Intenta de nuevo." },
        { status: 502 }
      );
    }

    const biooJson = await biooRes.json().catch(() => ({}));
    if (!biooRes.ok || !biooJson.handle) {
      console.error("[bioo/provision] bioo respondió error:", biooRes.status, biooJson);
      return NextResponse.json(
        { success: false, error: biooJson.error || "bioo rechazó la solicitud." },
        { status: 502 }
      );
    }

    // 6. Guardar en el comercio
    await vendorRef.set(
      {
        biooHandle: biooJson.handle,
        biooClaimUrl: biooJson.claimUrl,
        biooPublicUrl: biooJson.publicUrl,
        biooProvisionedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      already: false,
      handle: biooJson.handle,
      claimUrl: biooJson.claimUrl,
      publicUrl: biooJson.publicUrl,
    });
  } catch (e) {
    console.error("[bioo/provision] error:", e);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
