import { doc, getDoc, updateDoc, setDoc, Firestore, increment, collection, addDoc } from "firebase/firestore";
import { enviarNotificacionLocal } from "./notificaciones";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * Registra una compra para el usuario, sumando sellos y puntos.
 * @param db Instancia de Firestore
 * @param userId ID del cliente (UID)
 * @param vendedorId ID del vendedor (opcional)
 */
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
        createdAt: new Date().toISOString()
      });
      return;
    }

    const data = userSnap.data();
    const nuevasCompras = (data.comprasRealizadas || 0) + 1;
    const timestamp = new Date().toISOString();
    const clienteNombre = data.nombre || data.correo || "Miembro del Club";
    
    // 1. Actualizar Cliente
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

    // 2. Notificar al Cliente (Recipient)
    if (nuevasCompras % 5 === 0) {
      await enviarNotificacionLocal(userId, "¡Premio Listo! 🎁", `¡Felicidades! Has completado ${nuevasCompras} sellos. Canjea tu premio ahora.`);
    } else {
      await enviarNotificacionLocal(userId, "¡Sello Recibido! ✨", `Has sumado un nuevo sello en Patio Curauma. ¡Te faltan pocos para tu premio!`);
    }

    // 3. Si hay un vendedor, registrar y NOTIFICAR al Emprendedor (Sender)
    if (vendedorId) {
      // Registrar en historial de ventas
      const logRef = collection(db, "usuarios", vendedorId, "ventas_registradas");
      addDoc(logRef, {
        vendedorId,
        clienteId: userId,
        clienteNombre,
        fecha: timestamp
      }).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: logRef.path,
          operation: 'create'
        }));
      });

      // Enviar notificación de sistema al emprendedor
      await enviarNotificacionLocal(vendedorId, "Venta Exitosa ✅", `Has entregado un sello a ${clienteNombre}.`);
    }
    
  } catch (error) {
    console.error("Error crítico en registrarCompra:", error);
  }
}

/**
 * Procesa el canje de una recompensa específica.
 */
export async function canjearRecompensa(db: Firestore, userId: string, costo: number, userEmail?: string) {
  const userRef = doc(db, "usuarios", userId);
  
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const nuevasCompras = (data.comprasRealizadas || 0) - costo;

    updateDoc(userRef, {
      comprasRealizadas: nuevasCompras,
      recompensaDisponible: nuevasCompras >= 5,
      totalCanjesHistoricos: increment(1),
      lastCanjeAt: new Date().toISOString()
    }).catch((error) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'update',
        requestResourceData: { comprasRealizadas: nuevasCompras }
      }));
    });

    await enviarNotificacionLocal(userId, "Canje Confirmado 🎫", `Has canjeado tu premio exitosamente. ¡Disfrútalo!`);
    
  } catch (error) {
    console.error("Error al canjear recompensa:", error);
    throw error;
  }
}
