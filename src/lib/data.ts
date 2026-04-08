
export type Category = { id: string; name: string; icon: string; };
export type Entrepreneur = { id: string; name: string; category: string; description: string; contact: string; schedule: string; locationId: string; imageUrl: string; };
export type Premio = { id: string; nombre: string; costo: number; icono: string; esSorteo?: boolean; };
export type MapLocation = { id: string; name: string; x: number; y: number; };

export const PATIO_INFO = {
  name: "Outlet Curauma",
  address: "Outlet Curauma. Av. Lomas de la Luz 4650, Curauma, Valparaíso.",
  city: "Valparaíso",
  region: "V Región",
  phone: "+56 9 9969 0322",
  whatsapp: "56999690322",
  instagram: "patiocurauma",
  facebook: "100063522160910",
  tiktok: "patio_curauma",
  coordinates: { lat: -33.1316449, lng: -71.5668639 }
};

export const CATEGORIES: Category[] = [
  { id: 'all', name: 'Todos', icon: 'LayoutGrid' },
  { id: 'deco', name: 'Deco & Hogar', icon: 'Home' },
  { id: 'gourmet', name: 'Gourmet & Licores', icon: 'Utensils' },
  { id: 'joyeria', name: 'Joyería & Accesorios', icon: 'Gem' },
  { id: 'belleza', name: 'Belleza', icon: 'Sparkles' },
  { id: 'artesania', name: 'Artesanías', icon: 'Palette' },
];

/**
 * Datos de ejemplo enriquecidos para la presentación.
 */
export const ENTREPRENEURS: Entrepreneur[] = [
  { 
    id: 'demo1', 
    name: 'EcoHogar', 
    category: 'deco', 
    description: 'Boutique sustentable. Decoración minimalista y elementos orgánicos que llenan tu casa de calma. Todo fabricado localmente y libre de plástico. 🌿', 
    contact: '+56 9 1111 2222', 
    schedule: 'Lun-Sáb 10:00 - 19:30', 
    locationId: 'loc-1', 
    imageUrl: 'https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=500&q=80' 
  },
  { 
    id: 'demo2', 
    name: 'Bodega Gourmet', 
    category: 'gourmet', 
    description: 'Vinos de autor, quesos madurados y charcutería fina artesanal de Valparaíso. El lugar perfecto, directo al paladar. 🍷', 
    contact: '+56 9 3333 4444', 
    schedule: 'Mar-Dom 11:00 - 21:00', 
    locationId: 'loc-2', 
    imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500&q=80' 
  },
  { 
    id: 'demo3', 
    name: 'Áurea Joyas', 
    category: 'joyeria', 
    description: 'Accesorios exclusivos hechos a mano por orfebres locales bañados en oro. Diseños únicos que realzan tu belleza y presencia. ✨', 
    contact: '+56 9 5555 6666', 
    schedule: 'Lun-Vie 10:30 - 18:30', 
    locationId: 'loc-3', 
    imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80' 
  },
  { 
    id: 'demo4', 
    name: 'Lumia Cosmética', 
    category: 'belleza', 
    description: 'Skincare cruelty-free inspirado en texturas naturales con vitaminas activas. Consiéntete como te mereces. 🌸', 
    contact: '+56 9 7777 8888', 
    schedule: 'Lun-Vie 09:00 - 19:00', 
    locationId: 'loc-4', 
    imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&q=80' 
  }
];

export const PREMIOS: Premio[] = [
  { id: 'sorteo-grande', nombre: 'Participación en Gran Sorteo', costo: 10, icono: '🏆', esSorteo: true },
  { id: 'cafe', nombre: 'Café de Especialidad', costo: 5, icono: '☕' },
  { id: 'entrada', nombre: 'Entrada a Evento Patio', costo: 8, icono: '🎫' },
];

export const MAP_LOCATIONS: MapLocation[] = [
  { id: 'loc-1', name: 'Sector Norte', x: 25, y: 30 },
  { id: 'loc-2', name: 'Sector Sur', x: 75, y: 70 },
  { id: 'loc-3', name: 'Plaza Central', x: 50, y: 50 },
  { id: 'loc-4', name: 'Entrada Principal', x: 15, y: 15 },
];
