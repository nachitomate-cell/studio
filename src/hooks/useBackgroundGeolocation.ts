"use client";

/**
 * useBackgroundGeolocation
 *
 * En Android/iOS nativo (Capacitor) usa @capacitor-community/background-geolocation
 * que corre un Foreground Service (Android) / Background Location Mode (iOS) para
 * recibir posición GPS incluso con la app minimizada o cerrada.
 *
 * En navegador web hace fallback al watchPosition clásico (solo funciona en primer plano).
 *
 * INSTALACIÓN (ya ejecutada):
 *   npm install @capacitor-community/background-geolocation
 *   npx cap sync android
 *
 * iOS — pasos extra en Xcode (una vez que exista la carpeta ios/):
 *   1. Target → Signing & Capabilities → + Capability → Background Modes
 *      → activar "Location updates"
 *   2. Info.plist: agregar claves:
 *      NSLocationAlwaysAndWhenInUseUsageDescription
 *      NSLocationAlwaysUsageDescription
 *      NSLocationWhenInUseUsageDescription
 */

import { useEffect, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";

// Registro del plugin nativo — devuelve un proxy que enruta al código nativo
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  "BackgroundGeolocation"
);

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

interface UseBackgroundGeolocationOptions {
  enabled: boolean;
  onPosition: (pos: GeoPosition) => void;
  onError?: (message: string) => void;
  /** Mínimo desplazamiento (metros) para disparar callback. Default: 50 */
  distanceFilter?: number;
}

export function useBackgroundGeolocation({
  enabled,
  onPosition,
  onError,
  distanceFilter = 50,
}: UseBackgroundGeolocationOptions) {
  // Refs para que el callback siempre tenga la versión más reciente sin re-montar
  const onPositionRef = useRef(onPosition);
  const onErrorRef = useRef(onError);
  onPositionRef.current = onPosition;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let stopFn: (() => void) | null = null;

    // ── Nativo (Android / iOS) ──────────────────────────────────────────────
    async function startNative() {
      try {
        const id = await BackgroundGeolocation.addWatcher(
          {
            // Texto que aparece en la notificación persistente de Android
            backgroundMessage: "Detectando tu proximidad a Patio Curauma",
            backgroundTitle: "Club Patio activo",
            requestPermissions: true,
            stale: false,
            distanceFilter,
          },
          (position, error) => {
            if (error) {
              if (error.code === "NOT_AUTHORIZED") {
                onErrorRef.current?.(
                  'Sin permiso de ubicación. Ve a Configuración > Club Patio > Ubicación y elige "Siempre".'
                );
              } else {
                onErrorRef.current?.(error.message ?? "Error GPS");
              }
              return;
            }
            if (position) {
              onPositionRef.current({
                latitude: position.latitude,
                longitude: position.longitude,
              });
            }
          }
        );

        if (cancelled) {
          BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
          return;
        }

        stopFn = () => {
          BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
        };
      } catch (e) {
        console.error(
          "[BGGeo] Plugin nativo no disponible, usando Geolocation API del navegador:",
          e
        );
        stopFn = startWeb();
      }
    }

    // ── Web (navegador / PWA) ───────────────────────────────────────────────
    function startWeb(): () => void {
      if (!("geolocation" in navigator)) {
        onErrorRef.current?.("Geolocalización no disponible en este navegador.");
        return () => {};
      }

      const opts: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      };

      // Posición inmediata al iniciar
      navigator.geolocation.getCurrentPosition(
        (p) =>
          onPositionRef.current({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          }),
        (e) => onErrorRef.current?.(e.message),
        opts
      );

      // Seguimiento continuo
      const watchId = navigator.geolocation.watchPosition(
        (p) =>
          onPositionRef.current({
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          }),
        (e) => onErrorRef.current?.(e.message),
        opts
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }

    if (Capacitor.isNativePlatform()) {
      startNative();
    } else {
      stopFn = startWeb();
    }

    return () => {
      cancelled = true;
      stopFn?.();
    };
  }, [enabled, distanceFilter]);
}
