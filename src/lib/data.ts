
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

export const PATIO_INFO = {
  name: "Outlet Curauma",
  address: "Av. Lomas de la Luz 4650",
  city: "Curauma, Valparaíso",
  region: "Valparaíso - Chile",
  phone: "+56 9 9969 0322",
  whatsapp: "56999690322",
  instagram: "patiocurauma",
  facebook: "100063522160910",
  tiktok: "patio_curauma"
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
  },
  {
    id: 'e3',
    name: 'Alfo Accesorios',
    category: 'joyeria',
    description: 'Joyería y accesorios con diseño único. 💍',
    contact: '+56 9 5555 6666',
    schedule: 'Lun-Vie 11:00 - 20:00',
    locationId: 'loc-3',
    imageUrl: 'https://picsum.photos/seed/alfo/400/300'
  },
  {
    id: 'e4',
    name: 'Bendita India',
    category: 'joyeria',
    description: 'Moda mujer inspirada en la cultura y colores de la India. 👗',
    contact: '+56 9 7777 8888',
    schedule: 'Mié-Dom 11:00 - 19:00',
    locationId: 'loc-4',
    imageUrl: 'https://picsum.photos/seed/india/400/300'
  },
  {
    id: 'e5',
    name: 'Tashi Terapias',
    category: 'belleza',
    description: 'Servicios de belleza, terapias y cuidado integral. ✨',
    contact: '+56 9 9999 0000',
    schedule: 'Previa cita',
    locationId: 'loc-2',
    imageUrl: 'https://picsum.photos/seed/tashi/400/300'
  },
  {
    id: 'e6',
    name: 'Canela',
    category: 'artesania',
    description: 'Artesanías hechas a mano con dedicación y cariño. 🎨',
    contact: '+56 9 1212 3434',
    schedule: 'Fines de semana 10:00 - 20:00',
    locationId: 'loc-5',
    imageUrl: 'https://picsum.photos/seed/canela/400/300'
  }
];

export const MAP_LOCATIONS = [
  { id: 'loc-1', x: 20, y: 30, name: 'Sector Norte' },
  { id: 'loc-2', x: 70, y: 25, name: 'Plaza Central' },
  { id: 'loc-3', x: 45, y: 60, name: 'Pasillo Artesanos' },
  { id: 'loc-4', x: 15, y: 80, name: 'Zona Servicios' },
  { id: 'loc-5', x: 80, y: 85, name: 'Sector Sur' },
];

export const PREMIOS: Premio[] = [
  { id: 'sorteo-grande', nombre: 'Participación en Gran Sorteo', costo: 10, icono: '🏆', esSorteo: true },
  { id: 'cafe', nombre: 'Café de Especialidad', costo: 5, icono: '☕' },
  { id: 'entrada', nombre: 'Entrada a Evento Patio', costo: 8, icono: '🎫' },
];
