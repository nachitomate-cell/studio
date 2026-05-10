/**
 * POST /api/handshake/confirm
 *
 * Confirma un sello via Handshake Digital usando Admin SDK (server-side).
 * Reemplaza la transacción client-side de confirmarHandshake() para que
 * la regla isEmprendedor() no necesite escribir en usuarios/{userId}.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { pendingId: string, monto?: number }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { procesarReferidoPendiente } from "@/lib/referralAdmin";

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
    const { pendingId, monto = 0 } = await request.json();

    if (!pendingId) {
      return NextResponse.json({ error: "pendingId requerido" }, { status: 400 });
    }
    if (typeof monto !== "number" || monto <= 0 || monto > 150_000) {
      return NextResponse.json({ error: "El monto de la venta es obligatorio y debe estar entre $1 y $150.000." }, { status: 400 });
    }

    const pendingRef = adminDb.collection("pending_stamps").doc(pendingId);
    let result: { userId: string; vendorId: string; userName: string; nuevoTotal: number };

    await adminDb.runTransaction(async (tx) => {
      const pendingSnap = await tx.get(pendingRef);
      if (!pendingSnap.exists) throw new Error("Solicitud no encontrada.");

      const pending = pendingSnap.data()!;

      if (pending.vendorId !== vendorId) {
        throw new Error("No tienes permiso para confirmar esta solicitud.");
      }

      if (pending.status !== "pending") {
        if (pending.status === "expired") throw new Error("La solicitud ya expiró.");
        throw new Error("La solicitud ya fue procesada.");
      }

      // Validar expiración de 5 minutos
      const createdAt: Date = pending.createdAt?.toDate?.() ?? new Date(0);
      const minutesElapsed = (Date.now() - createdAt.getTime()) / 60000;
      if (minutesElapsed > 5) {
        tx.update(pendingRef, { status: "expired" });
        throw new Error("La solicitud expiró. Han pasado más de 5 minutos.");
      }

      const { userId, userName } = pending;
      const userRef = adminDb.collection("usuarios").doc(userId);
      const userSnap = await tx.get(userRef);

      const timestamp = new Date().toISOString();
      const currentSellos = userSnap.exists ? (userSnap.data()!.comprasRealizadas || 0) : 0;
      const nuevoTotal = currentSellos + 1;
      const realUserName = (userSnap.exists ? userSnap.data()!.nombre : null) || userName || "Miembro";

      tx.update(pendingRef, {
        status: "confirmed",
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

      result = { userId, vendorId, userName: realUserName, nuevoTotal };
    });

    // Operaciones no críticas fuera de la transacción (fire-and-forget)
    const timestamp = new Date().toISOString();
    (async () => {
      try {
        await adminDb.collection("system_logs").add({
          usuario: result!.userName,
          usuarioId: result!.userId,
          vendedorId: result!.vendorId,
          accion: "recibió un sello (handshake)",
          fecha: timestamp,
          tipo: "FIDELIZACION",
          metodo: "HANDSHAKE",
          monto,
        });

        await adminDb
          .collection("usuarios").doc(result!.vendorId)
          .collection("ventas_registradas").add({
            vendedorId: result!.vendorId,
            clienteId: result!.userId,
            clienteNombre: result!.userName,
            fecha: timestamp,
            metodo: "HANDSHAKE",
            monto,
          });

        const currentMonth = timestamp.substring(0, 7);
        await adminDb.collection("usuarios").doc(result!.vendorId).update({
          sellosEntregadosHistorico: FieldValue.increment(1),
          [`sellosEntregadosMensual.${currentMonth}`]: FieldValue.increment(1),
        });

        await adminDb
          .collection("usuarios").doc(result!.userId)
          .collection("notificaciones").add({
            titulo: "¡Sello Confirmado! ✅",
            mensaje: "Tu sello fue aprobado. ¡Te faltan pocos para tu próximo premio!",
            leida: false,
            fecha: timestamp,
          });

        if (result!.nuevoTotal % 5 === 0) {
          await adminDb
            .collection("usuarios").doc(result!.userId)
            .collection("notificaciones").add({
              titulo: "¡Premio Listo! 🎁",
              mensaje: `¡Felicidades! Completaste ${result!.nuevoTotal} sellos.`,
              leida: false,
              fecha: timestamp,
            });
        }

        // Capa 1: si este es el primer sello real del usuario, otorgar sello al referidor
        await procesarReferidoPendiente(result!.userId, result!.userName);
      } catch (e) {
        console.warn("[handshake/confirm] Operación auxiliar falló:", e);
      }
    })();

    return NextResponse.json({ success: true, ...result! });
  } catch (error: any) {
    console.error("[handshake/confirm] Error:", error);
    const status = error.message?.includes("expiró") ? 410 : 500;
    return NextResponse.json({ error: error.message ?? "Error interno" }, { status });
  }
}
