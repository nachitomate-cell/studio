import { useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

// ── 1. Arreglo de Locales Premium con IDs deterministas para notificaciones ────
const PREMIUM_LOCALS = [
  {
    id: 'ruta-curauma',
    notifId: 1000, // ← ID fijo para Capacitor (determinista, nunca cambia)
    name: 'Ruta de Curauma',
    lat: -33.1316449,
    lng: -71.564289,
    message: '¡Terminaste de trotar! Pasa a recuperar energías a Fika Coffeshop o El Refugio y gana doble sello hoy.'
  },
  {
    id: 'fronza',
    notifId: 1001, // ← ID fijo para Capacitor
    name: 'Fronza Automotriz',
    lat: -33.1300000,
    lng: -71.5600000,
    message: '¡Estás cerca de Fronza! Entra y agenda tu Test Drive hoy mismo.'
  }
];

const GEOFENCE_RADIUS_METERS = 100;
const COOLDOWN_HOURS = 12;

// ── 2. Fórmula de Haversine para cálculo de distancia ─────────────────────────
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distancia en metros
}

// ── 3. El Hook Principal (Idempotente) ────────────────────────────────────────
export function useGeofencing() {
  const watchId = useRef<string | null>(null);
  // Guard contra doble ejecución por StrictMode de React/Next.js
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Solo corre en dispositivos nativos (iOS/Android), no en la web.
    if (!Capacitor.isNativePlatform()) {
      console.log('Geofencing ignorado: El motor de geocercas requiere un entorno nativo (iOS/Android).');
      return;
    }

    const initGeofencing = async () => {
      try {
        // A. Solicitar Permisos
        const geoPerms = await Geolocation.requestPermissions();
        if (geoPerms.location !== 'granted') {
          console.warn('Permiso de geolocalización denegado.');
          return;
        }

        const notifPerms = await LocalNotifications.requestPermissions();
        if (notifPerms.display !== 'granted') {
          console.warn('Permiso de notificaciones denegado.');
          return;
        }

        // Guard: si el componente fue desmontado durante los awaits, abortar
        if (!mountedRef.current) return;

        // B. Limpieza preventiva: cancelar notificaciones previas de geofencing
        //    Esto garantiza idempotencia en re-mounts (StrictMode, navegación, etc.)
        try {
          await LocalNotifications.cancel({
            notifications: PREMIUM_LOCALS.map(local => ({ id: local.notifId }))
          });
          console.log('[Geofence] Notificaciones previas canceladas (cleanup preventivo).');
        } catch (cancelErr) {
          // Si no había notificaciones previas, cancel puede fallar silenciosamente
          console.warn('[Geofence] Cancel preventivo (no-op si no había pendientes):', cancelErr);
        }

        // C. El Vigía de Ubicación (Watch Position)
        watchId.current = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          async (position, err) => {
            if (err || !position) {
              console.error('Error obteniendo ubicación en background/foreground:', err);
              return;
            }

            // Guard: si el efecto ya fue limpiado, no procesar
            if (!mountedRef.current) return;

            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            // D. Lógica de Disparo (Trigger) por cada local
            for (const local of PREMIUM_LOCALS) {
              const distance = calculateDistance(userLat, userLng, local.lat, local.lng);

              if (distance <= GEOFENCE_RADIUS_METERS) {
                // E. Manejo de Estado (Cooldown) con Capacitor Preferences
                const { value: lastSentStr } = await Preferences.get({ key: `notif_cooldown_${local.id}` });
                const lastSent = lastSentStr ? parseInt(lastSentStr, 10) : 0;
                const now = Date.now();
                const hoursSinceLastSent = (now - lastSent) / (1000 * 60 * 60);

                if (hoursSinceLastSent >= COOLDOWN_HOURS) {
                  // F. Verificar pendientes antes de agendar (doble seguridad)
                  const { notifications: pending } = await LocalNotifications.getPending();
                  const alreadyPending = pending.some(n => n.id === local.notifId);

                  if (alreadyPending) {
                    console.log(`[Geofence] Notificación para ${local.name} ya está pendiente (id: ${local.notifId}), saltando.`);
                    continue;
                  }

                  // G. Agendar con ID FIJO (determinista) — Capacitor reemplaza si ya existe
                  await LocalNotifications.schedule({
                    notifications: [
                      {
                        id: local.notifId,         // ← ID fijo, no aleatorio
                        title: '📍 ¡Estás muy cerca!',
                        body: local.message,
                        schedule: { at: new Date(Date.now() + 1000) },
                      },
                    ],
                  });

                  // H. Registrar cooldown
                  await Preferences.set({
                    key: `notif_cooldown_${local.id}`,
                    value: now.toString(),
                  });

                  console.log(`✅ [Geofence] Notificación enviada para ${local.name} (id: ${local.notifId})`);
                }
              }
            }
          }
        );
      } catch (error) {
        console.error('Error inicializando el motor de Geofencing:', error);
      }
    };

    initGeofencing();

    // I. Limpieza al desmontar (Cleanup)
    return () => {
      mountedRef.current = false;

      if (watchId.current) {
        Geolocation.clearWatch({ id: watchId.current });
        watchId.current = null;
      }

      // Cancelar notificaciones pendientes de geofencing al desmontar
      LocalNotifications.cancel({
        notifications: PREMIUM_LOCALS.map(local => ({ id: local.notifId }))
      }).catch(() => {});
    };
  }, []);
}

