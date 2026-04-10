
import {
  doc, getDoc, updateDoc, setDoc, Firestore, increment,
  collection, addDoc, runTransaction, serverTimestamp, deleteDoc
} from "firebase/firestore";
import { enviarNotificacionLocal } from "./notificaciones";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export async function registrarCompra(db: Firestore, userId: string, vendedorId?: string, isClientScan: boolean = false) {
  const userRef = doc(db, "usuarios", userId);
  
  try {
    const userSnap = await getDoc(userRef);
    const timestamp = new Date().toISOString();
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        comprasRealizadas: 1,
        recompensaDisponible: false,
        puntos: 100,
        totalCanjesHistoricos: 0,
        baneado: false,
        createdAt: timestamp,
        lastVendorScans: vendedorId ? { [vendedorId]: timestamp } : {},
        sellosLocales: vendedorId ? { [vendedorId]: 1 } : {}
      });
      return;
    }

    const data = userSnap.data();

    // BLOQUEO DE SEGURIDAD: No sumar sellos si el usuario está baneado
    if (data.baneado) {
      console.warn("Intento de sumar sellos a usuario baneado:", userId);
      return;
    }

    // BLOQUEO ANTI-FRAUDE: cooldown de 12 horas POR LOCAL
    if (isClientScan && vendedorId) {
      const lastScans = data.lastVendorScans || {};
      const lastScanTime = lastScans[vendedorId];
      if (lastScanTime) {
        const hoursSinceLast = (Date.now() - new Date(lastScanTime).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < 12) {
          throw new Error("Debes esperar 12 horas antes de volver a sumar un sello en este local.");
        }
      }
    }

    const nuevasCompras = (data.comprasRealizadas || 0) + 1;
    const clienteNombre = data.nombre || data.correo || "Miembro del Club";

    const updateData: any = {
      comprasRealizadas: increment(1),
      recompensaDisponible: nuevasCompras >= 5,
      puntos: increment(50),
      lastPurchaseAt: timestamp,
      lastUpdate: timestamp,
    };

    // Cooldown por local: escritura con clave específica para evitar race conditions
    if (isClientScan && vendedorId) {
      updateData[`lastVendorScans.${vendedorId}`] = timestamp;
    }

    if (vendedorId) {
      updateData[`sellosLocales.${vendedorId}`] = increment(1);
    }

    await updateDoc(userRef, updateData).catch((error) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'update',
        requestResourceData: { comprasRealizadas: nuevasCompras },
      }));
    });

    // Auditoría de Sistema (Para el Radar de Fraude)
    const logRef = collection(db, "system_logs");
    await addDoc(logRef, {
      usuario: clienteNombre,
      usuarioId: userId,
      vendedorId: vendedorId || "simulacion",
      accion: "recibió un sello",
      fecha: timestamp,
      tipo: "FIDELIZACION",
      metodo: isClientScan ? "CLIENT_SCAN" : "VENDOR_SCAN"
    });

    if (nuevasCompras % 5 === 0) {
      await enviarNotificacionLocal(userId, "¡Premio Listo! 🎁", `¡Felicidades! Has completado ${nuevasCompras} sellos. Canjea tu premio ahora.`);
    } else {
      await enviarNotificacionLocal(userId, "¡Sello Recibido! ✨", `Has sumado un nuevo sello en Patio Curauma. ¡Te faltan pocos para tu premio!`);
    }

    if (vendedorId) {
      const vendedorLogRef = collection(db, "usuarios", vendedorId, "ventas_registradas");
      addDoc(vendedorLogRef, {
        vendedorId,
        clienteId: userId,
        clienteNombre,
        fecha: timestamp,
        metodo: isClientScan ? "CLIENT_SCAN" : "VENDOR_SCAN"
      });

      if (isClientScan) {
        await enviarNotificacionLocal(vendedorId, "¡Cliente Auto-Verificado! ✅", `${clienteNombre} acaba de escanear tu código y ganó un sello.`);
      } else {
        await enviarNotificacionLocal(vendedorId, "Venta Exitosa ✅", `Has entregado un sello a ${clienteNombre}.`);
      }
    }
    
  } catch (error) {
    console.error("Error crítico en registrarCompra:", error);
    throw error;
  }
}

function generarCodigoVoucher(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "CP-";
  for (let i = 0; i < 8; i++) {
    if (i === 4) codigo += "-";
    codigo += chars[Math.floor(Math.random() * chars.length)];
  }
  return codigo;
}

export async function canjearRecompensa(
  db: Firestore,
  userId: string,
  costo: number,
  premioNombre: string = "Premio",
  userEmail?: string
): Promise<{ codigoVoucher: string; canjeId: string }> {
  const userRef = doc(db, "usuarios", userId);

  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("Usuario no encontrado.");

    const data = userSnap.data();
    if (data.baneado) throw new Error("Usuario baneado.");

    const sellosActuales = data.comprasRealizadas || 0;
    if (sellosActuales < costo) throw new Error("No tienes suficientes sellos.");

    const nuevasCompras = sellosActuales - costo;
    const timestamp = new Date().toISOString();
    const codigoVoucher = generarCodigoVoucher();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // 1. Crear el ticket (crítico — si falla, abortamos todo)
    const canjeRef = await addDoc(collection(db, "canjes_activos"), {
      userId,
      usuarioNombre: data.nombre || data.correo || userEmail || "Miembro",
      premioNombre,
      codigoVoucher,
      costo,
      estado: "pendiente",
      fechaEmision: timestamp,
      fechaExpiracion: expiresAt,
    });

    // 2. Descontar sellos del usuario (crítico)
    await updateDoc(userRef, {
      comprasRealizadas: nuevasCompras,
      recompensaDisponible: nuevasCompras >= 5,
      totalCanjesHistoricos: increment(1),
      lastCanjeAt: timestamp,
    });

    // 3. Retornar resultado YA — antes de operaciones auxiliares que pueden fallar
    const result = { codigoVoucher, canjeId: canjeRef.id };

    // 4. Operaciones no-críticas: no bloquean ni lanzan error al caller
    (async () => {
      try {
        await addDoc(collection(db, "system_logs"), {
          usuario: data.nombre || data.correo,
          usuarioId: userId,
          accion: `canjeó "${premioNombre}" (voucher: ${codigoVoucher})`,
          fecha: timestamp,
          tipo: "CANJE",
        });
        await enviarNotificacionLocal(
          userId,
          "Canje Confirmado 🎫",
          `Tu voucher para "${premioNombre}" es: ${codigoVoucher}. Válido 48 horas. ¡Muéstralo en caja!`
        );
      } catch (auxError) {
        console.warn("Operación auxiliar de canje falló (no crítico):", auxError);
      }
    })();

    return result;
  } catch (error) {
    console.error("Error al canjear recompensa:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDSHAKE DIGITAL
// ─────────────────────────────────────────────────────────────────────────────

/** Crea un pending_stamp. Lanza error si hay cooldown activo (12h por local). */
export async function crearPendingStamp(
  db: Firestore,
  userId: string,
  userName: string,
  vendorId: string
): Promise<string> {
  const userRef = doc(db, "usuarios", userId);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    if (data.baneado) throw new Error("Usuario baneado.");

    const lastScans = data.lastVendorScans || {};
    const lastScanTime = lastScans[vendorId];
    if (lastScanTime) {
      const hoursSinceLast = (Date.now() - new Date(lastScanTime).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast < 12) {
        const horasRestantes = Math.ceil(12 - hoursSinceLast);
        throw new Error(
          `Debes esperar ${horasRestantes} hora${horasRestantes !== 1 ? "s" : ""} antes de volver a sumar un sello en este local.`
        );
      }
    }
  }

  const pendingRef = await addDoc(collection(db, "pending_stamps"), {
    userId,
    userName: userName || "Miembro del Club",
    vendorId,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  return pendingRef.id;
}

/** Cancela (elimina) un pending_stamp creado por el cliente. */
export async function cancelarPendingStamp(db: Firestore, pendingId: string): Promise<void> {
  await deleteDoc(doc(db, "pending_stamps", pendingId));
}

/**
 * Confirma un sello via handshake. Transacción atómica:
 *  1. Valida que la solicitud esté pendiente y no haya expirado (5 min).
 *  2. Incrementa sellos del usuario.
 *  3. Marca la solicitud como 'confirmed'.
 */
export async function confirmarHandshake(
  db: Firestore,
  pendingId: string,
  monto: number = 0
): Promise<{ userId: string; vendorId: string; userName: string; nuevoTotal: number }> {
  const pendingRef = doc(db, "pending_stamps", pendingId);

  const result = await runTransaction(db, async (transaction) => {
    const pendingSnap = await transaction.get(pendingRef);
    if (!pendingSnap.exists()) throw new Error("Solicitud no encontrada.");

    const pending = pendingSnap.data();
    if (pending.status !== "pending") {
      if (pending.status === "expired") throw new Error("La solicitud ya expiró.");
      throw new Error("La solicitud ya fue procesada.");
    }

    // Validar expiración de 5 minutos
    const createdAt: Date = pending.createdAt?.toDate?.() ?? new Date(0);
    const minutesElapsed = (Date.now() - createdAt.getTime()) / 60000;
    if (minutesElapsed > 5) {
      transaction.update(pendingRef, { status: "expired" });
      throw new Error("La solicitud expiró. Han pasado más de 5 minutos.");
    }

    const { userId, vendorId, userName } = pending;
    const userRef = doc(db, "usuarios", userId);
    const userSnap = await transaction.get(userRef);

    const timestamp = new Date().toISOString();
    const currentSellos = userSnap.exists() ? (userSnap.data().comprasRealizadas || 0) : 0;
    const nuevoTotal = currentSellos + 1;

    // Confirmar solicitud
    transaction.update(pendingRef, {
      status: "confirmed",
      monto,
      confirmedAt: serverTimestamp(),
    });

    // Actualizar usuario
    if (userSnap.exists()) {
      transaction.update(userRef, {
        comprasRealizadas: increment(1),
        recompensaDisponible: nuevoTotal >= 5,
        puntos: increment(50),
        lastPurchaseAt: timestamp,
        lastUpdate: timestamp,
        [`lastVendorScans.${vendorId}`]: timestamp,
        [`sellosLocales.${vendorId}`]: increment(1),
      });
    } else {
      transaction.set(userRef, {
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

    return { userId, vendorId, userName, nuevoTotal };
  });

  // Operaciones no críticas (fuera de la transacción)
  const timestamp = new Date().toISOString();
  (async () => {
    try {
      await addDoc(collection(db, "system_logs"), {
        usuario: result.userName,
        usuarioId: result.userId,
        vendedorId: result.vendorId,
        accion: "recibió un sello (handshake)",
        fecha: timestamp,
        tipo: "FIDELIZACION",
        metodo: "HANDSHAKE",
        monto,
      });
      await addDoc(collection(db, "usuarios", result.vendorId, "ventas_registradas"), {
        vendedorId: result.vendorId,
        clienteId: result.userId,
        clienteNombre: result.userName,
        fecha: timestamp,
        metodo: "HANDSHAKE",
        monto,
      });
      await enviarNotificacionLocal(
        result.userId,
        "¡Sello Confirmado! ✅",
        `Tu sello fue aprobado. ¡Te faltan pocos para tu próximo premio!`
      );
      if (result.nuevoTotal % 5 === 0) {
        await enviarNotificacionLocal(result.userId, "¡Premio Listo! 🎁", `¡Felicidades! Completaste ${result.nuevoTotal} sellos.`);
      }
    } catch (e) {
      console.warn("[Handshake] Operación auxiliar falló:", e);
    }
  })();

  return result;
}

/** Rechaza un pending_stamp. No incrementa sellos. */
export async function rechazarHandshake(
  db: Firestore,
  pendingId: string
): Promise<void> {
  const pendingRef = doc(db, "pending_stamps", pendingId);
  const pendingSnap = await getDoc(pendingRef);
  if (!pendingSnap.exists()) throw new Error("Solicitud no encontrada.");

  const { userId, vendorId, userName } = pendingSnap.data();
  const timestamp = new Date().toISOString();

  await updateDoc(pendingRef, { status: "rejected" });

  // Log no crítico
  (async () => {
    try {
      await addDoc(collection(db, "system_logs"), {
        usuario: userName,
        usuarioId: userId,
        vendedorId: vendorId,
        accion: "sello rechazado (handshake)",
        fecha: timestamp,
        tipo: "SELLO_RECHAZADO",
        metodo: "HANDSHAKE",
      });
    } catch (e) {
      console.warn("[Handshake] Log de rechazo falló:", e);
    }
  })();
}
