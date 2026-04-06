
import { doc, getDoc, updateDoc, setDoc, Firestore, increment } from "firebase/firestore";
import { enviarNotificacionLocal } from "./notificaciones";

/**
 * Registra una simulación de compra para el usuario.
 */
export async function registrarCompra(db: Firestore, userId: string) {
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
    
    await updateDoc(userRef, {
      comprasRealizadas: nuevasCompras,
      recompensaDisponible: nuevasCompras >= 5,
      puntos: increment(50),
      lastUpdate: new Date().toISOString()
    });

    if (nuevasCompras >= 5) {
      await enviarNotificacionLocal(userId, "¡Premio Disponible!", "Has alcanzado 5 sellos. ¡Canjea tu premio en el Club Patio!");
    }
    
  } catch (error) {
    console.error("Error al registrar compra:", error);
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

    await updateDoc(userRef, {
      comprasRealizadas: nuevasCompras,
      recompensaDisponible: nuevasCompras >= 5,
      totalCanjesHistoricos: increment(1),
      lastCanjeAt: new Date().toISOString()
    });

    await enviarNotificacionLocal(userId, "Canje Exitoso", `Has canjeado tu premio. ¡Gracias por ser parte del Club Patio!`);
    
  } catch (error) {
    console.error("Error al canjear recompensa:", error);
    throw error;
  }
}
