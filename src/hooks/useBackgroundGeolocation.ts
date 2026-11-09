"use client";

/**
 * useBackgroundGeolocation — SOLO navegador / PWA.
 *
 * Sigue la posición con watchPosition mientras la página está abierta. En la
 * app de las tiendas no se usa: ahí avisan las geocercas del sistema
 * (plugins/geopush), que funcionan con la app cerrada y sin gastar batería en
 * un GPS continuo.
 */

import { useEffect, useRef } from "react";

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

interface UseBackgroundGeolocationOptions {
  enabled: boolean;
  onPosition: (pos: GeoPosition) => void;
  onError?: (message: string) => void;
  /** Se mantiene por compatibilidad; watchPosition no lo usa. */
  distanceFilter?: number;
}

export function useBackgroundGeolocation({ enabled, onPosition, onError }: UseBackgroundGeolocationOptions) {
  const onPositionRef = useRef(onPosition);
  const onErrorRef = useRef(onError);
  onPositionRef.current = onPosition;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      onErrorRef.current?.("Geolocalización no disponible en este navegador.");
      return;
    }

    // getCurrentPosition y watchPosition reportan el mismo permiso denegado: avisar una vez.
    let errorReportado = false;
    const reportar = (e: GeolocationPositionError) => {
      if (!errorReportado) {
        errorReportado = true;
        onErrorRef.current?.(e.message);
      }
    };
    const opts: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 };
    const enviar = (p: GeolocationPosition) =>
      onPositionRef.current({ latitude: p.coords.latitude, longitude: p.coords.longitude });

    navigator.geolocation.getCurrentPosition(enviar, reportar, opts);
    const watchId = navigator.geolocation.watchPosition(enviar, reportar, opts);
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);
}
