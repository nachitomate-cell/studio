export type CerroBac = 'Alegre' | 'Concepción';

export interface LocalBac {
  id: string;
  nombre: string;
  instagram: string;
  cerro: CerroBac;
  categoria: string;
  promoText: '1 Tapa + 1 Cóctel x $6.000';
  direccion: string;
  lat: number;
  lng: number;
}

export const LOCALES_BAC: LocalBac[] = [
  { id: 'fatkidburgers', nombre: 'Fat Kid Burgers', instagram: '@fatkidburgers', cerro: 'Concepción', categoria: 'Burgers & Bar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Lautaro 585', lat: -33.0415, lng: -71.6285 },
  { id: 'plantabaja_valpo', nombre: 'Planta Baja', instagram: '@plantabaja_valpo', cerro: 'Concepción', categoria: 'Restobar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Abtao 555', lat: -33.0435, lng: -71.6290 },
  { id: 'laconquistada_valparaiso', nombre: 'La Conquistada', instagram: '@laconquistada_valparaiso', cerro: 'Alegre', categoria: 'Cocina & Bar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Almirante Montt 465', lat: -33.0425, lng: -71.6300 },
  { id: 'momovalparaiso', nombre: 'Momo Valparaíso', instagram: '@momovalparaiso', cerro: 'Alegre', categoria: 'Restobar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Almirante Montt 421', lat: -33.0420, lng: -71.6302 },
  { id: 'bardepisco', nombre: 'Bar de Pisco', instagram: '@bardepisco', cerro: 'Alegre', categoria: 'Coctelería', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Almirante Montt 380', lat: -33.0418, lng: -71.6305 },
  { id: 'casalegrevalparaiso', nombre: 'Casalegre', instagram: '@casalegrevalparaiso', cerro: 'Alegre', categoria: 'Restaurante', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Urriola 522', lat: -33.0422, lng: -71.6310 },
  { id: 'faunahotelrestaurante', nombre: 'Fauna Restaurante', instagram: '@faunahotelrestaurante', cerro: 'Alegre', categoria: 'Restaurante & Terraza', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Paseo Dimalow 166', lat: -33.0423, lng: -71.6315 },
  { id: 'kapura_valparaiso', nombre: 'Kapura', instagram: '@kapura_valparaiso', cerro: 'Concepción', categoria: 'Bar & Cocina', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Papudo 454', lat: -33.0442, lng: -71.6292 },
  { id: 'jardincervecero_cl', nombre: 'Jardín Cervecero', instagram: '@jardincervecero_cl', cerro: 'Alegre', categoria: 'Cervecería', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Urriola 637', lat: -33.0428, lng: -71.6305 },
  { id: 'ilpaparazzovalparaiso', nombre: 'Il Paparazzo', instagram: '@ilpaparazzovalparaiso', cerro: 'Concepción', categoria: 'Restaurante', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Papudo 424', lat: -33.0440, lng: -71.6285 },
  { id: 'hotzenplotz_alegre', nombre: 'Hotzenplotz', instagram: '@hotzenplotz_alegre', cerro: 'Alegre', categoria: 'Bar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Paseo Dimalow', lat: -33.0425, lng: -71.6312 },
  { id: 'terratvalpo', nombre: 'Terrat', instagram: '@terratvalpo', cerro: 'Alegre', categoria: 'Restobar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Almirante Montt 448', lat: -33.0421, lng: -71.6303 },
  { id: 'quintorumbo', nombre: 'Quinto Rumbo', instagram: '@quintorumbo.cocinaybar', cerro: 'Concepción', categoria: 'Cocina & Bar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Templeman 362', lat: -33.0430, lng: -71.6292 },
  { id: 'corazoncontinto', nombre: 'Corazón con Tinto', instagram: '@corazoncontinto.cl', cerro: 'Concepción', categoria: 'Bar de Vinos & Tapas', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Templeman 561', lat: -33.0428, lng: -71.6285 },
  { id: 'almamiavalparaiso', nombre: 'Alma Mía', instagram: '@almamiavalparaiso', cerro: 'Alegre', categoria: 'Restobar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Almirante Montt 484', lat: -33.0424, lng: -71.6301 },
  { id: 'malizioso_pizzeria', nombre: 'Malizioso Pizzería', instagram: '@malizioso.pizzeria', cerro: 'Alegre', categoria: 'Pizzería', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Almirante Montt 332', lat: -33.0412, lng: -71.6308 },
  { id: 'medialunavalpo', nombre: 'Media Luna', instagram: '@medialunavalpo', cerro: 'Concepción', categoria: 'Café & Bar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Abtao 589', lat: -33.0434, lng: -71.6292 },
  { id: 'raizchilena', nombre: 'Raíz Chilena', instagram: '@raizchilena.cl', cerro: 'Concepción', categoria: 'Cocina de Autor', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Abtao', lat: -33.0436, lng: -71.6291 },
  { id: 'terapiavalpo', nombre: 'Terapia Valpo', instagram: '@terapiavalpo', cerro: 'Alegre', categoria: 'Bar & Coctelería', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Capilla', lat: -33.0419, lng: -71.6315 },
  { id: 'piano_cafe', nombre: 'Piano Café', instagram: '@piano.cafe.valpo', cerro: 'Concepción', categoria: 'Café & Restobar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Concepción', lat: -33.0433, lng: -71.6294 },
  { id: 'parrilla_doncesar', nombre: 'Parrilla Don César', instagram: '@parrilla.doncesar', cerro: 'Concepción', categoria: 'Parrilla & Vinos', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Templeman', lat: -33.0430, lng: -71.6288 },
  { id: 'cafeparaiso', nombre: 'Café Paraíso 3.0', instagram: '@cafeparaiso3.0', cerro: 'Concepción', categoria: 'Cafetería & Bar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Gálvez', lat: -33.0435, lng: -71.6278 },
  { id: 'cocinapuerto', nombre: 'Cocina Puerto', instagram: '@cocinapuerto_valpo', cerro: 'Alegre', categoria: 'Cocina de Mar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Lautaro', lat: -33.0416, lng: -71.6310 },
  { id: 'mariamaria_valpo', nombre: 'María María', instagram: '@mariamaria_valpo', cerro: 'Alegre', categoria: 'Restobar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Beethoven', lat: -33.0432, lng: -71.6305 },
  { id: 'aidas_pizzeria', nombre: "Aida's Pizzería", instagram: '@aidas.pizzeria', cerro: 'Concepción', categoria: 'Pizzería', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Alvaro Besa', lat: -33.0426, lng: -71.6278 },
  { id: 'barlemutt', nombre: 'Bar Lemutt', instagram: '@barlemutt', cerro: 'Concepción', categoria: 'Bar', promoText: '1 Tapa + 1 Cóctel x $6.000', direccion: 'Urriola', lat: -33.0441, lng: -71.6280 },
];

export function instagramUrl(handle: string): string {
  const clean = handle.replace(/^@/, '');
  return `https://instagram.com/${clean}`;
}

export function localInitials(nombre: string): string {
  const words = nombre.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Haversine distance in meters between two lat/lng points.
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`;
}

// Center of Cerro Alegre / Concepción — used as initial map view.
export const BAC_MAP_CENTER: [number, number] = [-33.0428, -71.6297];
