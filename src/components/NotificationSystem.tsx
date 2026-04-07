
"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, limit, where } from "firebase/firestore";
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
  // Usamos un offset de un segundo antes para no perder notificaciones por discrepancia de ms
  const [mountTime] = useState(new Date(Date.now() - 1000).toISOString());

  useEffect(() => {
    // Registro del Service Worker para soporte de notificaciones PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.warn("SW Registration failed:", err));
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Escuchamos las notificaciones creadas desde la carga de la app
        const notifRef = collection(db, "usuarios", user.uid, "notificaciones");
        const q = query(
          notifRef, 
          where("fecha", ">", mountTime),
          orderBy("fecha", "desc"), 
          limit(5)
        );

        const unsubscribeNotif = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            // Solo procesamos documentos nuevos
            if (change.type === "added") {
              const data = change.doc.data();
              
              // 1. Alerta visual en la app (Toast) - Solo si la app está abierta
              toast({
                title: data.titulo,
                description: data.mensaje,
              });

              // 2. Alerta física del sistema (iPhone/Android)
              dispararAlertaSistema(data.titulo, data.mensaje);
            }
          });
        }, (error) => {
          console.warn("Fallo en listener de notificaciones:", error);
        });

        return () => unsubscribeNotif();
      }
    });

    return () => unsubscribeAuth();
  }, [toast, mountTime]);

  return null;
}
