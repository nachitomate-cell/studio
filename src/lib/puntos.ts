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
      // Si el usuario no existe en la colección, lo creamos con valores iniciales
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
    
    // Actualizamos el documento sin await para aprovechar el cache local optimista
    updateDoc(userRef, {
      comprasRealizadas: nuevasCompras,
      recompensaDisponible: nuevasCompras >= 5,
      puntos: increment(50) // Sumamos 50 puntos por cada compra
    });
    
  } catch (error) {
    console.error("Error al registrar compra:", error);
  }
}

/**
 * Procesa el canje de una recompensa.
 * Reinicia el contador de compras y suma al histórico.
 */
export async function canjearRecompensa(db: Firestore, userId: string) {
  const userRef = doc(db, "usuarios", userId);
  
  // Realizamos la actualización en Firestore
  updateDoc(userRef, {
    comprasRealizadas: 0,
    recompensaDisponible: false,
    totalCanjesHistoricos: increment(1)
  });
}
