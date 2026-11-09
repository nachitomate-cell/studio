"use client";

/**
 * Fila "Aviso al llegar al Patio" del modal de permisos (solo app nativa).
 * Muestra el estado real, deja activarlo con la divulgación de Play y probarlo.
 */

import { useState } from "react";
import { MapPin, CheckCircle2, BellRing } from "lucide-react";
import { useGeoPushEstado, pasoPendiente, activarGeoPush, GeoPushCaja } from "@/components/GeoPushActivar";

export function GeoPushFila() {
  const { estado, setEstado, disponible, refrescar } = useGeoPushEstado();
  const [cargando, setCargando] = useState(false);
  const [probado, setProbado] = useState<null | boolean>(null);

  if (!disponible || !estado) return null;
  const paso = pasoPendiente(estado);

  if (paso) {
    return (
      <GeoPushCaja
        paso={paso}
        cargando={cargando}
        plataforma={estado.plataforma}
        onActivar={async () => {
          setCargando(true);
          try {
            const e = await activarGeoPush(paso);
            if (e) setEstado(e);
            else await refrescar();
          } finally {
            setCargando(false);
          }
        }}
      />
    );
  }

  const probar = async () => {
    const { GeoPush } = await import("@/lib/geopush");
    try {
      setProbado((await GeoPush.probar({})).enviado);
    } catch {
      setProbado(false);
    }
  };

  const modo =
    estado.plataforma === "ios" && estado.modo === "mientras_se_usa"
      ? "Activo. Para que avise con más precisión, en Ajustes → Club Patio → Ubicación elige “Siempre”."
      : "Activo. Te avisamos al llegar a Patio Curauma, aunque la app esté cerrada.";

  return (
    <div className="rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(157,204,101,0.12)", color: "#9DCC65" }}>
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">Aviso al llegar al Patio</p>
          <p className="text-[11px] text-slate-400 font-medium leading-snug">{modo}</p>
        </div>
        <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "#9DCC65" }}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Activado
        </span>
      </div>
      <div className="px-4 pb-4">
        <button
          onClick={probar}
          className="w-full h-9 rounded-xl text-xs font-bold border border-slate-200 text-slate-500 flex items-center justify-center gap-1.5 active:scale-[0.97]"
        >
          <BellRing className="w-3.5 h-3.5" />
          {probado === null ? "Probar el aviso" : probado ? "Listo, revisa tus notificaciones" : "No se pudo mostrar: revisa el permiso de notificaciones"}
        </button>
      </div>
    </div>
  );
}
