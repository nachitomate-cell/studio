
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
      // Si el usuario no existe en la DB (raro pero posible), lo creamos
      setDoc(userRef, {
        comprasRealizadas: 1,
        recompensaDisponible: false,
        puntos: 50,
        totalCanjesHistoricos: 0,
        createdAt: new Date().toISOString()
      }).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userRef.path,
          operation: 'create',
          requestResourceData: { comprasRealizadas: 1 }
        }));
      });
      return;
    }

    const data = userSnap.data();
    const nuevasCompras = (data.comprasRealizadas || 0) + 1;
    const timestamp = new Date().toISOString();
    
    // Actualizamos al cliente (No bloqueante)
    updateDoc(userRef, {
      comprasRealizadas: increment(1),
      recompensaDisponible: nuevasCompras >= 5,
      puntos: increment(50),
      lastPurchaseAt: timestamp,
      lastUpdate: timestamp
    }).catch(async (error) => {
      const permissionError = new FirestorePermissionError({
        path: userRef.path,
        operation: 'update',
        requestResourceData: { comprasRealizadas: nuevasCompras },
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });

    // Si hay un vendedor, registramos la venta en su historial (No bloqueante)
    if (vendedorId) {
      const logRef = collection(db, "usuarios", vendedorId, "ventas_registradas");
      addDoc(logRef, {
        vendedorId,
        clienteId: userId,
        clienteNombre: data.nombre || data.correo || "Miembro del Club",
        fecha: timestamp
      }).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: logRef.path,
          operation: 'create'
        }));
      });
    }

    // Notificación de logro
    if (nuevasCompras % 5 === 0) {
      await enviarNotificacionLocal(userId, "¡Premio Disponible!", `Has alcanzado ${nuevasCompras} sellos. ¡Canjea tu premio en el Club Patio!`);
    } else {
      await enviarNotificacionLocal(userId, "Sello Sumado", "Has recibido un nuevo sello. ¡Sigue así!");
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
    }).catch(async (error) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'update',
        requestResourceData: { comprasRealizadas: nuevasCompras }
      }));
    });

    await enviarNotificacionLocal(userId, "Canje Exitoso", `Has canjeado tu premio. ¡Gracias por ser parte del Club Patio!`);
    
  } catch (error) {
    console.error("Error al canjear recompensa:", error);
    throw error;
  }
}
