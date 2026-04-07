"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, limit, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { dispararAlertaSistema } from "@/lib/notificaciones";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

/**
 * Componente que escucha nuevas notificaciones en Firestore
 * Intenta disparar alertas de sistema si la app está abierta o en memoria.
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

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const notifPath = `usuarios/${user.uid}/notificaciones`;
        const notifRef = collection(db, "usuarios", user.uid, "notificaciones");
        
        const q = query(
          notifRef, 
          where("fecha", ">", mountTime),
          orderBy("fecha", "desc"), 
          limit(5)
        );

        const unsubscribeNotif = onSnapshot(q, 
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
          async (serverError) => {
            // Manejo de error contextual para el desarrollador
            const permissionError = new FirestorePermissionError({
              path: notifPath,
              operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
          }
        );

        return () => unsubscribeNotif();
      }
    });

    return () => unsubscribeAuth();
  }, [toast, mountTime]);

  return null;
}