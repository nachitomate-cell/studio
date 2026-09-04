/**
 * geoLink.ts — extrae coordenadas de lo que sea que pegue un emprendedor.
 *
 * POR QUÉ EXISTE: pedirle latitud y longitud a un comerciante no funciona.
 * Lo que sí sabe hacer es abrir Google Maps, tocar "Compartir" y pegar el
 * enlace. Ese enlace viene en media docena de formatos distintos según si lo
 * copió del navegador, de la app de Android o de iOS, así que aquí se
 * normalizan todos a un par de números.
 *
 * Los enlaces cortos (maps.app.goo.gl) no se pueden resolver en el navegador
 * por CORS: de eso se encarga /api/geo/resolver, que sigue la redirección y
 * devuelve la URL larga para pasarla por esta misma función.
 */

export type Coords = { lat: number; lng: number };

/** Un enlace corto hay que resolverlo en el servidor antes de poder leerlo. */
export function esEnlaceCorto(texto: string): boolean {
  return /(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i.test(texto);
}

function valido(lat: number, lng: number): Coords | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // 0,0 es el Golfo de Guinea: casi siempre significa "no se pudo leer".
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

const NUM = "(-?\\d{1,3}\\.\\d+)";

/**
 * Los patrones van del más preciso al más tolerante. El orden importa: en una
 * URL de lugar, `@` apunta al centro del mapa (que puede estar desplazado)
 * mientras que `!3d!4d` apunta al marcador exacto del local.
 */
const PATRONES: RegExp[] = [
  new RegExp(`!3d${NUM}!4d${NUM}`),                        // marcador exacto del lugar
  new RegExp(`[?&](?:q|query|ll|sll|daddr|destination)=(?:loc:)?${NUM}%2C\\s*${NUM}`, "i"),
  new RegExp(`[?&](?:q|query|ll|sll|daddr|destination)=(?:loc:)?${NUM},\\s*${NUM}`, "i"),
  new RegExp(`@${NUM},${NUM}`),                            // centro del mapa
  new RegExp(`^\\s*${NUM}\\s*,\\s*${NUM}\\s*$`),           // coordenadas pegadas a mano
];

/**
 * Devuelve las coordenadas contenidas en un enlace de Google Maps o en un par
 * de números pegado directamente. `null` si no hay nada reconocible.
 */
export function extraerCoords(texto: string | null | undefined): Coords | null {
  if (!texto) return null;
  const limpio = decodeURIComponent(texto.trim());
  for (const patron of PATRONES) {
    const m = patron.exec(limpio);
    if (m) {
      const c = valido(parseFloat(m[1]), parseFloat(m[2]));
      if (c) return c;
    }
  }
  return null;
}

/** El enlace que se le entrega al socio para que le abra su app de mapas. */
export function urlMapa({ lat, lng }: Coords): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
