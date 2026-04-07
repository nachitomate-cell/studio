
import { doc, getDoc, updateDoc, setDoc, Firestore, increment, collection, addDoc } from "firebase/firestore";
import { enviarNotificacionLocal } from "./notificaciones";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export async function registrarCompra(db: Firestore, userId: string, vendedorId?: string) {
  const userRef = doc(db, "usuarios", userId);
  
  try {
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        comprasRealizadas: 1,
        recompensaDisponible: false,
        puntos: 100,
        totalCanjesHistoricos: 0,
        baneado: false,
        createdAt: new Date().toISOString()
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
    const timestamp = new Date().toISOString();
    const clienteNombre = data.nombre || data.correo || "Miembro del Club";
    
    updateDoc(userRef, {
      comprasRealizadas: increment(1),
      recompensaDisponible: nuevasCompras >= 5,
      puntos: increment(50),
      lastPurchaseAt: timestamp,
      lastUpdate: timestamp
    }).catch((error) => {
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
      tipo: "FIDELIZACION"
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
        fecha: timestamp
      });

      await enviarNotificacionLocal(vendedorId, "Venta Exitosa ✅", `Has entregado un sello a ${clienteNombre}.`);
    }
    
  } catch (error) {
    console.error("Error crítico en registrarCompra:", error);
  }
}

export async function canjearRecompensa(db: Firestore, userId: string, costo: number, userEmail?: string) {
  const userRef = doc(db, "usuarios", userId);
  
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    if (data.baneado) return;

    const nuevasCompras = (data.comprasRealizadas || 0) - costo;

    updateDoc(userRef, {
      comprasRealizadas: nuevasCompras,
      recompensaDisponible: nuevasCompras >= 5,
      totalCanjesHistoricos: increment(1),
      lastCanjeAt: new Date().toISOString()
    });

    await addDoc(collection(db, "system_logs"), {
      usuario: data.nombre || data.correo,
      usuarioId: userId,
      accion: "canjeó un premio",
      fecha: new Date().toISOString(),
      tipo: "CANJE"
    });

    await enviarNotificacionLocal(userId, "Canje Confirmado 🎫", `Has canjeado tu premio exitosamente. ¡Disfrútalo!`);
    
  } catch (error) {
    console.error("Error al canjear recompensa:", error);
    throw error;
  }
}
