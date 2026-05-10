/**
 * POST /api/handshake/vendor-scan
 *
 * Confirms a vendor-initiated stamp (emprendedor scanned client QR).
 * Updates the pending_stamps doc from "vendor_processing" → "vendor_confirmed"
 * and awards +1 stamp to the client.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { pendingId: string, monto: number }
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

    const vendorId = decoded.uid;
    const { pendingId, monto } = await request.json();

    if (!pendingId) {
      return NextResponse.json({ error: "pendingId requerido" }, { status: 400 });
    }
    if (typeof monto !== "number" || monto <= 0 || monto > 150_000) {
      return NextResponse.json({ error: "Monto inválido. Debe estar entre $1 y $150.000." }, { status: 400 });
    }

    const pendingRef = adminDb.collection("pending_stamps").doc(pendingId);
    let result: { userId: string; userName: string; vendorName: string; nuevoTotal: number };

    await adminDb.runTransaction(async (tx) => {
      const pendingSnap = await tx.get(pendingRef);
      if (!pendingSnap.exists) throw new Error("Solicitud no encontrada.");

      const pending = pendingSnap.data()!;

      if (pending.vendorId !== vendorId) {
        throw new Error("No tienes permiso para confirmar esta solicitud.");
      }
      if (pending.status !== "vendor_processing") {
        throw new Error("La solicitud ya fue procesada o no es válida.");
      }
      if (pending.initiatedBy !== "vendor") {
        throw new Error("Tipo de solicitud incorrecto.");
      }

      const { userId, userName, vendorName } = pending;
      const userRef = adminDb.collection("usuarios").doc(userId);
      const userSnap = await tx.get(userRef);

      const currentSellos = userSnap.exists ? (userSnap.data()!.comprasRealizadas || 0) : 0;
      const nuevoTotal = currentSellos + 1;
      const timestamp = new Date().toISOString();
      const realUserName = (userSnap.exists ? userSnap.data()!.nombre : null) || userName || "Miembro";

      tx.update(pendingRef, {
        status: "vendor_confirmed",
        monto,
        nuevoTotal,
        confirmedAt: FieldValue.serverTimestamp(),
      });

      if (userSnap.exists) {
        tx.update(userRef, {
          comprasRealizadas: FieldValue.increment(1),
          recompensaDisponible: nuevoTotal >= 5,
          puntos: FieldValue.increment(50),
          lastPurchaseAt: timestamp,
          lastUpdate: timestamp,
          [`lastVendorScans.${vendorId}`]: timestamp,
          [`sellosLocales.${vendorId}`]: FieldValue.increment(1),
        });
      } else {
        tx.set(userRef, {
          comprasRealizadas: 1,
          recompensaDisponible: false,
          puntos: 100,
          totalCanjesHistoricos: 0,
          baneado: false,
          createdAt: timestamp,
          lastVendorScans: { [vendorId]: timestamp },
          sellosLocales: { [vendorId]: 1 },
        });
      }

      result = { userId, userName: realUserName, vendorName: vendorName || "el local", nuevoTotal };
    });

    // Fire-and-forget side effects
    const timestamp = new Date().toISOString();
    (async () => {
      try {
        const currentMonth = timestamp.substring(0, 7);
        await Promise.all([
          adminDb.collection("system_logs").add({
            usuario: result!.userName,
            usuarioId: result!.userId,
            vendedorId: vendorId,
            accion: "recibió un sello (vendor-scan)",
            fecha: timestamp,
            tipo: "FIDELIZACION",
            metodo: "VENDOR_SCAN",
            monto,
          }),
          adminDb.collection("usuarios").doc(vendorId).collection("ventas_registradas").add({
            vendedorId: vendorId,
            clienteId: result!.userId,
            clienteNombre: result!.userName,
            fecha: timestamp,
            metodo: "VENDOR_SCAN",
            monto,
          }),
          adminDb.collection("usuarios").doc(vendorId).update({
            sellosEntregadosHistorico: FieldValue.increment(1),
            [`sellosEntregadosMensual.${currentMonth}`]: FieldValue.increment(1),
          }),
          adminDb.collection("usuarios").doc(result!.userId).collection("notificaciones").add({
            titulo: "¡Sello Confirmado! ✅",
            mensaje: `Tu compra en ${result!.vendorName} fue registrada. ¡Un sello más para tu premio!`,
            leida: false,
            fecha: timestamp,
          }),
        ]);
      } catch (e) {
        console.warn("[vendor-scan] Side effect failed:", e);
      }
    })();

    return NextResponse.json({ success: true, ...result! });
  } catch (error: any) {
    console.error("[vendor-scan] Error:", error);
    return NextResponse.json({ error: error.message ?? "Error interno" }, { status: 500 });
  }
}
