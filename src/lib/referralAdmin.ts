/**
 * referralAdmin.ts
 *
 * Lógica de referidos que corre en el servidor (Admin SDK).
 * Se llama después de confirmar la primera compra real de un usuario
 * (HANDSHAKE o VENDOR_SCAN) para otorgar el sello al referidor solo
 * cuando hay actividad real en el Club — no al momento del registro.
 */

import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Tope de bonos por referido por mes calendario (Capa 2)
const MAX_BONOS_REFERIDO_MES = 3;

/**
 * Verifica si existe un referido pendiente para `newUserId`.
 * Si existe y el referidor no superó el tope mensual, le otorga +1 sello.
 * Idempotente: el doc se marca "completed" en la transacción — llamadas
 * repetidas no tienen efecto.
 */
export async function procesarReferidoPendiente(
  newUserId: string,
  newUserName: string
): Promise<void> {
  const pendingRef = adminDb.collection("referidos_pendientes").doc(newUserId);
  const pendingSnap = await pendingRef.get();

  if (!pendingSnap.exists || pendingSnap.data()!.status !== "pending") return;

  const { referrerId, referrerName: storedReferrerName } = pendingSnap.data()!;
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

  const referrerRef = adminDb.collection("usuarios").doc(referrerId);

  let awarded = false;
  let capReached = false;

  await adminDb.runTransaction(async (tx) => {
    const [pendingDoc, referrerDoc] = await Promise.all([
      tx.get(pendingRef),
      tx.get(referrerRef),
    ]);

    // Doble-check dentro de la transacción (idempotencia)
    if (!pendingDoc.exists || pendingDoc.data()!.status !== "pending") return;

    // Marcar como completado independientemente del resultado
    tx.update(pendingRef, {
      status: "completed",
      procesadoEn: FieldValue.serverTimestamp(),
    });

    if (!referrerDoc.exists || referrerDoc.data()!.baneado) return;

    // Capa 2: tope mensual
    const bonosMes = referrerDoc.data()!.bonosReferidoMensual?.[currentMonth] || 0;
    if (bonosMes >= MAX_BONOS_REFERIDO_MES) {
      capReached = true;
      return;
    }

    const referrerSellos = (referrerDoc.data()!.comprasRealizadas || 0) + 1;
    tx.update(referrerRef, {
      comprasRealizadas: FieldValue.increment(1),
      puntos: FieldValue.increment(50),
      recompensaDisponible: referrerSellos >= 5,
      referidosExitosos: FieldValue.increment(1),
      [`bonosReferidoMensual.${currentMonth}`]: FieldValue.increment(1),
      lastUpdate: new Date().toISOString(),
    });
    awarded = true;
  });

  // Notificaciones y logs (no críticos)
  const timestamp = new Date().toISOString();
  try {
    if (awarded) {
      await Promise.all([
        adminDb.collection("usuarios").doc(referrerId).collection("notificaciones").add({
          titulo: "¡Tu referido visitó un local! 🎉",
          mensaje: `${newUserName} realizó su primera visita en el Club. ¡Ganaste 1 sello de recompensa!`,
          leida: false,
          fecha: timestamp,
        }),
        adminDb.collection("system_logs").add({
          usuario: storedReferrerName || "Referidor",
          usuarioId: referrerId,
          accion: `recibió sello por referido exitoso — ${newUserName} realizó primera visita`,
          fecha: timestamp,
          tipo: "REFERIDO",
          metodo: "SISTEMA",
        }),
      ]);
    } else if (capReached) {
      await adminDb.collection("usuarios").doc(referrerId).collection("notificaciones").add({
        titulo: "Límite mensual alcanzado",
        mensaje: `${newUserName} visitó el Club, pero ya alcanzaste el límite de ${MAX_BONOS_REFERIDO_MES} bonos de referido este mes. ¡Sigue refiriendo el próximo mes!`,
        leida: false,
        fecha: timestamp,
      });
    }
  } catch (e) {
    console.warn("[referralAdmin] Notificación falló (no crítico):", e);
  }
}
