
import {
  doc, getDoc, updateDoc, setDoc, Firestore, increment,
  collection, addDoc, runTransaction, serverTimestamp, deleteDoc,
  query, where, getDocs, writeBatch,
} from "firebase/firestore";
import { auth } from "./firebase";
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
      vendedorId: vendedorId || (metodoOverride === "MODERADOR_GRANT" ? "MODERADOR" : "simulacion"),
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

      // Bonus por entregas: si está activo, sumar 1 sello propio al vendedor cada N entregas.
      // Se hace fuera del batch para no romper el flujo principal si Firestore rules lo bloquean.
      try {
        const configSnap = await getDoc(doc(db, "configuracion", "general"));
        const cfg = configSnap.exists() ? (configSnap.data()?.recompensaEmprendedor as any) : null;
        if (cfg?.activo === true) {
          const cada = Math.max(1, Math.min(50, Number(cfg.cada ?? 5)));
          const vendorRef = doc(db, "usuarios", vendedorId);
          const recompensa = await runTransaction(db, async (tx) => {
            const snap = await tx.get(vendorRef);
            if (!snap.exists()) return 0;
            const data = snap.data();
            const entregados = Number(data.sellosEntregadosHistorico || 0);
            const prev = entregados - 1; // ya se sumó 1 en el batch previo
            const bonus = Math.floor(entregados / cada) - Math.floor(prev / cada);
            if (bonus <= 0) return 0;
            const sellosPrev = Number(data.comprasRealizadas || 0);
            const sellosNuevo = sellosPrev + bonus;
            tx.update(vendorRef, {
              comprasRealizadas: increment(bonus),
              sellosHistoricos: increment(bonus),
              recompensaDisponible: sellosNuevo >= 5,
              sellosBonificacionHistorico: increment(bonus),
              lastBonusAt: timestamp,
            });
            return bonus;
          });
          if (recompensa > 0) {
            await enviarNotificacionLocal(
              vendedorId,
              "¡Sello de bonificación! 🎁",
              `Sumaste +${recompensa} ${recompensa === 1 ? "sello" : "sellos"} por entregar ${cada} sellos a tus clientes.`,
            );
          }
        }
      } catch (e) {
        console.warn("[registrarCompra] Bonus por entregas falló (no crítico):", e);
      }

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

// NOTA: confirmarHandshake() (client-side) fue eliminada por seguridad (MEDIA-2).
// La confirmación de sellos ahora corre EXCLUSIVAMENTE server-side vía Admin SDK
// en /api/handshake/confirm y /api/handshake/vendor-scan.

// ─────────────────────────────────────────────────────────────────────────────
// CANJES DE PREMIOS (colección 'canjes')
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CRÍTICA-1: el canje de premios ahora corre EXCLUSIVAMENTE server-side.
 * Este helper llama a /api/canje/create con el ID token del usuario. El backend
 * (Admin SDK) lee el costo/tipo del premio desde Firestore y descuenta sellos de
 * forma atómica — el cliente ya no puede fabricar vouchers sin gastar sellos.
 *
 * Devuelve { sorteo:false, canjeId, codigo } para premios normales,
 * o { sorteo:true, ticketsSorteo } para sorteos.
 */
export async function canjearPremioRemoto(premioId: string): Promise<{
  sorteo: boolean;
  canjeId?: string;
  codigo?: string;
  ticketsSorteo?: number;
  premioNombre?: string;
}> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Sin sesión activa.");

  const res = await fetch("/api/canje/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ premioId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "No se pudo procesar el canje.");
  return data;
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
