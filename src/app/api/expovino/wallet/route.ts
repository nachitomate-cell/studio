/**
 * POST /api/expovino/wallet
 *
 * Emite la tarjeta de fidelidad del socio para Apple Wallet y Google Wallet.
 *
 * Se apoya en Wallo (wallets.bioo.cl), que vive en otro proyecto Firebase y ya
 * resuelve las dos plataformas: firma el .pkpass con el Pass Type ID y mantiene
 * el web service de APNs para actualizarlo. Reimplementar eso acá habría sido
 * portar ~600 líneas de Firebase Functions a Next.js sin margen para probarlo
 * en un iPhone real. `walletRegistrarCliente` es HTTP público con CORS, así que
 * se llama server-side y listo.
 *
 * POR QUÉ IMPORTA: un pase de wallet llega a la pantalla de bloqueo SIN pedir
 * permiso de notificaciones y sin instalar nada. Al 2026-07-29 solo 69 de 746
 * socios tenían push activo; el pase no tiene ese techo.
 *
 * Headers: Authorization: Bearer <idToken>
 * Resp: { saveUrlGoogle, urlApple }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { campanaPorSlug } from "@/lib/campanas";

const WALLO_URL =
  process.env.WALLO_REGISTRO_URL ??
  "https://us-central1-barberia-elegance.cloudfunctions.net/walletRegistrarCliente";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const ref = adminDb.collection("usuarios").doc(decoded.uid);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    const u = snap.data()!;

    // El tenant sale de la campaña por la que entró el socio, no de una
    // variable global: el pase lleva la marca del evento, y uno de Ruta BAC no
    // puede recibir una tarjeta que diga Expovino. La variable de entorno queda
    // como respaldo para campañas antiguas sin tenant declarado.
    const campana = campanaPorSlug(u.campanaRegistro);
    const tenantId = (campana?.walloTenant ?? process.env.WALLO_TENANT_ID ?? "").trim();
    if (!tenantId) {
      // Campaña sin tarjeta propia: la sección no se ofrece.
      return NextResponse.json({ error: "Wallet no configurado" }, { status: 503 });
    }

    // Ya emitidas: se devuelven tal cual. Wallo es idempotente por correo, pero
    // no tiene sentido salir a la red cada vez que alguien abre la pantalla.
    if (u.walletUrlGoogle || u.walletUrlApple) {
      return NextResponse.json({
        saveUrlGoogle: u.walletUrlGoogle ?? null,
        urlApple: u.walletUrlApple ?? null,
        cacheado: true,
      });
    }

    const cuerpo = {
      tenantId,
      nombre: String(u.nombre ?? "").trim(),
      email: String(u.correo ?? decoded.email ?? "").trim(),
      telefono: String(u.telefono ?? "").trim(),
      fechaNacimiento: String(u.fechaNacimiento ?? "").trim(),
      acepto: true,   // el socio ya aceptó los términos al crear la cuenta
    };

    if (!cuerpo.nombre || !cuerpo.email || !cuerpo.telefono) {
      return NextResponse.json(
        { error: "Faltan datos del perfil para emitir la tarjeta" },
        { status: 400 },
      );
    }

    const r = await fetch(WALLO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data?.ok) {
      // Los códigos de Wallo son accionables; se propagan para poder actuar.
      console.error("[expovino/wallet] Wallo rechazó:", r.status, data?.error);
      return NextResponse.json(
        { error: data?.error ?? "No se pudo emitir la tarjeta" },
        { status: r.status === 200 ? 502 : r.status },
      );
    }

    // Guardar para no volver a pedirlas
    await ref.update({
      walletUrlGoogle: data.saveUrlGoogle ?? null,
      walletUrlApple: data.urlApple ?? null,
      walletEmitidaEn: new Date().toISOString(),
    });

    return NextResponse.json({
      saveUrlGoogle: data.saveUrlGoogle ?? null,
      urlApple: data.urlApple ?? null,
      cacheado: false,
    });
  } catch (error: any) {
    console.error("[expovino/wallet] Error:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
