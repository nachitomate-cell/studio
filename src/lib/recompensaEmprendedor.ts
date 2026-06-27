/**
 * Recompensa al emprendedor / comercio asociado:
 * por cada N sellos que entrega a sus clientes, suma 1 sello propio.
 *
 * Configurable desde /moderador (doc configuracion/general.recompensaEmprendedor).
 * Centraliza la actualización atómica de:
 *   - sellosEntregadosHistorico / sellosEntregadosMensual.{YYYY-MM} (siempre)
 *   - comprasRealizadas / sellosHistoricos / recompensaDisponible (cuando se cruza umbral)
 */

import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export interface ConfigRecompensaEmprendedor {
  activo: boolean;
  cada: number;
}

const DEFAULT_CADA = 5;
const SELLOS_PARA_PREMIO = 5;
const CACHE_TTL_MS = 60_000;

let cache: { value: ConfigRecompensaEmprendedor; expiresAt: number } | null = null;

export async function getConfigRecompensaEmprendedor(): Promise<ConfigRecompensaEmprendedor> {
  if (cache && Date.now() < cache.expiresAt) return cache.value;
  try {
    const snap = await adminDb.collection("configuracion").doc("general").get();
    const raw = snap.exists ? (snap.data()?.recompensaEmprendedor as any) : null;
    const value: ConfigRecompensaEmprendedor = {
      activo: raw?.activo === true,
      cada: Math.max(1, Math.min(50, Number(raw?.cada ?? DEFAULT_CADA))),
    };
    cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    return { activo: false, cada: DEFAULT_CADA };
  }
}

/** Permite invalidar la caché tras guardar la config. */
export function invalidarConfigRecompensaCache(): void {
  cache = null;
}

/**
 * Aplica al vendedor:
 *  - Incremento de contadores de entregas (siempre).
 *  - Sellos de bonificación si la recompensa está activa y se cruzó un múltiplo de `cada`.
 *
 * @returns cantidad de sellos de bonificación otorgados al vendedor (0 si no aplica).
 */
export async function aplicarEntregaConRecompensa(
  vendorId: string,
  numSellosEntregados: number,
  timestamp: string
): Promise<number> {
  const config = await getConfigRecompensaEmprendedor();
  const currentMonth = timestamp.substring(0, 7);
  const vendorRef = adminDb.collection("usuarios").doc(vendorId);

  if (!config.activo) {
    await vendorRef.update({
      sellosEntregadosHistorico: FieldValue.increment(numSellosEntregados),
      [`sellosEntregadosMensual.${currentMonth}`]: FieldValue.increment(numSellosEntregados),
    });
    return 0;
  }

  let recompensa = 0;

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(vendorRef);
    const prev = Number((snap.exists && snap.data()!.sellosEntregadosHistorico) || 0);
    const next = prev + numSellosEntregados;
    recompensa = Math.floor(next / config.cada) - Math.floor(prev / config.cada);

    const update: Record<string, any> = {
      sellosEntregadosHistorico: FieldValue.increment(numSellosEntregados),
      [`sellosEntregadosMensual.${currentMonth}`]: FieldValue.increment(numSellosEntregados),
    };

    if (recompensa > 0) {
      const sellosPrev = Number((snap.exists && snap.data()!.comprasRealizadas) || 0);
      const sellosNuevo = sellosPrev + recompensa;
      update.comprasRealizadas = FieldValue.increment(recompensa);
      update.sellosHistoricos = FieldValue.increment(recompensa);
      update.recompensaDisponible = sellosNuevo >= SELLOS_PARA_PREMIO;
      update.sellosBonificacionHistorico = FieldValue.increment(recompensa);
      update.lastBonusAt = timestamp;
    }

    tx.update(vendorRef, update);
  });

  if (recompensa > 0) {
    try {
      const vendorSnap = await vendorRef.get();
      const vendorNombre =
        vendorSnap.data()?.nombre ||
        vendorSnap.data()?.businessName ||
        vendorSnap.data()?.correo ||
        "Local";

      await adminDb.collection("system_logs").add({
        usuario: vendorNombre,
        usuarioId: vendorId,
        vendedorId: vendorId,
        accion: `bonus por entregas: +${recompensa} ${recompensa === 1 ? "sello" : "sellos"} (cada ${config.cada} entregas)`,
        fecha: timestamp,
        tipo: "FIDELIZACION",
        metodo: "BONUS_ENTREGAS",
        numSellos: recompensa,
      });

      await adminDb
        .collection("usuarios").doc(vendorId)
        .collection("notificaciones").add({
          titulo: "¡Sello de bonificación! 🎁",
          mensaje: `Sumaste +${recompensa} ${recompensa === 1 ? "sello" : "sellos"} por entregar ${config.cada} sellos a tus clientes.`,
          leida: false,
          fecha: timestamp,
          tipo: "BONUS",
        });
    } catch (e) {
      console.warn("[recompensaEmprendedor] Side effect falló:", e);
    }
  }

  return recompensa;
}
