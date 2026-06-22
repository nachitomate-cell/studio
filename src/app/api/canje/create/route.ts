/**
 * POST /api/canje/create
 *
 * Crea un canje de premio (o ticket de sorteo) de forma ATÓMICA y server-side
 * usando el Admin SDK. Reemplaza la transacción client-side de canjearPremio(),
 * que era falsificable: un atacante podía crear el voucher en `canjes` sin gastar
 * sellos. Aquí el costo y el tipo (esSorteo) se leen del documento oficial
 * `premios/{premioId}` — nunca se confía en el cliente.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { premioId: string }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { checkRateLimit } from "@/lib/rateLimit";

/** Código único: prefijo del premio + timestamp base36 + random. */
function generarCodigoUnico(premioNombre: string): string {
  const prefijo = (premioNombre || "PREMIO")
    .substring(0, 4)
    .toUpperCase()
    .replace(/\s/g, "X")
    .replace(/[^A-Z0-9X]/g, "X");
  const ts = Date.now().toString(36).slice(-5).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefijo}-${ts}${rnd}`;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(`canje:${ip}`, 15, 60_000)) {
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

    const { premioId } = await request.json();
    if (!premioId || typeof premioId !== "string") {
      return NextResponse.json({ error: "premioId requerido" }, { status: 400 });
    }

    const expiraEn = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const codigo = generarCodigoUnico("");

    const userRef = adminDb.collection("usuarios").doc(userId);
    const premioRef = adminDb.collection("premios").doc(premioId);

    let out: {
      sorteo: boolean;
      canjeId?: string;
      codigo?: string;
      ticketsSorteo?: number;
      premioNombre: string;
    };

    await adminDb.runTransaction(async (tx) => {
      const [userSnap, premioSnap] = await Promise.all([tx.get(userRef), tx.get(premioRef)]);

      if (!userSnap.exists) throw new Error("Usuario no encontrado.");
      if (!premioSnap.exists) throw new Error("Premio no encontrado.");

      const u = userSnap.data()!;
      const p = premioSnap.data()!;

      if (u.baneado) throw new Error("Usuario baneado.");

      // Costo y tipo SIEMPRE desde el servidor — el cliente no puede manipularlos.
      const costo: number = p.sellosRequeridos ?? p.costo ?? 0;
      if (typeof costo !== "number" || costo <= 0) {
        throw new Error("Este premio no tiene un costo válido.");
      }

      const sellosActuales: number = u.comprasRealizadas || 0;
      if (sellosActuales < costo) throw new Error("No tienes suficientes sellos.");

      const premioNombre: string = p.nombre || "Premio";

      // ── Sorteo: solo descuenta sellos y suma un ticket, sin voucher ──────────
      if (p.esSorteo === true) {
        tx.update(userRef, {
          comprasRealizadas: FieldValue.increment(-costo),
          recompensaDisponible: sellosActuales - costo >= 5,
          ticketsSorteo: FieldValue.increment(1),
        });
        const nuevosTickets = (u.ticketsSorteo || 0) + 1;
        out = { sorteo: true, premioNombre, ticketsSorteo: nuevosTickets };
        return;
      }

      // ── Premio normal: valida stock, descuenta sellos y crea voucher ─────────
      if (typeof p.stock === "number" && p.stock <= 0) {
        throw new Error("Lo sentimos, este premio se ha agotado.");
      }

      const canjeRef = adminDb.collection("canjes").doc();
      tx.set(canjeRef, {
        clienteId: userId,
        clienteNombre: u.nombre || u.correo || "Miembro del Club",
        premioId,
        premioNombre,
        premioIcono: p.icono || "🎁",
        vendorId: p.vendorId || "",
        vendorNombre: p.vendorNombre || "Patio Curauma",
        sellosDescontados: costo,
        codigo,
        status: "pending",
        creadoEn: FieldValue.serverTimestamp(),
        expiraEn,
      });

      tx.update(userRef, {
        comprasRealizadas: FieldValue.increment(-costo),
        recompensaDisponible: sellosActuales - costo >= 5,
        totalCanjesHistoricos: FieldValue.increment(1),
        lastCanjeAt: new Date().toISOString(),
      });

      if (typeof p.stock === "number") {
        tx.update(premioRef, { stock: FieldValue.increment(-1) });
      }

      out = { sorteo: false, canjeId: canjeRef.id, codigo, premioNombre };
    });

    // Log no crítico
    (async () => {
      try {
        await adminDb.collection("system_logs").add({
          usuario: out!.premioNombre,
          usuarioId: userId,
          accion: out!.sorteo
            ? `generó un ticket de sorteo ("${out!.premioNombre}")`
            : `canjeó premio "${out!.premioNombre}" (código: ${out!.codigo})`,
          fecha: new Date().toISOString(),
          tipo: out!.sorteo ? "TICKET_SORTEO" : "CANJE_PREMIO",
        });
      } catch (e) {
        console.warn("[canje/create] Log falló:", e);
      }
    })();

    return NextResponse.json({ success: true, ...out! });
  } catch (error: any) {
    console.error("[canje/create] Error:", error);
    return NextResponse.json({ error: error.message ?? "Error interno" }, { status: 400 });
  }
}
