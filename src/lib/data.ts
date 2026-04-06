
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
};

export const CATEGORIES: Category[] = [
  { id: 'all', name: 'Todos', icon: 'LayoutGrid' },
  { id: 'food', name: 'Gastronomía', icon: 'Utensils' },
  { id: 'crafts', name: 'Artesanía', icon: 'Palette' },
  { id: 'plants', name: 'Plantas', icon: 'Leaf' },
  { id: 'services', name: 'Servicios', icon: 'Wrench' },
  { id: 'fashion', name: 'Moda', icon: 'Shirt' },
];

export const ENTREPRENEURS: Entrepreneur[] = [
  {
    id: 'e1',
    name: 'Sabores del Patio',
    category: 'food',
    description: 'Comida casera con ingredientes orgánicos de la zona.',
    contact: '+56 9 1234 5678',
    schedule: 'Lun-Vie 10:00 - 19:00',
    locationId: 'loc-1',
    imageUrl: 'https://picsum.photos/seed/food1/400/300'
  },
  {
    id: 'e2',
    name: 'Artesanías Curauma',
    category: 'crafts',
    description: 'Joyas únicas hechas a mano con piedras locales.',
    contact: '+56 9 8765 4321',
    schedule: 'Sáb-Dom 11:00 - 20:00',
    locationId: 'loc-3',
    imageUrl: 'https://picsum.photos/seed/craft1/400/300'
  },
  {
    id: 'e3',
    name: 'Rincón Verde',
    category: 'plants',
    description: 'Vivero especializado en suculentas y plantas de interior.',
    contact: '+56 9 5555 4444',
    schedule: 'Mié-Dom 09:00 - 18:00',
    locationId: 'loc-2',
    imageUrl: 'https://picsum.photos/seed/plant1/400/300'
  },
  {
    id: 'e4',
    name: 'Costuras con Amor',
    category: 'fashion',
    description: 'Reparación de prendas y confección de accesorios textiles.',
    contact: '+56 9 3333 2222',
    schedule: 'Lun-Vie 09:00 - 17:00',
    locationId: 'loc-5',
    imageUrl: 'https://picsum.photos/seed/fashion1/400/300'
  },
  {
    id: 'e5',
    name: 'Tech Fix Curauma',
    category: 'services',
    description: 'Reparación de celulares y laptops en el momento.',
    contact: '+56 9 9999 8888',
    schedule: 'Lun-Sáb 10:00 - 18:30',
    locationId: 'loc-4',
    imageUrl: 'https://picsum.photos/seed/service1/400/300'
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
  { id: 'cafe', nombre: 'Café de Especialidad', costo: 5, icono: '☕' },
  { id: 'entrada', nombre: 'Entrada Curauma Fest', costo: 10, icono: '🎫' },
];
