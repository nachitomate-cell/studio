
import { doc, getDoc, updateDoc, setDoc, Firestore, increment, collection, addDoc } from "firebase/firestore";
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

    // BLOQUEO ANTI-FRAUDE (COOLDOWN de 12 horas)
    const lastScans = data.lastVendorScans || {};
    if (isClientScan && vendedorId) {
      const lastScanTime = lastScans[vendedorId];
      if (lastScanTime) {
        const hoursSinceLast = (Date.now() - new Date(lastScanTime).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < 12) {
          throw new Error("Debes esperar 12 horas antes de volver a sumar un sello en este local.");
        }
      }
      lastScans[vendedorId] = timestamp;
    }

    const nuevasCompras = (data.comprasRealizadas || 0) + 1;
    const clienteNombre = data.nombre || data.correo || "Miembro del Club";
    
    const updateData: any = {
      comprasRealizadas: increment(1),
      recompensaDisponible: nuevasCompras >= 5,
      puntos: increment(50),
      lastPurchaseAt: timestamp,
      lastUpdate: timestamp,
      lastVendorScans: lastScans
    };

    if (vendedorId) {
      updateData[`sellosLocales.${vendedorId}`] = increment(1);
    }

    updateDoc(userRef, updateData).catch((error) => {
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
): Promise<{ codigoVoucher: string }> {
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

    // Guardar voucher en colección `canjes_activos`
    await addDoc(collection(db, "canjes_activos"), {
      userId,
      usuarioNombre: data.nombre || data.correo,
      premioNombre,
      codigoVoucher,
      costo,
      estado: "pendiente",
      fechaEmision: timestamp,
      fechaExpiracion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    updateDoc(userRef, {
      comprasRealizadas: nuevasCompras,
      recompensaDisponible: nuevasCompras >= 5,
      totalCanjesHistoricos: increment(1),
      lastCanjeAt: timestamp,
    });

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
      `Tu voucher para "${premioNombre}" es: ${codigoVoucher}. Válido por 7 días. ¡Muéstralo en caja!`
    );

    return { codigoVoucher };
  } catch (error) {
    console.error("Error al canjear recompensa:", error);
    throw error;
  }
}
