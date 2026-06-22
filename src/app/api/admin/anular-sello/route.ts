import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const ALLOWED_ROLES = ["admin", "moderador", "director", "director_patio"];

export async function POST(req: NextRequest) {
  // ── 1. Autenticación ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let callerUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  // ── 2. Autorización por rol ─────────────────────────────────────────────────
  const callerSnap = await adminDb.collection("usuarios").doc(callerUid).get();
  const callerRol = callerSnap.data()?.rol as string | undefined;
  if (!callerSnap.exists || !callerRol || !ALLOWED_ROLES.includes(callerRol)) {
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

  // ── 5. Transacción atómica ──────────────────────────────────────────────────
  let nuevoTotal: number;
  try {
    nuevoTotal = await adminDb.runTransaction(async (tx) => {
      const userRef = adminDb.collection("usuarios").doc(usuarioId);
      const vendorRef = (vendedorId && vendedorId !== "simulacion")
        ? adminDb.collection("usuarios").doc(vendedorId)
        : null;

      // ── Todas las lecturas primero ────────────────────────────────────────
      const reads = await Promise.all([
        tx.get(userRef),
        vendorRef ? tx.get(vendorRef) : Promise.resolve(null),
      ]);
      const userSnap = reads[0];
      const vendorSnap = reads[1];

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
      tx.update(userRef, {
        comprasRealizadas: nuevoSellos,
        sellosHistoricos: Math.max(0, sellosHistoricos - n),
        recompensaDisponible: nuevoSellos >= 5,
      });

      if (vendorRef && vendorSnap?.exists) {
        const entregados: number = vendorSnap.data()!.sellosEntregadosHistorico ?? 0;
        tx.update(vendorRef, {
          sellosEntregadosHistorico: Math.max(0, entregados - n),
        });
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

      return nuevoSellos;
    });
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

  return NextResponse.json({ ok: true, nuevoTotal });
}
