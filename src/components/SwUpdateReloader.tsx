"use client";

import { useEffect } from "react";

// Recarga la página cuando el SW cambia de controlador DESPUÉS de los primeros
// 5 segundos de vida de la página. El delay evita la carrera con client.navigate()
// del activate del SW: si el SW ya navegó, este listener no existía todavía y
// no duplica el reload. Solo captura actualizaciones que ocurren mientras la app
// está abierta y en uso (p.ej. el usuario lleva 10+ minutos en la app y se
// despliega una nueva versión).
export function SwUpdateReloader() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cleanup: (() => void) | null = null;

    const timer = setTimeout(() => {
      const onControllerChange = () => {
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      cleanup = () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    }, 5000);

    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, []);

  return null;
}
