"use client";

import { useEffect } from "react";

// Cuando el SW se actualiza mientras la app está en background (iOS resume),
// controllerchange se dispara al volver al foco. Recargamos para servir
// HTML fresco con el nuevo SW en control.
export function SwUpdateReloader() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
