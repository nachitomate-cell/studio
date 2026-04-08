"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, limit, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { dispararAlertaSistema } from "@/lib/notificaciones";
import { useToast } from "@/hooks/use-toast";

/**
 * Componente que escucha nuevas notificaciones en Firestore.
 * El listener de Firestore se crea SOLO cuando hay sesión activa
 * y se destruye automáticamente al cerrar sesión.
 */
export function NotificationSystem() {
  const { toast } = useToast();
  const [mountTime] = useState(new Date().toISOString());

  useEffect(() => {
    // Registro del Service Worker para soporte PWA en iOS/Android
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log("SW registrado con éxito:", reg.scope))
        .catch(err => console.warn("Fallo al registrar SW:", err));
    }

    // Referencia interna al listener de notificaciones, para poder desmontarlo
    let unsubscribeNotif: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // --- LOGOUT: destruir el listener de notificaciones si existía ---
      if (unsubscribeNotif) {
        unsubscribeNotif();
        unsubscribeNotif = null;
      }

      // --- LOGIN: montar el listener solo cuando hay sesión activa ---
      if (user) {
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