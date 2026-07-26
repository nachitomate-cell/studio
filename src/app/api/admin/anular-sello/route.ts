/**
 * POST /api/admin/anular-sello
 *
 * Revierte por completo un sello ya acreditado. "Por completo" es literal: al
 * otorgar un sello se tocan SEIS cosas (saldo, histórico, puntos, sellos por
 * local, contadores del local y la venta registrada), asi que anularlo debe
 * deshacer las seis. Antes solo deshacia el saldo y el historico, y el resto
 * quedaba inflado en silencio: los puntos no bajaban, el local seguia contando
 * la entrega en su ranking mensual y la venta seguia sumando al reporte.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { logId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS, ROLES_STAFF_PANEL, PUNTOS_POR_COMPRA } from "@/lib/constants";

export async function POST(req: NextRequest) {
  // ── 1. Autenticación ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let callerUid: string;
  let callerEmail: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
    callerEmail = (decoded.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  // ── 2. Autorización ─────────────────────────────────────────────────────────
  // Acepta el campo legacy `rol` y el array `roles` — un moderador guardado solo
  // con el array recibia 403 aunque tuviera el permiso.
  let autorizado = ALLOWED_MOD_EMAILS.includes(callerEmail);
  if (!autorizado) {
    const callerSnap = await adminDb.collection("usuarios").doc(callerUid).get();
    const callerData = callerSnap.exists ? callerSnap.data()! : null;
    const callerRol: string = callerData?.rol ?? "";
    const callerRoles: string[] = Array.isArray(callerData?.roles) ? callerData.roles : [];
    autorizado =
      ROLES_STAFF_PANEL.includes(callerRol) ||
      callerRoles.some((r) => ROLES_STAFF_PANEL.includes(r));
  }
  if (!autorizado) {
    return NextResponse.json({ error: "Permiso insuficiente" }, { status: 403 });
  }

  // ── 3. Validar body ─────────────────────────────────────────────────────────
  let logId: string;
  try {
    const body = await req.json();
    logId = body.logId;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  if (!logId) {
    return NextResponse.json({ error: "logId requerido" }, { status: 400 });
  }

  // ── 4. Leer el registro ─────────────────────────────────────────────────────
  const logRef = adminDb.collection("system_logs").doc(logId);
  const logSnap = await logRef.get();

  if (!logSnap.exists) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  const logData = logSnap.data()!;

  if (logData.tipo !== "FIDELIZACION") {
    return NextResponse.json({ error: "Solo se pueden anular registros de tipo FIDELIZACION" }, { status: 400 });
  }
  if (logData.anulada === true) {
    return NextResponse.json({ error: "Este sello ya fue anulado anteriormente" }, { status: 409 });
  }

  const { usuarioId, vendedorId } = logData;
  if (!usuarioId) {
    return NextResponse.json({ error: "Registro sin usuarioId" }, { status: 400 });
  }

  // El log y la venta se escriben con el MISMO timestamp en todos los flujos de
  // sello (handshake/confirm, vendor-scan, boleta-scan y registrarCompra), asi
  // que `fecha` es la llave para reencontrar la venta que hay que borrar.
  const fechaLog: string = logData.fecha ?? "";
  const mesLog = fechaLog.substring(0, 7); // YYYY-MM

  // ── 5. Transacción atómica ──────────────────────────────────────────────────
  let nuevoTotal: number;
  let ventasBorradas = 0;
  try {
    const resultado = await adminDb.runTransaction(async (tx) => {
      const userRef = adminDb.collection("usuarios").doc(usuarioId);
      const vendorRef = (vendedorId && vendedorId !== "simulacion" && vendedorId !== "MODERADOR")
        ? adminDb.collection("usuarios").doc(vendedorId)
        : null;

      // ── Todas las lecturas primero ────────────────────────────────────────
      const ventasQuery = (vendorRef && fechaLog)
        ? vendorRef.collection("ventas_registradas")
            .where("clienteId", "==", usuarioId)
            .where("fecha", "==", fechaLog)
        : null;

      const [userSnap, vendorSnap, ventasSnap] = await Promise.all([
        tx.get(userRef),
        vendorRef ? tx.get(vendorRef) : Promise.resolve(null),
        ventasQuery ? tx.get(ventasQuery) : Promise.resolve(null),
      ]);

      if (!userSnap.exists) throw new Error("Usuario no encontrado");

      const data = userSnap.data()!;
      const sellosActuales: number = data.comprasRealizadas ?? 0;
      const sellosHistoricos: number = data.sellosHistoricos ?? sellosActuales;

      if (sellosActuales <= 0) {
        throw new Error("El usuario ya tiene 0 sellos, no se puede anular");
      }

      // Restar la cantidad real de sellos del registro (boletas/handshake pueden dar 1–4).
      const n: number = logData.numSellos ?? 1;
      const nuevoSellos = Math.max(0, sellosActuales - n);

      // ── Todas las escrituras después ──────────────────────────────────────
      const updateUsuario: Record<string, any> = {
        comprasRealizadas: nuevoSellos,
        sellosHistoricos: Math.max(0, sellosHistoricos - n),
        recompensaDisponible: nuevoSellos >= 5,
        // Cada sello acredita PUNTOS_POR_COMPRA; anularlo debe devolverlos.
        puntos: Math.max(0, (data.puntos ?? 0) - PUNTOS_POR_COMPRA * n),
      };

      // Sellos acumulados por local (alimenta el detalle del cliente por comercio)
      if (vendedorId && data.sellosLocales?.[vendedorId] != null) {
        updateUsuario[`sellosLocales.${vendedorId}`] =
          Math.max(0, Number(data.sellosLocales[vendedorId]) - n);
      }

      tx.update(userRef, updateUsuario);

      if (vendorRef && vendorSnap?.exists) {
        const vData = vendorSnap.data()!;
        const entregados: number = vData.sellosEntregadosHistorico ?? 0;
        const updateVendor: Record<string, any> = {
          sellosEntregadosHistorico: Math.max(0, entregados - n),
        };
        // El contador mensual alimenta el ranking del panel directivo: si no se
        // descuenta, el local queda premiado por una entrega que ya no existe.
        if (mesLog && vData.sellosEntregadosMensual?.[mesLog] != null) {
          updateVendor[`sellosEntregadosMensual.${mesLog}`] =
            Math.max(0, Number(vData.sellosEntregadosMensual[mesLog]) - n);
        }
        tx.update(vendorRef, updateVendor);
      }

      // La venta no ocurrió: se elimina del registro operativo del local. La
      // auditoría se conserva en system_logs, que queda marcado como anulado.
      let borradas = 0;
      if (ventasSnap) {
        for (const d of ventasSnap.docs) {
          tx.delete(d.ref);
          borradas++;
        }
      }

      // Marcar el log como anulado (conservar como auditoría). Se limpia la
      // referencia a la boleta porque la imagen se elimina de Storage al anular.
      tx.update(logRef, {
        anulada: true,
        anuladaPor: callerUid,
        anuladaEn: new Date().toISOString(),
        boletaPath: null,
        boletaUrl: null,
      });

      return { nuevoSellos, borradas };
    });
    nuevoTotal = resultado.nuevoSellos;
    ventasBorradas = resultado.borradas;
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Error en transacción" }, { status: 400 });
  }

  // ── 6. Sincronizar Google Wallet (fire-and-forget) ─────────────────────────
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://clubpatiocurauma.synaptechspa.cl";

  fetch(`${baseUrl}/api/google-wallet`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: usuarioId, stampsCount: nuevoTotal }),
  }).catch((e) => console.warn("[anular-sello] Wallet sync falló (no crítico):", e));

  return NextResponse.json({ ok: true, nuevoTotal, ventasBorradas });
}
