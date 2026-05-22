/**
 * POST /api/referral/process
 *
 * Procesa un código de referido al momento del registro.
 * Otorga +1 sello al nuevo usuario y crea un doc pendiente para el referidor.
 * El sello del referidor se entrega recién cuando el nuevo usuario realice
 * su primera compra real (ver procesarReferidoPendiente en referralAdmin.ts).
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const newUserId = decoded.uid;
    const { referralCode } = await request.json();

    if (!referralCode || typeof referralCode !== "string") {
      return NextResponse.json({ error: "Código requerido" }, { status: 400 });
    }

    const codigoNormalizado = referralCode.trim().toUpperCase();

    // Buscar el código en la colección codigos_referido
    const codigoRef = adminDb.collection("codigos_referido").doc(codigoNormalizado);
    const codigoSnap = await codigoRef.get();

    if (!codigoSnap.exists) {
      return NextResponse.json({ error: "Código de referido no válido" }, { status: 404 });
    }

    const referrerId: string = codigoSnap.data()!.userId;

    if (referrerId === newUserId) {
      return NextResponse.json({ error: "No puedes usar tu propio código" }, { status: 400 });
    }

    const newUserRef = adminDb.collection("usuarios").doc(newUserId);
    const referrerRef = adminDb.collection("usuarios").doc(referrerId);
    const pendingRef = adminDb.collection("referidos_pendientes").doc(newUserId);

    let newUserName = "Nuevo Miembro";
    let referrerName = "Miembro del Club";
    let newUserSellos = 0;

    await adminDb.runTransaction(async (tx) => {
      const [newUserSnap, referrerSnap] = await Promise.all([
        tx.get(newUserRef),
        tx.get(referrerRef),
      ]);

      if (!newUserSnap.exists) throw new Error("Usuario no encontrado.");

      const newUserData = newUserSnap.data()!;

      // Idempotencia: si ya reclamó un referido, no hacer nada
      if (newUserData.referidoPor) {
        throw new Error("Este usuario ya usó un código de referido.");
      }
      if (newUserData.baneado) throw new Error("Usuario baneado.");

      newUserName = newUserData.nombre || newUserData.correo || "Nuevo Miembro";
      newUserSellos = (newUserData.comprasRealizadas || 0) + 1;

      if (referrerSnap.exists) {
        referrerName = referrerSnap.data()!.nombre || "Miembro del Club";
      }

      // +1 sello al nuevo usuario por registrarse con código
      tx.update(newUserRef, {
        comprasRealizadas: FieldValue.increment(1),
        sellosHistoricos: FieldValue.increment(1),
        puntos: FieldValue.increment(50),
        recompensaDisponible: newUserSellos >= 5,
        referidoPor: referrerId,
        lastUpdate: new Date().toISOString(),
      });

      // Capa 1: sello del referidor queda pendiente hasta primera compra real
      tx.set(pendingRef, {
        referrerId,
        referrerName,
        newUserName,
        status: "pending",
        creadoEn: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
    });

    // Logs y notificaciones no críticas (fire-and-forget)
    const timestamp = new Date().toISOString();
    (async () => {
      try {
        await Promise.all([
          adminDb.collection("system_logs").add({
            usuario: newUserName,
            usuarioId: newUserId,
            referidorId: referrerId,
            accion: `se registró usando código de referido de ${referrerName}`,
            fecha: timestamp,
            tipo: "REFERIDO",
            metodo: "SISTEMA",
          }),
          // Notificación al nuevo usuario
          adminDb.collection("usuarios").doc(newUserId).collection("notificaciones").add({
            titulo: "¡Bono de Referido! 🎁",
            mensaje: `Usaste el código de un amigo y ganaste 1 sello extra. ¡Comparte tu código y gana más!`,
            leida: false,
            fecha: timestamp,
          }),
          // Notificación al referidor: el sello aún no fue entregado
          adminDb.collection("usuarios").doc(referrerId).collection("notificaciones").add({
            titulo: "¡Tu código fue usado! 🔗",
            mensaje: `${newUserName} se unió al Club usando tu código. Recibirás tu sello cuando realice su primera visita a un local.`,
            leida: false,
            fecha: timestamp,
          }),
        ]);
      } catch (e) {
        console.warn("[referral/process] Operación auxiliar falló:", e);
      }
    })();

    return NextResponse.json({ success: true, newUserSellos });
  } catch (error: any) {
    console.error("[referral/process] Error:", error);
    const isUserError = ["ya usó un código", "no válido", "No puedes usar"].some((m) =>
      error.message?.includes(m)
    );
    return NextResponse.json(
      { error: error.message ?? "Error interno" },
      { status: isUserError ? 400 : 500 }
    );
  }
}
