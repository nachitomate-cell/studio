"use client";

import { useEffect } from "react";

/**
 * Error boundary global. Atrapa errores que ocurren en el propio root layout
 * (donde un `error.tsx` normal no llega). Reemplaza por completo el documento,
 * por eso debe renderizar sus propios <html> y <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Club Patio] Error global:", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
          padding: "0 32px",
          textAlign: "center",
          background: "#ffffff",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <img
          src="/Logo2.png"
          alt="Patio Curauma"
          style={{ height: "56px", objectFit: "contain" }}
        />
        <div>
          <h1
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#1e293b",
              margin: "0 0 8px",
            }}
          >
            Algo salió mal
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#64748b",
              maxWidth: "20rem",
              margin: 0,
            }}
          >
            No pudimos iniciar la app. Revisa tu conexión e inténtalo de nuevo.
          </p>
        </div>
        <button
          onClick={() => reset()}
          style={{
            border: "none",
            borderRadius: "9999px",
            background: "#C9920A",
            color: "#ffffff",
            padding: "12px 24px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
