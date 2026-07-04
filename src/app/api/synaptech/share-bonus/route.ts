/**
 * POST /api/synaptech/share-bonus
 *
 * Otorga el sello bonus por compartir SynapTech (una única vez por usuario).
 * Corre server-side con Admin SDK para saltar las reglas que impiden al cliente
 * escribir en `comprasRealizadas` (firestore.rules:66-71).
 *
 * Idempotente: si `hasSynapTechShared === true` retorna 400 sin modificar nada.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body: (vacío)
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(`synap-share:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta en un momento." },
        { status: 429 },
      );
    }

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

    const userId = decoded.uid;
    const userRef = adminDb.collection("usuarios").doc(userId);
    const timestamp = new Date().toISOString();

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error("Usuario no encontrado.");

      const data = snap.data()!;
      if (data.baneado) throw new Error("Usuario baneado.");

      if (data.hasSynapTechShared === true) {
        const err: any = new Error("Bonus ya reclamado.");
        err.status = 400;
        throw err;
      }

      const prevSellos = Number(data.comprasRealizadas || 0);
      const nuevoTotal = prevSellos + 1;

      tx.update(userRef, {
        hasSynapTechShared: true,
        hasSynapTechStamp: true,
        comprasRealizadas: FieldValue.increment(1),
        sellosHistoricos: FieldValue.increment(1),
        recompensaDisponible: nuevoTotal >= 5,
        puntos: FieldValue.increment(50),
        lastUpdate: timestamp,
        synapTechShareBonusAt: timestamp,
      });

      return { prevSellos, nuevoTotal, nombre: data.nombre || data.correo || "Miembro" };
    });

    console.log(`[DEBUG POLLA] synaptech/share-bonus — uid=${userId} bonus=+1 prev=${result.prevSellos} new=${result.nuevoTotal}`);

    (async () => {
      try {
        await adminDb.collection("system_logs").add({
          usuario: result.nombre,
          usuarioId: userId,
          accion: "recibió +1 sello por compartir SynapTech",
          fecha: timestamp,
          tipo: "FIDELIZACION",
          metodo: "SYNAP_SHARE",
        });
      } catch (e) {
        console.warn("[synaptech/share-bonus] Log falló:", e);
      }
    })();

    return NextResponse.json({ ok: true, prevSellos: result.prevSellos, nuevoTotal: result.nuevoTotal });
  } catch (error: any) {
    const status = error?.status ?? 400;
    console.error("[synaptech/share-bonus] Error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Error interno" },
      { status },
    );
  }
}
