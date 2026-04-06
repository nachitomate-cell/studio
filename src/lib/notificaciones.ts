
/**
 * @fileOverview Librería de notificaciones para el Club Patio.
 * Maneja la lógica de avisos al usuario y logs de actividad sin depender de API Routes.
 */

import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

/**
 * Registra un evento de notificación en la base de datos para el usuario.
 * Esto puede ser consumido por un servicio de mensajería externo o mostrado en la app.
 */
export async function enviarNotificacionLocal(userId: string, titulo: string, mensaje: string) {
  try {
    const notifRef = collection(db, "usuarios", userId, "notificaciones");
    await addDoc(notifRef, {
      titulo,
      mensaje,
      leida: false,
      fecha: new Date().toISOString()
    });
    console.log(`[NOTIFICACIÓN] ${titulo}: ${mensaje}`);
  } catch (error) {
    console.error("Error al registrar notificación:", error);
  }
}

/**
 * Función dummy para simular el envío de un correo o push.
 * En una App Pro de Capacitor, aquí se integraría Firebase Cloud Messaging (FCM).
 */
export async function simularPushNotification(email: string, mensaje: string) {
  // En Capacitor, usaríamos el plugin de Push Notifications aquí.
  console.log(`[PUSH SIMULADO] Enviado a ${email}: ${mensaje}`);
}
