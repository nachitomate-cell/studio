
import {
  doc, getDoc, updateDoc, setDoc, Firestore, increment,
  collection, addDoc, runTransaction, serverTimestamp, deleteDoc,
  query, where, getDocs, writeBatch,
} from "firebase/firestore";
import { enviarNotificacionLocal } from "./notificaciones";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { syncUserStampsToWallet } from "./walletSync";

export async function registrarCompra(db: Firestore, userId: string, vendedorId?: string, isClientScan: boolean = false, metodoOverride?: string) {
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

    const nuevasCompras = (data.comprasRealizadas || 0) + 1;
    const clienteNombre = data.nombre || data.correo || "Miembro del Club";

    const updateData: any = {
      comprasRealizadas: increment(1),
      sellosHistoricos: increment(1),
      recompensaDisponible: nuevasCompras >= 5,
      puntos: increment(50),
      lastPurchaseAt: timestamp,
      lastUpdate: timestamp,
    };

    // Registro de último sello por local (auditoría)
    if (isClientScan && vendedorId) {
      updateData[`lastVendorScans.${vendedorId}`] = timestamp;
    }

    if (vendedorId) {
      updateData[`sellosLocales.${vendedorId}`] = increment(1);
    }

    // CRÍTICO-06: re-throw para que el flujo no continúe con una escritura fallida.
    // Sin esto, el usuario recibía notificación "¡Sello Recibido!" aunque el sello nunca se acreditó.
    await updateDoc(userRef, updateData).catch((error) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'update',
        requestResourceData: { comprasRealizadas: nuevasCompras },
      }));
      throw error;
    });

    // Sincronizar Google Wallet (fire-and-forget — no bloquea el flujo)
    syncUserStampsToWallet(userId, nuevasCompras);

    // Auditoría de Sistema (Para el Radar de Fraude)
    const logRef = collection(db, "system_logs");
    await addDoc(logRef, {
      usuario: clienteNombre,
      usuarioId: userId,
      vendedorId: vendedorId || "simulacion",
      accion: "recibió un sello",
      fecha: timestamp,
      tipo: "FIDELIZACION",
      metodo: metodoOverride ?? (isClientScan ? "CLIENT_SCAN" : "VENDOR_SCAN")
    });

    if (nuevasCompras % 5 === 0) {
      await enviarNotificacionLocal(userId, "¡Premio Listo! 🎁", `¡Felicidades! Has completado ${nuevasCompras} sellos. Canjea tu premio ahora.`);
    } else {
      await enviarNotificacionLocal(userId, "¡Sello Recibido! ✨", `Has sumado un nuevo sello en Patio Curauma. ¡Te faltan pocos para tu premio!`);
    }

    if (vendedorId) {
      // Batch atómico: venta + contador juntos para evitar contadores desincronizados
      const currentMonth = timestamp.substring(0, 7); // YYYY-MM
      const ventaRef = doc(collection(db, "usuarios", vendedorId, "ventas_registradas"));
      const batch = writeBatch(db);
      batch.set(ventaRef, {
        vendedorId,
        clienteId: userId,
        clienteNombre,
        fecha: timestamp,
        metodo: metodoOverride ?? (isClientScan ? "CLIENT_SCAN" : "VENDOR_SCAN"),
      });
      const vendorCounterUpdate: Record<string, any> = {
        sellosEntregadosHistorico: increment(1),
        [`sellosEntregadosMensual.${currentMonth}`]: increment(1),
      };
      if (metodoOverride === "REFERIDO") {
        vendorCounterUpdate.clientesNuevosRegistrados = increment(1);
      }
      batch.update(doc(db, "usuarios", vendedorId), vendorCounterUpdate);
      await batch.commit().catch((e) => console.warn("[registrarCompra] Batch vendor falló:", e));

      if (metodoOverride === "REFERIDO") {
        await enviarNotificacionLocal(vendedorId, "¡Nuevo Socio Captado! 🎉", `${clienteNombre} se registró en el Club usando tu QR. +1 sello atribuido a tu local.`);
      } else if (isClientScan) {
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
  const codigoVoucher = generarCodigoVoucher();
  const timestamp = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  try {
    // CRÍTICO-05: operación atómica — lectura + crear voucher + descontar sellos
    // en una sola transacción. Elimina la race condition de doble-click/doble-pestaña.
    const result = await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("Usuario no encontrado.");

      const data = userSnap.data();
      if (data.baneado) throw new Error("Usuario baneado.");

      const sellosActuales = data.comprasRealizadas || 0;
      if (sellosActuales < costo) throw new Error("No tienes suficientes sellos.");

      const nuevasCompras = sellosActuales - costo;
      const usuarioNombre = data.nombre || data.correo || userEmail || "Miembro";

      // Crear voucher con ref pre-generado (sin await dentro de transaction)
      const canjeRef = doc(collection(db, "canjes_activos"));
      transaction.set(canjeRef, {
        userId,
        usuarioNombre,
        premioNombre,
        codigoVoucher,
        costo,
        estado: "pendiente",
        fechaEmision: timestamp,
        fechaExpiracion: expiresAt,
      });

      // Descontar sellos atómicamente
      transaction.update(userRef, {
        comprasRealizadas: nuevasCompras,
        recompensaDisponible: nuevasCompras >= 5,
        totalCanjesHistoricos: increment(1),
        lastCanjeAt: timestamp,
      });

      return { canjeId: canjeRef.id, usuarioNombre };
    });

    // Operaciones no-críticas fuera de la transacción
    (async () => {
      try {
        await addDoc(collection(db, "system_logs"), {
          usuario: result.usuarioNombre,
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

    return { codigoVoucher, canjeId: result.canjeId };
  } catch (error) {
    console.error("Error al canjear recompensa:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDSHAKE DIGITAL
// ─────────────────────────────────────────────────────────────────────────────

/** Crea un pending_stamp en Firestore para el flujo Handshake Digital. */
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
    // Usar el nombre real del perfil, no el del pending_stamps (que puede ser genérico)
    const realUserName = (userSnap.exists() ? userSnap.data().nombre : null) || userName || "Miembro";

    // Confirmar solicitud (nuevoTotal se escribe para que el cliente
    // pueda leerlo desde el onSnapshot y mostrar el total correcto)
    transaction.update(pendingRef, {
      status: "confirmed",
      monto,
      nuevoTotal,
      confirmedAt: serverTimestamp(),
    });

    // Actualizar usuario
    if (userSnap.exists()) {
      transaction.update(userRef, {
        comprasRealizadas: increment(1),
        sellosHistoricos: increment(1),
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
        sellosHistoricos: 1,
        recompensaDisponible: false,
        puntos: 100,
        totalCanjesHistoricos: 0,
        baneado: false,
        createdAt: timestamp,
        lastVendorScans: { [vendorId]: timestamp },
        sellosLocales: { [vendorId]: 1 },
      });
    }

    return { userId, vendorId, userName: realUserName, nuevoTotal };
  });

  // Sincronizar Google Wallet (fire-and-forget — no bloquea el handshake)
  syncUserStampsToWallet(result.userId, result.nuevoTotal);

  // Operaciones no críticas (fuera de la transacción)
  const timestamp = new Date().toISOString();
  (async () => {
    try {
      // Batch atómico: log + venta + contador para evitar contadores desincronizados
      const currentMonth = timestamp.substring(0, 7); // YYYY-MM
      const auxBatch = writeBatch(db);
      auxBatch.set(doc(collection(db, "system_logs")), {
        usuario: result.userName,
        usuarioId: result.userId,
        vendedorId: result.vendorId,
        accion: "recibió un sello (handshake)",
        fecha: timestamp,
        tipo: "FIDELIZACION",
        metodo: "HANDSHAKE",
        monto,
      });
      auxBatch.set(doc(collection(db, "usuarios", result.vendorId, "ventas_registradas")), {
        vendedorId: result.vendorId,
        clienteId: result.userId,
        clienteNombre: result.userName,
        fecha: timestamp,
        metodo: "HANDSHAKE",
        monto,
      });
      auxBatch.update(doc(db, "usuarios", result.vendorId), {
        sellosEntregadosHistorico: increment(1),
        [`sellosEntregadosMensual.${currentMonth}`]: increment(1),
      });
      await auxBatch.commit();
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

// ─────────────────────────────────────────────────────────────────────────────
// CANJES DE PREMIOS (colección 'canjes')
// ─────────────────────────────────────────────────────────────────────────────

// Genera un código único localmente sin queries a Firestore.
// Timestamp base36 (últimos 5 chars, ~ms de unicidad) + random 4 chars.
// Colisión prácticamente imposible: para coincidir, dos canjes deben generarse
// en el mismo milisegundo Y la parte random (36^4 = 1.6M combinaciones) debe ser igual.
function generarCodigoUnico(premioNombre: string): string {
  const prefijo = premioNombre
    .substring(0, 4)
    .toUpperCase()
    .replace(/\s/g, "X")
    .replace(/[^A-Z0-9X]/g, "X");
  const ts  = Date.now().toString(36).slice(-5).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefijo}-${ts}${rnd}`;
}

export interface PremioParaCanje {
  id: string;
  nombre: string;
  icono: string;
  vendorId: string;
  vendorNombre: string;
  sellosRequeridos: number;
}

/** Crea un canje en la colección 'canjes'. Transacción atómica: descuenta sellos + crea documento. */
export async function canjearPremio(
  db: Firestore,
  userId: string,
  userName: string,
  premio: PremioParaCanje
): Promise<{ canjeId: string; codigo: string }> {
  const codigo = generarCodigoUnico(premio.nombre);
  const expiraEn = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const userRef = doc(db, "usuarios", userId);
  const premioRef = doc(db, "premios", premio.id);

  const canjeId = await runTransaction(db, async (transaction) => {
    // 1. Obtener usuario y premio en paralelo dentro de la transacción
    const [userSnap, premioSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(premioRef),
    ]);

    if (!userSnap.exists()) throw new Error("Usuario no encontrado.");
    const userData = userSnap.data();
    if (userData.baneado) throw new Error("Usuario baneado.");

    // 2. Validar Stock (si el campo existe y es número)
    if (premioSnap.exists()) {
      const pData = premioSnap.data();
      if (typeof pData.stock === "number" && pData.stock <= 0) {
        throw new Error("Lo sentimos, este premio se ha agotado.");
      }
    }

    // 3. Validar Sellos
    const sellosActuales = userData.comprasRealizadas || 0;
    if (sellosActuales < premio.sellosRequeridos) {
      throw new Error("No tienes suficientes sellos.");
    }

    const nuevoTotal = sellosActuales - premio.sellosRequeridos;
    const canjeRef = doc(collection(db, "canjes"));

    // 4. Crear el canje
    transaction.set(canjeRef, {
      clienteId: userId,
      clienteNombre: userData.nombre || userName || "Miembro del Club",
      premioId: premio.id,
      premioNombre: premio.nombre,
      premioIcono: premio.icono,
      vendorId: premio.vendorId,
      vendorNombre: premio.vendorNombre,
      sellosDescontados: premio.sellosRequeridos,
      codigo,
      status: "pending",
      creadoEn: serverTimestamp(),
      expiraEn,
    });

    // 5. Descontar sellos
    transaction.update(userRef, {
      comprasRealizadas: increment(-premio.sellosRequeridos),
      recompensaDisponible: nuevoTotal >= 5,
    });

    // 6. Decrementar stock si aplica
    if (premioSnap.exists() && typeof premioSnap.data()?.stock === "number") {
      transaction.update(premioRef, { stock: increment(-1) });
    }

    return canjeRef.id;
  });

  // Log no crítico
  (async () => {
    try {
      await addDoc(collection(db, "system_logs"), {
        usuario: userName || "Miembro del Club",
        usuarioId: userId,
        vendedorId: premio.vendorId,
        accion: `canjeó premio "${premio.nombre}" (código: ${codigo})`,
        fecha: new Date().toISOString(),
        tipo: "CANJE_PREMIO",
      });
    } catch (e) {
      console.warn("[canjearPremio] Log falló:", e);
    }
  })();

  return { canjeId, codigo };
}

/** Marca como expirados los canjes del usuario que superaron las 48h. */
export async function verificarCanjesExpirados(db: Firestore, userId: string): Promise<void> {
  try {
    const ahora = new Date().toISOString();
    const snap = await getDocs(
      query(collection(db, "canjes"), where("clienteId", "==", userId), where("status", "==", "pending"))
    );
    const batch = writeBatch(db);
    let changed = false;
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.expiraEn && data.expiraEn < ahora) {
        batch.update(docSnap.ref, { status: "expired" });
        changed = true;
      }
    });
    if (changed) await batch.commit();
  } catch (e) {
    console.warn("[verificarCanjesExpirados]", e);
  }
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

  // Resolver nombre real del usuario
  let realUserName = userName;
  try {
    const userSnap = await getDoc(doc(db, "usuarios", userId));
    if (userSnap.exists()) realUserName = userSnap.data().nombre || userName;
  } catch { /* no crítico */ }

  await updateDoc(pendingRef, { status: "rejected" });

  // Log no crítico
  (async () => {
    try {
      await addDoc(collection(db, "system_logs"), {
        usuario: realUserName,
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
