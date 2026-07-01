/**
 * POST /api/mundial/unlock
 *
 * Peaje del módulo Mundialista: cobra 3 sellos por única vez y marca
 * `mundialUnlocked: true` en el documento del usuario. A partir de ese
 * momento el usuario puede pronosticar todos los partidos sin volver a pagar.
 *
 * Headers: Authorization: Bearer <idToken>
 * Body: (vacío)
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { checkRateLimit } from "@/lib/rateLimit";

const COSTO_PASE_LIBRE = 3;

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(`mundial-unlock:${ip}`, 10, 60_000)) {
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

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new Error("Usuario no encontrado.");

      const data = snap.data()!;
      if (data.baneado) throw new Error("Usuario baneado.");

      if (data.mundialUnlocked === true) {
        return { alreadyUnlocked: true, sellosRestantes: data.comprasRealizadas || 0 };
      }

      const sellosActuales: number = data.comprasRealizadas || 0;
      if (sellosActuales < COSTO_PASE_LIBRE) {
        throw new Error(
          `Necesitas al menos ${COSTO_PASE_LIBRE} sellos para desbloquear el pase libre.`,
        );
      }

      tx.update(userRef, {
        comprasRealizadas: FieldValue.increment(-COSTO_PASE_LIBRE),
        recompensaDisponible: sellosActuales - COSTO_PASE_LIBRE >= 5,
        mundialUnlocked: true,
        mundialUnlockedAt: new Date().toISOString(),
      });

      return {
        alreadyUnlocked: false,
        sellosRestantes: sellosActuales - COSTO_PASE_LIBRE,
      };
    });

    // Log no crítico
    if (!result.alreadyUnlocked) {
      (async () => {
        try {
          await adminDb.collection("system_logs").add({
            usuarioId: userId,
            usuario: decoded.email ?? "Usuario",
            accion: `desbloqueó el Pase Libre Mundialista (-${COSTO_PASE_LIBRE} sellos)`,
            fecha: new Date().toISOString(),
            tipo: "MUNDIAL_UNLOCK",
          });
        } catch (e) {
          console.warn("[mundial/unlock] Log falló:", e);
        }
      })();
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("[mundial/unlock] Error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Error interno" },
      { status: 400 },
    );
  }
}
