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
import { adminAuth, adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { procesarReferidoPendiente } from "@/lib/referralAdmin";
import { checkRateLimit } from "@/lib/rateLimit";
import { aplicarEntregaConRecompensa } from "@/lib/recompensaEmprendedor";
import { calcularSellos, SELLOS_PARA_PREMIO } from "@/lib/sellos";
import { getEscalaMontoActiva } from "@/lib/escalaSellos";
import { assertFueraDeCooldown } from "@/lib/cooldownSello";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(`vendor-scan:${ip}`, 15, 60_000)) {
      return NextResponse.json({ error: "Demasiadas solicitudes. Intenta en un momento." }, { status: 429 });
    }

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

    const escalaActiva = await getEscalaMontoActiva();

    const pendingRef = adminDb.collection("pending_stamps").doc(pendingId);
    let result: { userId: string; userName: string; vendorName: string; nuevoTotal: number; numSellos: number; prevSellos: number };

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

      if (userSnap.exists && userSnap.data()!.baneado) {
        throw new Error("Usuario baneado — no se puede otorgar el sello.");
      }

      // Misma red de seguridad que en handshake/confirm: nada de dos sellos
      // seguidos del mismo local al mismo cliente.
      assertFueraDeCooldown(userSnap.exists ? userSnap.data() : null, vendorId);

      const prevSellos = userSnap.exists ? (userSnap.data()!.comprasRealizadas || 0) : 0;
      const numSellos = escalaActiva ? calcularSellos(monto) : 1;
      const nuevoTotal = prevSellos + numSellos;
      const timestamp = new Date().toISOString();
      console.log(`[DEBUG POLLA] handshake/vendor-scan — uid=${userId} prev=${prevSellos} +${numSellos} new=${nuevoTotal} monto=${monto}`);
      const realUserName = (userSnap.exists ? userSnap.data()!.nombre : null) || userName || "Miembro";

      tx.update(pendingRef, {
        status: "vendor_confirmed",
        monto,
        numSellos,
        nuevoTotal,
        confirmedAt: FieldValue.serverTimestamp(),
      });

      if (userSnap.exists) {
        tx.update(userRef, {
          comprasRealizadas: FieldValue.increment(numSellos),
          sellosHistoricos: FieldValue.increment(numSellos),
          recompensaDisponible: nuevoTotal >= SELLOS_PARA_PREMIO,
          puntos: FieldValue.increment(50 * numSellos),
          lastPurchaseAt: timestamp,
          lastUpdate: timestamp,
          [`lastVendorScans.${vendorId}`]: timestamp,
          [`sellosLocales.${vendorId}`]: FieldValue.increment(numSellos),
        });
      } else {
        tx.set(userRef, {
          comprasRealizadas: numSellos,
          sellosHistoricos: numSellos,
          recompensaDisponible: nuevoTotal >= SELLOS_PARA_PREMIO,
          puntos: numSellos * 50,
          totalCanjesHistoricos: 0,
          baneado: false,
          createdAt: timestamp,
          lastVendorScans: { [vendorId]: timestamp },
          sellosLocales: { [vendorId]: numSellos },
        });
      }

      result = { userId, userName: realUserName, vendorName: vendorName || "el local", nuevoTotal, numSellos, prevSellos };
    });

    // Fire-and-forget side effects
    const timestamp = new Date().toISOString();
    (async () => {
      try {
        const { nuevoTotal, vendorName, userId, numSellos, prevSellos } = result!;

        // Logs, ventas y contadores del vendedor (incluye bonus por entregas si está activo)
        await Promise.all([
          adminDb.collection("system_logs").add({
            usuario: result!.userName,
            usuarioId: result!.userId,
            vendedorId: vendorId,
            accion: `recibió ${numSellos} ${numSellos === 1 ? "sello" : "sellos"} (vendor-scan, $${monto.toLocaleString("es-CL")})`,
            fecha: timestamp,
            tipo: "FIDELIZACION",
            metodo: "VENDOR_SCAN",
            monto,
            numSellos,
          }),
          adminDb.collection("usuarios").doc(vendorId).collection("ventas_registradas").add({
            vendedorId: vendorId,
            clienteId: result!.userId,
            clienteNombre: result!.userName,
            fecha: timestamp,
            metodo: "VENDOR_SCAN",
            monto,
            numSellos,
          }),
          aplicarEntregaConRecompensa(vendorId, numSellos, timestamp),
        ]);

        // Notificación al cliente con push FCM
        // Detecta si se cruzó algún umbral de premio (funciona con múltiples sellos por compra)
        const premioAlcanzado = Math.floor(nuevoTotal / SELLOS_PARA_PREMIO) > Math.floor(prevSellos / SELLOS_PARA_PREMIO);
        const faltanPara = premioAlcanzado ? 0 : SELLOS_PARA_PREMIO - (nuevoTotal % SELLOS_PARA_PREMIO);

        const sellosLabel = numSellos === 1 ? "sello" : "sellos";
        const notifTitulo = premioAlcanzado
          ? "¡Premio disponible! 🎁"
          : `+${numSellos} ${sellosLabel} en ${vendorName} ✅`;
        const notifMensaje = premioAlcanzado
          ? `¡Completaste ${nuevoTotal} sellos! Ya puedes canjear tu recompensa en caja.`
          : `Llevas ${nuevoTotal} ${nuevoTotal === 1 ? "sello" : "sellos"}. ¡${faltanPara} más para tu próximo premio! 🎯`;
        const notifCta = premioAlcanzado ? "/premios" : "/";

        // Guardar en Firestore y leer FCM token en paralelo
        const [, clientSnap] = await Promise.all([
          adminDb.collection("usuarios").doc(userId).collection("notificaciones").add({
            titulo: notifTitulo,
            mensaje: notifMensaje,
            leida: false,
            fecha: timestamp,
            tipo: premioAlcanzado ? "PREMIO" : "SELLO",
            cta: notifCta,
            fuente: "vendor_scan",
          }),
          adminDb.collection("usuarios").doc(userId).get(),
        ]);

        // Enviar push si el cliente tiene FCM token registrado
        const fcmToken = clientSnap.data()?.fcmToken as string | undefined;
        if (fcmToken) {
          const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://clubpatiocurauma.synaptechspa.cl";
          const link = `${BASE_URL}${notifCta}`;
          await adminMessaging.send({
            token: fcmToken,
            notification: { title: notifTitulo, body: notifMensaje },
            data: { type: premioAlcanzado ? "PREMIO" : "SELLO", cta: notifCta },
            android: {
              priority: "high",
              notification: { channelId: "club_patio_default", icon: "ic_notification", color: "#4EAD1F" },
            },
            apns: { payload: { aps: { badge: 1, sound: premioAlcanzado ? "alert" : "default" } } },
            webpush: { fcmOptions: { link } },
          });
        }

        // Si este es el primer sello real del usuario, otorgar sello al referidor
        await procesarReferidoPendiente(result!.userId, result!.userName);
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
