"use client";

import { useEffect, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot, limit } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { dispararAlertaSistema } from "@/lib/notificaciones";
import { useToast } from "@/hooks/use-toast";

/**
 * Componente invisible que escucha nuevas notificaciones en Firestore
 * y dispara alertas reales del sistema (iOS/Android/Web).
 */
export function NotificationSystem() {
  const { toast } = useToast();
  const lastNotifId = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Escuchar las notificaciones más recientes creadas para este usuario
        const notifRef = collection(db, "usuarios", user.uid, "notificaciones");
        const q = query(
          notifRef, 
          orderBy("fecha", "desc"), 
          limit(1)
        );

        const unsubscribeNotif = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            
            // Evitar disparar la alerta para notificaciones antiguas al cargar
            if (!lastNotifId.current) {
              lastNotifId.current = doc.id;
              return;
            }

            // Si es un nuevo ID de notificación, disparamos la alerta
            if (doc.id !== lastNotifId.current) {
              lastNotifId.current = doc.id;
              
              // Alerta visual en la app
              toast({
                title: data.titulo,
                description: data.mensaje,
              });

              // Alerta física del sistema (iPhone/Android)
              dispararAlertaSistema(data.titulo, data.mensaje);
            }
          }
        }, (error) => {
          console.warn("Fallo en listener de notificaciones:", error);
        });

        return () => unsubscribeNotif();
      }
    });

    return () => unsubscribeAuth();
  }, [toast]);

  return null;
}
