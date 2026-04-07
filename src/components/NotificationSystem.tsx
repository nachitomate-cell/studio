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
  const [mountTime] = useState(new Date().toISOString());

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Escuchamos solo las notificaciones creadas DESPUÉS de que la app cargó
        const notifRef = collection(db, "usuarios", user.uid, "notificaciones");
        const q = query(
          notifRef, 
          where("fecha", ">", mountTime),
          orderBy("fecha", "desc"), 
          limit(5)
        );

        const unsubscribeNotif = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            // Solo procesamos documentos que se añaden en tiempo real
            if (change.type === "added") {
              const data = change.doc.data();
              
              // 1. Alerta visual en la app (Toast)
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
