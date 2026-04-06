
import { doc, getDoc, updateDoc, setDoc, Firestore, increment } from "firebase/firestore";

/**
 * Registra una simulación de compra para el usuario.
 * Lógica 100% cliente utilizando el SDK de Firebase.
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
    
  } catch (error) {
    console.error("Error al registrar compra:", error);
  }
}

/**
 * Procesa el canje de una recompensa específica.
 * Se eliminó la llamada a API Routes para compatibilidad con build estático.
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
      recompensaDisponible: nuevasCompras >= 5,
      totalCanjesHistoricos: increment(1),
      lastCanjeAt: new Date().toISOString()
    });

    // Simulación de notificación (solo log en cliente, sin API routes)
    console.log(`[CLUB PATIO] Canje exitoso para ${userEmail}. El cliente debe mostrar esta pantalla en el puesto.`);
    
  } catch (error) {
    console.error("Error al canjear recompensa:", error);
    throw error;
  }
}
