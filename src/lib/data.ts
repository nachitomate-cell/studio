
export type Category = {
  id: string;
  name: string;
  icon: string;
};

export type Entrepreneur = {
  id: string;
  name: string;
  category: string;
  description: string;
  contact: string;
  schedule: string;
  locationId: string;
  imageUrl: string;
};

export type Premio = {
  id: string;
  nombre: string;
  costo: number;
  icono: string;
  esSorteo?: boolean;
};

export type MapLocation = {
  id: string;
  name: string;
  x: number;
  y: number;
};

export const PATIO_INFO = {
  name: "Outlet Curauma",
  address: "Outlet Curauma. Av. Lomas de la Luz 4650, Curauma, Valparaíso.",
  phone: "+56 9 9969 0322",
  whatsapp: "56999690322",
  instagram: "patiocurauma",
  facebook: "100063522160910",
  tiktok: "patio_curauma",
  coordinates: {
    lat: -33.1316449,
    lng: -71.5668639
  }
};

export const CATEGORIES: Category[] = [
  { id: 'all', name: 'Todos', icon: 'LayoutGrid' },
  { id: 'deco', name: 'Deco & Hogar', icon: 'Home' },
  { id: 'gourmet', name: 'Gourmet & Licores', icon: 'Utensils' },
  { id: 'joyeria', name: 'Joyería & Accesorios', icon: 'Gem' },
  { id: 'belleza', name: 'Belleza', icon: 'Sparkles' },
  { id: 'artesania', name: 'Artesanías', icon: 'Palette' },
];

export const ENTREPRENEURS: Entrepreneur[] = [
  {
    id: 'e1',
    name: 'Aromavida - Biogreen',
    category: 'deco',
    description: 'Productos eco-sostenibles para el hogar y cuidado personal. 🌿',
    contact: '+56 9 1111 2222',
    schedule: 'Lun-Sáb 10:00 - 19:00',
    locationId: 'loc-1',
    imageUrl: 'https://picsum.photos/seed/biogreen/400/300'
  },
  {
    id: 'e2',
    name: 'Curauma Sabor',
    category: 'gourmet',
    description: 'Exclusiva selección de licores y sabores gourmet. 🍔',
    contact: '+56 9 3333 4444',
    schedule: 'Mar-Dom 12:00 - 21:00',
    locationId: 'loc-2',
    imageUrl: 'https://picsum.photos/seed/sabor/400/300'
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
