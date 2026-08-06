"use client";

/**
 * Aviso de error en un modal chico.
 *
 * Existe porque el mensaje en línea se perdía: aparecía sobre el formulario,
 * fuera de la vista si la persona estaba escribiendo más abajo, y quedaba
 * indistinguible de una ayuda de campo. Un cliente reportó "no me deja
 * registrarme" sin poder decir qué decía la pantalla.
 *
 * Es deliberadamente pequeño y descartable —clic fuera, Escape o el botón— para
 * que interrumpa lo justo. No se usa para errores de validación de campos: un
 * modal por cada "ingresa tu nombre" molesta más de lo que ayuda, y esos ya se
 * muestran junto al campo.
 *
 * Acepta una acción opcional para los casos donde el error tiene una salida
 * evidente; el ejemplo real es "este correo ya está registrado", donde lo útil
 * no es entender el error sino pasar a iniciar sesión.
 */

import { useEffect, useRef } from "react";
import { AlertCircle, X } from "lucide-react";

export type AccionAviso = { texto: string; onClick: () => void };

export function AvisoError({
  mensaje,
  titulo = "No pudimos continuar",
  accion,
  onCerrar,
}: {
  mensaje: string | null;
  titulo?: string;
  accion?: AccionAviso;
  onCerrar: () => void;
}) {
  const cerrarRef = useRef<HTMLButtonElement>(null);

  // Escape cierra, y el foco entra al modal para que un lector de pantalla lo
  // anuncie en vez de dejar al usuario donde estaba escribiendo.
  useEffect(() => {
    if (!mensaje) return;
    const alPulsar = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", alPulsar);
    cerrarRef.current?.focus();
    return () => window.removeEventListener("keydown", alPulsar);
  }, [mensaje, onCerrar]);

  if (!mensaje) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="aviso-error-titulo"
      onClick={onCerrar}
      style={{
        position: "fixed", inset: 0, zIndex: 120,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(2px)",
        animation: "avisoFondo .18s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 340,
          background: "#fff", borderRadius: 20,
          padding: "22px 20px 18px",
          boxShadow: "0 18px 50px rgba(15,23,42,0.28)",
          animation: "avisoEntra .22s cubic-bezier(.34,1.4,.64,1)",
          position: "relative",
        }}
      >
        <button
          ref={cerrarRef}
          onClick={onCerrar}
          aria-label="Cerrar"
          style={{
            position: "absolute", top: 10, right: 10,
            width: 30, height: 30, borderRadius: 9, border: "none",
            background: "transparent", color: "#94a3b8", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>

        <div style={{
          width: 42, height: 42, borderRadius: 13, marginBottom: 12,
          background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertCircle style={{ width: 22, height: 22, color: "#dc2626" }} />
        </div>

        <p id="aviso-error-titulo" style={{
          margin: 0, fontSize: 16, fontWeight: 800, color: "#1a1a2e", lineHeight: 1.3,
        }}>
          {titulo}
        </p>
        <p style={{
          margin: "7px 0 0", fontSize: 14, color: "#475569", lineHeight: 1.55,
        }}>
          {mensaje}
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          {accion && (
            <button
              onClick={() => { accion.onClick(); onCerrar(); }}
              style={{
                flex: 1, height: 44, borderRadius: 13, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #9DCC65, #7ab84e)",
                color: "#fff", fontSize: 14, fontWeight: 800,
              }}
            >
              {accion.texto}
            </button>
          )}
          <button
            onClick={onCerrar}
            style={{
              flex: accion ? "0 0 auto" : 1, minWidth: 92, height: 44, borderRadius: 13,
              cursor: "pointer", background: accion ? "#f1f5f9" : "#1a1a2e",
              border: "none", color: accion ? "#475569" : "#fff",
              fontSize: 14, fontWeight: 800, padding: "0 16px",
            }}
          >
            {accion ? "Cerrar" : "Entendido"}
          </button>
        </div>

        <style>{`
          @keyframes avisoFondo { from { opacity: 0 } to { opacity: 1 } }
          @keyframes avisoEntra {
            from { opacity: 0; transform: translateY(10px) scale(.96) }
            to   { opacity: 1; transform: translateY(0) scale(1) }
          }
        `}</style>
      </div>
    </div>
  );
}
