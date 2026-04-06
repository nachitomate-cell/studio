
import { doc, getDoc, updateDoc, setDoc, Firestore, increment } from "firebase/firestore";

/**
 * Registra una simulación de compra para el usuario.
 * Incrementa el contador y activa la recompensa si llega a 5 (costo mínimo).
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
        totalCanjesHistoricos: 0
      });
      return;
    }

    const data = userSnap.data();
    const nuevasCompras = (data.comprasRealizadas || 0) + 1;
    
    await updateDoc(userRef, {
      comprasRealizadas: nuevasCompras,
      recompensaDisponible: nuevasCompras >= 5,
      puntos: increment(50)
    });
    
  } catch (error) {
    console.error("Error al registrar compra:", error);
  }
}

/**
 * Procesa el canje de una recompensa específica.
 * Resta el costo del premio, actualiza el histórico y dispara notificación.
 */
export async function canjearRecompensa(db: Firestore, userId: string, costo: number, userEmail?: string) {
  const userRef = doc(db, "usuarios", userId);
  
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const nuevasCompras = (data.comprasRealizadas || 0) - costo;

    // Actualización en Firestore
    await updateDoc(userRef, {
      comprasRealizadas: nuevasCompras,
      recompensaDisponible: nuevasCompras >= 5, // Sigue disponible si aún puede costear el premio mínimo
      totalCanjesHistoricos: increment(1)
    });

    // Disparo de Notificación Automática
    if (userEmail) {
      fetch('/api/notificaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          event: 'recompensa_canjeada',
          userName: userEmail.split('@')[0]
        }),
      }).catch(err => {
        console.error("Fallo el envío de notificación automática:", err);
      });
    }
  } catch (error) {
    console.error("Error al canjear recompensa:", error);
    throw error;
  }
}
