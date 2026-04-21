"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, limit, where, doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { dispararAlertaSistema } from "@/lib/notificaciones";
import { useToast } from "@/hooks/use-toast";
import { useGeofencing } from "@/hooks/useGeofencing";

/**
 * Componente que escucha nuevas notificaciones en Firestore.
 * El listener de Firestore se crea SOLO cuando hay sesión activa
 * y se destruye automáticamente al cerrar sesión.
 *
 * También recupera automáticamente el FCM token si el usuario tiene
 * permiso concedido pero el token no está guardado en Firestore
 * (ej: registró el permiso antes de que el sistema estuviera listo).
 */
export function NotificationSystem() {
  const { toast } = useToast();
  const [mountTime] = useState(new Date().toISOString());

  // Inicializa el motor de geocercas en background
  useGeofencing();

  useEffect(() => {
    // Registrar el SW de Firebase Messaging como SW principal.
    // Es el único SW para el scope raíz — evita conflicto con sw.js en iOS.
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
        .then(reg => console.log("[SW] Firebase Messaging SW registrado:", reg.scope))
        .catch(err => console.warn("[SW] Fallo al registrar SW:", err));
    }

    // Referencia interna al listener de notificaciones, para poder desmontarlo
    let unsubscribeNotif: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // --- LOGOUT: destruir el listener de notificaciones si existía ---
      if (unsubscribeNotif) {
        unsubscribeNotif();
        unsubscribeNotif = null;
      }

      // --- LOGIN: montar el listener solo cuando hay sesión activa ---
      if (user) {

        // ── AUTO-RECUPERACIÓN DEL TOKEN FCM ─────────────────────────────────
        // Si el usuario ya tiene permiso concedido pero NO tiene fcmToken en
        // Firestore (registro fallido en sesión anterior), lo re-registramos
        // en silencio. Así no necesita tocar nada manualmente.
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            const userSnap = await getDoc(doc(db, "usuarios", user.uid));
            const tokenExistente = userSnap.exists() ? userSnap.data()?.fcmToken : null;

            if (!tokenExistente) {
              console.info("[FCM] Token ausente en Firestore — re-registrando automáticamente...");
              // Import dinámico para no bloquear el render y evitar errores en SSR
              const { registerFcmToken } = await import("@/lib/fcmTokenManager");
              const result = await registerFcmToken();
              if (result.ok) {
                console.info("[FCM] Token re-registrado exitosamente:", result.token.substring(0, 20) + "...");
              } else {
                console.warn("[FCM] Re-registro automático falló:", result.reason);
              }
            }
          } catch (err) {
            // No es fatal — el flujo de notificaciones en-app sigue funcionando
            console.warn("[FCM] Error en auto-recuperación de token:", err);
          }
        }
        // ────────────────────────────────────────────────────────────────────

        const notifRef = collection(db, "usuarios", user.uid, "notificaciones");

        const q = query(
          notifRef,
          where("fecha", ">", mountTime),
          orderBy("fecha", "desc"),
          limit(5)
        );

        unsubscribeNotif = onSnapshot(
          q,
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const data = change.doc.data();
                toast({
                  title: data.titulo,
                  description: data.mensaje,
                });
                dispararAlertaSistema(data.titulo, data.mensaje);
              }
            });
          },
          (error) => {
            // Al cerrar sesión Firestore dispara un error permission-denied.
            // Lo manejamos silenciosamente: simplemente cancelamos el listener.
            if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
              console.warn("[NotificationSystem] Listener cancelado: sesión cerrada.");
              if (unsubscribeNotif) {
                unsubscribeNotif();
                unsubscribeNotif = null;
              }
            } else {
              // Para errores genuinos (no relacionados con el logout) sí los logueamos
              console.error("[NotificationSystem] Error inesperado en listener:", error);
            }
          }
        );
      }
    });

    // Cleanup al desmontar el componente
    return () => {
      unsubscribeAuth();
      if (unsubscribeNotif) {
        unsubscribeNotif();
        unsubscribeNotif = null;
      }
    };
  }, [toast, mountTime]);

  return null;
}
