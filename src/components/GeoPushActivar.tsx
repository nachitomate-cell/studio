"use client";

/**
 * Activar el aviso de llegada al Patio (solo app de las tiendas).
 *
 * POLÍTICA DE GOOGLE PLAY: antes de pedir la ubicación en segundo plano hay que
 * mostrar DENTRO de la app una explicación visible que diga qué dato se usa
 * (ubicación), que se usa con la app cerrada y para qué. Esa explicación es
 * `TEXTO_DIVULGACION` y aparece SIEMPRE antes del diálogo del sistema. No
 * acortarla ni moverla a un "más info": la revisión de Play la busca en el video.
 *
 * Orden de los pedidos: avisos → ubicación mientras se usa → "todo el tiempo".
 * Android 11+ no deja pedir la tercera junto con la segunda: abre los ajustes.
 */

import { useCallback, useEffect, useState } from "react";
import { MapPin, BellRing, Settings, X } from "lucide-react";
import { esAppNativa } from "@/lib/nativo";
import type { EstadoGeoPush } from "@/lib/geopush";

export const TEXTO_DIVULGACION =
  "Club Patio usa tu ubicación para avisarte cuando llegas a Patio Curauma, " +
  "incluso cuando la app está cerrada o no la estás usando. Solo se usa para " +
  "detectar tu llegada a las zonas del Patio: tu recorrido no se guarda ni se comparte.";

const CLAVE_POSPUESTO = "geopush_pospuesto_hasta";
const DIAS_POSPUESTO = 7;

type Paso = "inicio" | "segundo_plano" | "bloqueado";

export function useGeoPushEstado() {
  const [estado, setEstado] = useState<EstadoGeoPush | null>(null);
  const [disponible, setDisponible] = useState(false);

  const refrescar = useCallback(async () => {
    const { geoPushDisponible, GeoPush } = await import("@/lib/geopush");
    if (!geoPushDisponible()) return;
    setDisponible(true);
    try {
      setEstado(await GeoPush.estado());
    } catch {}
  }, []);

  useEffect(() => {
    if (!esAppNativa()) return;
    refrescar();
    const alVolver = () => document.visibilityState === "visible" && refrescar();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [refrescar]);

  return { estado, setEstado, disponible, refrescar };
}

/** ¿Qué falta? null = nada (ya avisa). */
export function pasoPendiente(e: EstadoGeoPush | null): Paso | null {
  if (!e) return null;
  if (e.ubicacion === "denied") return "bloqueado";
  if (e.ubicacion !== "granted") return "inicio";
  if (e.avisos !== "granted") return e.avisos === "denied" ? "bloqueado" : "inicio";
  // iOS con "mientras se usa" ya avisa (disparador de ubicación).
  if (e.plataforma === "ios") return null;
  if (e.segundoPlano !== "granted") return "segundo_plano";
  return null;
}

/** Ejecuta los pedidos del paso. Devuelve el estado final. */
export async function activarGeoPush(paso: Paso): Promise<EstadoGeoPush | null> {
  const { GeoPush, sincronizarGeoPush } = await import("@/lib/geopush");
  const { auth } = await import("@/lib/firebase");
  if (paso === "bloqueado") {
    await GeoPush.abrirAjustes();
    return null;
  }
  if (paso === "inicio") {
    // El permiso de avisos es el mismo que usa el push del Club: se registra el token de una vez.
    try {
      const { registerFcmToken } = await import("@/lib/fcmTokenManager");
      await registerFcmToken();
    } catch {}
    let e = await GeoPush.pedirPermiso({ paso: "avisos" });
    if (e.ubicacion !== "granted") e = await GeoPush.pedirPermiso({ paso: "ubicacion" });
    await sincronizarGeoPush(auth.currentUser);
    return GeoPush.estado();
  }
  const e = await GeoPush.pedirPermiso({ paso: "segundoPlano" });
  await sincronizarGeoPush(auth.currentUser);
  return e;
}

/**
 * Tarjeta de la home. Se esconde sola si ya está activo, si no es la app
 * nativa o si la persona dijo "Ahora no" hace menos de una semana.
 */
export function GeoPushTarjeta() {
  const { estado, setEstado, disponible, refrescar } = useGeoPushEstado();
  const [pospuesto, setPospuesto] = useState(true);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    try {
      const hasta = Number(localStorage.getItem(CLAVE_POSPUESTO) || 0);
      setPospuesto(Date.now() < hasta);
    } catch {
      setPospuesto(false);
    }
  }, []);

  const paso = pasoPendiente(estado);
  if (!disponible || !estado || !paso || pospuesto || !estado.zonas) return null;

  const posponer = () => {
    try {
      localStorage.setItem(CLAVE_POSPUESTO, String(Date.now() + DIAS_POSPUESTO * 86_400_000));
    } catch {}
    setPospuesto(true);
  };

  const activar = async () => {
    setCargando(true);
    try {
      const e = await activarGeoPush(paso);
      if (e) setEstado(e);
      else await refrescar();
    } finally {
      setCargando(false);
    }
  };

  return <GeoPushCaja paso={paso} cargando={cargando} onActivar={activar} onCerrar={posponer} plataforma={estado.plataforma} />;
}

export function GeoPushCaja({
  paso,
  cargando,
  onActivar,
  onCerrar,
  plataforma,
}: {
  paso: Paso;
  cargando: boolean;
  onActivar: () => void;
  onCerrar?: () => void;
  plataforma: "android" | "ios";
}) {
  const titulo =
    paso === "segundo_plano" ? "Un paso más para el aviso" :
    paso === "bloqueado" ? "Los avisos de llegada están bloqueados" :
    "Te avisamos cuando llegues al Patio";

  const boton =
    paso === "segundo_plano" ? "Elegir “Permitir todo el tiempo”" :
    paso === "bloqueado" ? "Abrir ajustes de Club Patio" :
    "Activar aviso de llegada";

  return (
    <div className="relative rounded-[22px] p-5 mb-5 text-left text-white shadow-lg" style={{ background: "linear-gradient(135deg,#C9920A 0%,#E0AE2A 100%)" }}>
      {onCerrar && (
        <button onClick={onCerrar} aria-label="Ahora no" className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/10 flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-center gap-3 mb-3 pr-8">
        <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
          {paso === "bloqueado" ? <Settings className="w-6 h-6" /> : paso === "segundo_plano" ? <MapPin className="w-6 h-6" /> : <BellRing className="w-6 h-6" />}
        </div>
        <p className="m-0 text-[17px] font-black leading-tight">{titulo}</p>
      </div>

      <p className="m-0 mb-2 text-[13px] leading-[1.5] text-white/95">
        Al llegar te recordamos tus sellos y los premios que tienes cerca, para que no se te pase pedirlos en caja.
      </p>
      {/* Divulgación exigida por Google Play: visible, antes del diálogo del sistema. */}
      <p className="m-0 mb-4 rounded-xl bg-black/15 px-3 py-2.5 text-[12px] leading-[1.5] text-white">
        {TEXTO_DIVULGACION}
      </p>
      {paso === "segundo_plano" && plataforma === "android" && (
        <p className="m-0 mb-4 text-[12.5px] font-semibold leading-[1.5]">
          En la pantalla que se abre, toca <b>Ubicación</b> y elige <b>Permitir todo el tiempo</b>. Después vuelve a la app.
        </p>
      )}
      {paso === "bloqueado" && (
        <p className="m-0 mb-4 text-[12.5px] font-semibold leading-[1.5]">
          {plataforma === "ios"
            ? "En Ajustes, toca Ubicación → Al usar la app (o Siempre), y Notificaciones → Permitir."
            : "En Ajustes, toca Permisos → Ubicación → Permitir todo el tiempo, y Notificaciones → Permitir."}
        </p>
      )}

      <button
        onClick={onActivar}
        disabled={cargando}
        className="w-full h-12 rounded-2xl bg-white text-[#8A6200] text-[14px] font-black shadow-md active:scale-[0.98] transition disabled:opacity-60"
      >
        {cargando ? "Un momento…" : boton}
      </button>
      {onCerrar && (
        <button onClick={onCerrar} className="w-full mt-2 h-9 text-[12.5px] font-bold text-white/90">
          Ahora no
        </button>
      )}
    </div>
  );
}
