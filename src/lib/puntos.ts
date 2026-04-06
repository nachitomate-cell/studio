
import { doc, getDoc, updateDoc, setDoc, Firestore, increment } from "firebase/firestore";

/**
 * Registra una simulación de compra para el usuario.
 * Incrementa el contador y activa la recompensa si llega a 5.
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
    
    updateDoc(userRef, {
      comprasRealizadas: nuevasCompras,
      recompensaDisponible: nuevasCompras >= 5,
      puntos: increment(50)
    });
    
  } catch (error) {
    console.error("Error al registrar compra:", error);
  }
}

/**
 * Procesa el canje de una recompensa.
 * Reinicia el contador de compras, suma al histórico y dispara notificación.
 */
export async function canjearRecompensa(db: Firestore, userId: string, userEmail?: string) {
  const userRef = doc(db, "usuarios", userId);
  
  try {
    // 1. Actualización en Firestore
    await updateDoc(userRef, {
      comprasRealizadas: 0,
      recompensaDisponible: false,
      totalCanjesHistoricos: increment(1)
    });

    // 2. Disparo de Notificación Automática (Simulado vía API Route)
    if (userEmail) {
      // Usamos fetch sin await para no bloquear la UI del usuario mientras se "envía" el mensaje
      fetch('/api/notificaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          event: 'recompensa_canjeada',
          userName: userEmail.split('@')[0] // Simulación de nombre a partir del email
        }),
      }).catch(err => {
        // Manejo silencioso del error de notificación para no afectar al usuario
        console.error("Fallo el envío de notificación automática:", err);
      });
    }
  } catch (error) {
    console.error("Error al canjear recompensa:", error);
    throw error; // Re-lanzamos para que la UI pueda manejar el error si es de base de datos
  }
}
