"use client";

/**
 * Tarjeta para activar las notificaciones push.
 *
 * Se usa en el momento de máxima intención: justo después de completar el
 * registro, cuando la persona acaba de anotarse. Antes el registro terminaba
 * redirigiendo a la home sin pedir nunca el permiso, y el único pedido era un
 * banner que aparecía 2 segundos después de entrar — 8% de conversión.
 *
 * Nunca muestra un botón que no pueda funcionar: en iPhone sin la PWA instalada
 * el push es imposible, así que muestra cómo instalarla en vez de un "Activar"
 * muerto. Y si el permiso ya fue denegado no insiste, porque el navegador no
 * vuelve a preguntar y el botón no haría nada.
 */

import { useEffect, useState } from "react";
import { Bell, BellRing, Share, Plus, AlertCircle } from "lucide-react";
import { estadoPush, type EstadoPush } from "@/lib/pushSoporte";

const ORO = "#D3B673";
const VERDE = "#9DCC65";

export function ActivarNotificaciones({
  onListo,
  titulo,
  descripcion,
}: {
  onListo?: () => void;
  /** Título en contexto. Si se omite, se usa el genérico del Club. */
  titulo?: string;
  /** Debe decir qué se pierde si NO las activa: es lo que convence. */
  descripcion?: string;
}) {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [cargando, setCargando] = useState(false);
  const [falloTecnico, setFalloTecnico] = useState(false);

  // El estado se resuelve en el cliente: depende de APIs del navegador.
  useEffect(() => { setEstado(estadoPush()); }, []);

  const activar = async () => {
    setCargando(true);
    setFalloTecnico(false);
    try {
      // Import dinámico: el módulo toca APIs que fallan al cargar en Safari.
      const { registerFcmToken } = await import("@/lib/fcmTokenManager");
      const r = await registerFcmToken();
      if (r.ok) {
        setEstado("concedido");
        onListo?.();
      } else if (r.reason === "denied") {
        setEstado("denegado");
      } else if (r.reason === "unsupported") {
        setEstado("requiere_instalacion");
      } else {
        // no_vapid_key / sw_error / token_error: el usuario no puede hacer nada.
        setFalloTecnico(true);
      }
    } catch {
      setFalloTecnico(true);
    } finally {
      setCargando(false);
    }
  };

  // Mientras se resuelve, y cuando no hay nada accionable, no ocupamos espacio.
  if (estado === null || estado === "no_soportado") return null;

  const caja: React.CSSProperties = {
    borderRadius: 20,
    padding: "16px 18px",
    marginBottom: 20,
    textAlign: "left",
  };

  if (estado === "concedido") {
    return (
      <div style={{
        ...caja,
        background: "linear-gradient(135deg, rgba(157,204,101,0.14), rgba(157,204,101,0.06))",
        border: "1px solid rgba(157,204,101,0.3)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <BellRing style={{ width: 20, height: 20, color: VERDE, flexShrink: 0 }} />
        <p style={{ fontSize: 12.5, color: "#cbd5e1", margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
          Listo, los avisos están activados. Te llegará una alerta a este
          teléfono si ganas o si tienes un premio para canjear.
        </p>
      </div>
    );
  }

  if (estado === "requiere_instalacion") {
    return (
      <div style={{
        ...caja,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(211,182,115,0.28)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Bell style={{ width: 18, height: 18, color: ORO, flexShrink: 0 }} />
          <p style={{ fontSize: 13.5, fontWeight: 800, color: "#f8fafc", margin: 0 }}>
            Para recibir avisos en iPhone
          </p>
        </div>
        <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "0 0 10px", lineHeight: 1.5 }}>
          Primero agrega la app a tu pantalla de inicio. Toma 10 segundos:
        </p>
        {[
          { icono: <Share style={{ width: 13, height: 13 }} />, texto: "Toca Compartir en la barra de Safari" },
          { icono: <Plus style={{ width: 13, height: 13 }} />, texto: "Elige “Agregar a pantalla de inicio”" },
          { icono: <BellRing style={{ width: 13, height: 13 }} />, texto: "Abre la app desde el ícono nuevo y activa los avisos" },
        ].map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0,
              background: "rgba(211,182,115,0.16)", color: ORO,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{p.icono}</span>
            <p style={{ fontSize: 11.5, color: "#cbd5e1", margin: 0, lineHeight: 1.4 }}>{p.texto}</p>
          </div>
        ))}
      </div>
    );
  }

  if (estado === "denegado") {
    return (
      <div style={{
        ...caja,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <AlertCircle style={{ width: 18, height: 18, color: "#94a3b8", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 11.5, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
          Los avisos están bloqueados en este navegador. Puedes habilitarlos
          desde los ajustes del sitio si quieres enterarte de tus premios.
        </p>
      </div>
    );
  }

  // preguntable
  return (
    <div style={{
      ...caja,
      background: "linear-gradient(135deg, rgba(211,182,115,0.14), rgba(211,182,115,0.05))",
      border: "1px solid rgba(211,182,115,0.32)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Bell style={{ width: 18, height: 18, color: ORO, flexShrink: 0 }} />
        <p style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc", margin: 0 }}>
          {titulo ?? "¿Cómo te avisamos si ganas?"}
        </p>
      </div>
      <p style={{ fontSize: 12.5, color: "#cbd5e1", margin: "0 0 12px", lineHeight: 1.55 }}>
        {descripcion ??
          "Con los avisos activados te llega una alerta al teléfono apenas tengas " +
          "un premio listo o salgas sorteado. Sin ellos, solo te enteras si entras a la app."}
      </p>
      {falloTecnico && (
        <p style={{ fontSize: 11, color: "#fca5a5", margin: "0 0 10px", lineHeight: 1.4 }}>
          No se pudo activar en este dispositivo. Puedes intentarlo más tarde
          desde tu perfil.
        </p>
      )}
      <button
        onClick={activar}
        disabled={cargando}
        style={{
          width: "100%", height: 46, borderRadius: 14, border: "none",
          background: `linear-gradient(135deg, ${ORO}, #C9920A)`,
          color: "white", fontWeight: 900, fontSize: 13.5,
          cursor: cargando ? "default" : "pointer", opacity: cargando ? 0.65 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: "0 4px 16px rgba(201,146,10,0.3)",
        }}
        className="transition-all hover:opacity-90 active:scale-[0.98]"
      >
        <Bell style={{ width: 15, height: 15 }} />
        {cargando ? "Activando…" : "Activar avisos en mi teléfono"}
      </button>
    </div>
  );
}
