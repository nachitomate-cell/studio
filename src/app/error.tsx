"use client";

import { useEffect } from "react";

/**
 * Error boundary del segmento raíz.
 * Atrapa excepciones de render/hidratación en el árbol de páginas para que la
 * app no quede atascada en una pantalla en blanco o congelada. Ofrece una
 * acción explícita de reintento/recarga.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Deja rastro en la consola para depurar desde el WebView (Safari/Chrome).
    console.error("[Club Patio] Error en la app:", error);
  }, [error]);

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center gap-6 bg-white px-8 text-center">
      <img src="/Logo2.png" alt="Patio Curauma" className="h-14 object-contain" />
      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-slate-800">
          Algo salió mal
        </h1>
        <p className="max-w-xs text-sm text-slate-500">
          No pudimos cargar la app. Revisa tu conexión e inténtalo de nuevo.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => reset()}
          className="rounded-full bg-[#C9920A] px-6 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-95"
        >
          Reintentar
        </button>
        <button
          onClick={() => {
            if (typeof window !== "undefined") window.location.reload();
          }}
          className="rounded-full px-6 py-2 text-sm font-medium text-slate-500 transition active:scale-95"
        >
          Recargar la app
        </button>
      </div>
    </div>
  );
}
