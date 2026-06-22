/**
 * Utilidades de geolocalización para MARKETING / proximidad.
 *
 * IMPORTANTE: el geofence NO bloquea ninguna acción de la plataforma (ganar sellos
 * ni canjear premios). La seguridad del handshake recae en la confirmación manual
 * del vendedor. Estas utilidades existen para disparar alertas UI de proximidad
 * (ej. "Estás cerca del mall, aprovecha tus sellos").
 *
 * Todos los locales del Club están físicamente dentro de Patio Curauma, por lo que
 * el centro del mall es la referencia. Si en el futuro se almacenan coordenadas
 * por-local, basta con pasar esas coords a `distanciaMetros` en lugar de PATIO_CENTER.
 */

/** Centro de Patio Curauma (mismo punto usado en /api/check-geofence). */
export const PATIO_CENTER = { lat: -33.1316449, lng: -71.564289 };

/** Radio de referencia para alertas de proximidad (metros). */
export const GEOFENCE_RADIUS_M = 200;

/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
export function distanciaMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // radio terrestre en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * ¿Las coordenadas están dentro del radio de proximidad del Patio?
 * NO lanza ni bloquea — devuelve un booleano para uso en marketing/UI.
 * Coordenadas ausentes o inválidas devuelven `false` (no se sabe → no se alerta).
 */
export function estaCercaDelPatio(
  clientLat: unknown,
  clientLng: unknown,
  radiusM: number = GEOFENCE_RADIUS_M
): boolean {
  if (typeof clientLat !== "number" || typeof clientLng !== "number" || Number.isNaN(clientLat) || Number.isNaN(clientLng)) {
    return false;
  }
  return distanciaMetros(clientLat, clientLng, PATIO_CENTER.lat, PATIO_CENTER.lng) <= radiusM;
}
