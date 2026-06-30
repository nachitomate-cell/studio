/**
 * POST /api/handshake/boleta-scan
 *
 * Flujo AUTO-SERVICIO con boleta. Cubre dos tipos de comercio:
 *
 *   - "asociado"  → el cliente ingresa el monto y sube la foto de la boleta;
 *                   los sellos salen de calcularSellos(monto).
 *   - "membresia" → el cliente elige un tier fijo (mensual/trimestral/...)
 *                   y sube la boleta; los sellos salen de TIER_SELLOS[tier]
 *                   sin tomar en cuenta el monto.
 *
 * En ambos casos el sello se otorga al instante; el moderador audita después y
 * puede anular si el cliente mintió (de monto o de tier).
 *
 * El sello se acredita al CLIENTE autenticado (uid del token), no al vendedor.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { vendorId: string, boletaPath: string,
 *            monto?: number,                    // requerido si asociado
 *            tier?: "mensual"|"trimestral"|... } // requerido si membresia
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { procesarReferidoPendiente } from "@/lib/referralAdmin";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  calcularSellos, SELLOS_PARA_PREMIO, MONTO_MAX,
  calcularSellosMembresia, esMembresiaTier, TIER_LABEL, MembresiaTier,
} from "@/lib/sellos";
import { esAsociado, esMembresia } from "@/lib/tipoComercio";
import { aplicarEntregaConRecompensa } from "@/lib/recompensaEmprendedor";

// Anti-doble-envío de la misma boleta: 1 boleta por local cada 5 min por usuario.
const COOLDOWN_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(`boleta-scan:${ip}`, 15, 60_000)) {
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
    const userId = decoded.uid;

    const { vendorId, monto, boletaPath, tier } = await request.json();

    if (!vendorId || typeof vendorId !== "string") {
      return NextResponse.json({ error: "vendorId requerido" }, { status: 400 });
    }
    if (!boletaPath || typeof boletaPath !== "string") {
      return NextResponse.json({ error: "La foto de la boleta es obligatoria." }, { status: 400 });
    }

    // El local debe ser asociado o membresía; los emprendedores siguen handshake.
    const vendorSnap = await adminDb.collection("entrepreneur_profiles").doc(vendorId).get();
    if (!vendorSnap.exists) {
      return NextResponse.json({ error: "Local no encontrado." }, { status: 404 });
    }
    const vendorData = vendorSnap.data();
    const isMembresia = esMembresia(vendorData);
    const isAsociado = esAsociado(vendorData);
    if (!isMembresia && !isAsociado) {
      return NextResponse.json({ error: "Este local no admite auto-servicio por boleta." }, { status: 400 });
    }
    const vendorName = vendorData?.businessName || vendorData?.nombre || "el local";

    // Validación específica por tipo de comercio.
    let tierValidado: MembresiaTier | null = null;
    if (isMembresia) {
      if (!esMembresiaTier(tier)) {
        return NextResponse.json({ error: "Debes elegir un plan (mensual, trimestral, semestral o anual)." }, { status: 400 });
      }
      tierValidado = tier;
    } else {
      if (typeof monto !== "number" || monto <= 0 || monto > MONTO_MAX) {
        return NextResponse.json({ error: `El monto es obligatorio y debe estar entre $1 y $${MONTO_MAX.toLocaleString("es-CL")}.` }, { status: 400 });
      }
    }

    const userRef = adminDb.collection("usuarios").doc(userId);
    let result: { userId: string; userName: string; nuevoTotal: number; numSellos: number; prevSellos: number };

    await adminDb.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error("Usuario no encontrado.");

      const u = userSnap.data()!;
      if (u.baneado) throw new Error("Usuario baneado — no se puede otorgar el sello.");

      // Cooldown por usuario+local (evita re-subir la misma boleta).
      const lastScan: string | undefined = u.lastVendorScans?.[vendorId];
      if (lastScan && Date.now() - new Date(lastScan).getTime() < COOLDOWN_MS) {
        throw new Error("Ya registraste una compra en este local hace poco. Intenta más tarde.");
      }

      const numSellos = tierValidado ? calcularSellosMembresia(tierValidado) : calcularSellos(monto);
      const prevSellos = u.comprasRealizadas || 0;
      const nuevoTotal = prevSellos + numSellos;
      const timestamp = new Date().toISOString();
      const realUserName = u.nombre || u.correo || "Miembro";

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

      result = { userId, userName: realUserName, nuevoTotal, numSellos, prevSellos };
    });

    // ── Efectos secundarios (fire-and-forget) ──────────────────────────────
    const timestamp = new Date().toISOString();
    (async () => {
      try {
        const { nuevoTotal, numSellos, prevSellos, userName } = result!;

        const metodo = tierValidado ? "CLIENT_MEMBRESIA" : "CLIENT_BOLETA";
        const accion = tierValidado
          ? `recibió ${numSellos} ${numSellos === 1 ? "sello" : "sellos"} por membresía ${TIER_LABEL[tierValidado].toLowerCase()}`
          : `recibió ${numSellos} ${numSellos === 1 ? "sello" : "sellos"} por boleta ($${(monto as number).toLocaleString("es-CL")})`;

        await Promise.all([
          // Log con la boleta adjunta para auditoría del moderador
          adminDb.collection("system_logs").add({
            usuario: userName,
            usuarioId: userId,
            vendedorId: vendorId,
            accion,
            fecha: timestamp,
            tipo: "FIDELIZACION",
            metodo,
            ...(tierValidado ? { tier: tierValidado } : { monto }),
            numSellos,
            boletaPath,
            boletaUrl: null, // el moderador (staff) resuelve la URL desde boletaPath al auditar
            revisada: false,
          }),
          adminDb.collection("usuarios").doc(vendorId).collection("ventas_registradas").add({
            vendedorId: vendorId,
            clienteId: userId,
            clienteNombre: userName,
            fecha: timestamp,
            metodo,
            ...(tierValidado ? { tier: tierValidado } : { monto }),
            numSellos,
            boletaPath,
          }),
          aplicarEntregaConRecompensa(vendorId, numSellos, timestamp),
        ]);

        // Notificación al cliente (Firestore + push FCM)
        const premioAlcanzado = Math.floor(nuevoTotal / SELLOS_PARA_PREMIO) > Math.floor(prevSellos / SELLOS_PARA_PREMIO);
        const sellosLabel = numSellos === 1 ? "sello" : "sellos";
        const notifTitulo = premioAlcanzado ? "¡Premio disponible! 🎁" : `+${numSellos} ${sellosLabel} en ${vendorName} ✅`;
        const notifMensaje = premioAlcanzado
          ? `¡Completaste ${nuevoTotal} sellos! Ya puedes canjear tu recompensa.`
          : `Llevas ${nuevoTotal} ${nuevoTotal === 1 ? "sello" : "sellos"}. ¡Sigue sumando!`;
        const notifCta = premioAlcanzado ? "/premios" : "/";

        const [, clientSnap] = await Promise.all([
          adminDb.collection("usuarios").doc(userId).collection("notificaciones").add({
            titulo: notifTitulo, mensaje: notifMensaje, leida: false, fecha: timestamp,
            tipo: premioAlcanzado ? "PREMIO" : "SELLO", cta: notifCta, fuente: "boleta_scan",
          }),
          adminDb.collection("usuarios").doc(userId).get(),
        ]);

        const fcmToken = clientSnap.data()?.fcmToken as string | undefined;
        if (fcmToken) {
          const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://clubpatiocurauma.synaptechspa.cl";
          await adminMessaging.send({
            token: fcmToken,
            notification: { title: notifTitulo, body: notifMensaje },
            data: { type: premioAlcanzado ? "PREMIO" : "SELLO", cta: notifCta },
            android: { priority: "high", notification: { channelId: "club_patio_default", icon: "ic_notification", color: "#4EAD1F" } },
            apns: { payload: { aps: { badge: 1, sound: premioAlcanzado ? "alert" : "default" } } },
            webpush: { fcmOptions: { link: `${BASE_URL}${notifCta}` } },
          });
        }

        await procesarReferidoPendiente(userId, userName);
      } catch (e) {
        console.warn("[boleta-scan] Side effect failed:", e);
      }
    })();

    return NextResponse.json({ success: true, ...result! });
  } catch (error: any) {
    console.error("[boleta-scan] Error:", error);
    const msg: string = error.message ?? "Error interno";
    const status = msg.includes("hace poco") ? 429 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
