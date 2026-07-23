export type CerroBac = 'Alegre' | 'Concepción';

export interface LocalBac {
  id: string;
  nombre: string;
  instagram: string;
  cerro: CerroBac;
  categoria: string;
  promoText: '1 Tapa + 1 Cóctel x $6.000';
  direccion: string;
  descripcion: string;
  lat: number;
  lng: number;
}

export const LOCALES_BAC: LocalBac[] = [
  {
    id: 'fatkidburgers',
    nombre: 'Fat Kid Burgers',
    instagram: '@fatkidburgers',
    cerro: 'Alegre',
    categoria: 'Burgers & Bar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Lautaro 585',
    descripcion:
      'Cocina urbana con personalidad e ingredientes de calidad. Tapa: taco pelícano de camarón o taco vegetariano. Cóctel: Vermouth spritz (mocktail: Zerozotti spritz).',
    lat: -33.0415,
    lng: -71.6285,
  },
  {
    id: 'plantabaja_valpo',
    nombre: 'Planta Baja',
    instagram: '@plantabaja_valpo',
    cerro: 'Concepción',
    categoria: 'Restobar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Abtao 555',
    descripcion:
      'Alta cocina sin protocolos, con ingredientes locales y platos creativos. Tapa: pesca de roca curada con emulsión de camote asado o tártaro de hongos ahumado. Cóctel: pisco sour ahumado en casa (mocktail: limonada de hibiscus).',
    lat: -33.0435,
    lng: -71.6290,
  },
  {
    id: 'laconquistada_valparaiso',
    nombre: 'La Conquistada',
    instagram: '@laconquistada_valparaiso',
    cerro: 'Alegre',
    categoria: 'Cocina & Bar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Almirante Montt 465',
    descripcion:
      'Cocina chilena clásica en un ambiente tradicional con música en vivo. Tapa: sopaipilla salada con gravlax de salmón o tartaleta de hongos. Cóctel: gin con piña y manzana en jarabe de eucalipto (disponible en mocktail).',
    lat: -33.0425,
    lng: -71.6300,
  },
  {
    id: 'momovalparaiso',
    nombre: 'Momo Valparaíso',
    instagram: '@momovalparaiso',
    cerro: 'Alegre',
    categoria: 'Restobar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Almirante Montt 421',
    descripcion:
      'Cocina asiática fusión con estética urbana y personalidad. Tapa: brocheta de tofu marinado sobre puré de coliflor (vegana). Cóctel: Valpo Mule (vodka, jengibre y pepino).',
    lat: -33.0420,
    lng: -71.6302,
  },
  {
    id: 'bardepisco',
    nombre: 'Bar de Pisco',
    instagram: '@bardepisco',
    cerro: 'Alegre',
    categoria: 'Coctelería',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Almirante Montt 380',
    descripcion:
      'Tradición del pisco con cervezas artesanales y coctelería de autor. Tapa: pastelitos de choclo (tradicional y vegetariano). Cóctel: sour de Carmenère con pisco o cerveza artesanal Cerro Alegre Blonde Ale.',
    lat: -33.0418,
    lng: -71.6305,
  },
  {
    id: 'casalegrevalparaiso',
    nombre: 'Casalegre',
    instagram: '@casalegrevalparaiso',
    cerro: 'Alegre',
    categoria: 'Restaurante',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Urriola 522',
    descripcion:
      'Cocina tradicional chilena con pescados y mariscos frescos. Tapa: ají de gallina o polenta grillada (vegetariana). Cóctel: Green Day (pisco, cilantro y cítricos) o mocktail de coco y piña.',
    lat: -33.0422,
    lng: -71.6310,
  },
  {
    id: 'faunahotelrestaurante',
    nombre: 'Fauna Restaurante',
    instagram: '@faunahotelrestaurante',
    cerro: 'Alegre',
    categoria: 'Restaurante & Terraza',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Paseo Dimalow 166',
    descripcion:
      'Cocina chilena contemporánea con producto local y terraza panorámica sobre la bahía. Tapa: albóndiga de vacuno o arancini de hongos (vegetariana). Cóctel: Carmenère infusionado con canela, naranja y café.',
    lat: -33.0423,
    lng: -71.6315,
  },
  {
    id: 'kapura_valparaiso',
    nombre: 'Kapura',
    instagram: '@kapura_valparaiso',
    cerro: 'Concepción',
    categoria: 'Bar & Cocina',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Papudo 454',
    descripcion:
      'Restobar de comida fresca y buenos tragos con terraza vista bahía. Tapa: tabla de salmón ahumado, jamón serrano y bolita de camote. Cóctel: sangría fresca, sangría caprina o Valpo Mule.',
    lat: -33.0442,
    lng: -71.6292,
  },
  {
    id: 'jardincervecero_cl',
    nombre: 'Jardín Cervecero',
    instagram: '@jardincervecero_cl',
    cerro: 'Concepción',
    categoria: 'Cervecería',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Urriola 637',
    descripcion:
      'Cervecería al aire libre con ambiente relajado, pizzas y hamburguesas. Tapa: tártaro de vacuno, tártaro de alcachofa o tártaro de salmón ahumado. Cóctel: sangría, pisco sour o cerveza artesanal.',
    lat: -33.0428,
    lng: -71.6305,
  },
  {
    id: 'ilpaparazzovalparaiso',
    nombre: 'Il Paparazzo',
    instagram: '@ilpaparazzovalparaiso',
    cerro: 'Concepción',
    categoria: 'Restaurante',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Papudo 424',
    descripcion:
      'Cocina italiana y mediterránea: pastas, pescados y mariscos. Tapa: ceviche de atún o ceviche de hongos maridado con vino Emiliana Novas. Cóctel: gnocchi de camarón o gnocchi con queso azul (opción con vino).',
    lat: -33.0440,
    lng: -71.6285,
  },
  {
    id: 'hotzenplotz_alegre',
    nombre: 'Hotzenplotz',
    instagram: '@hotzenplotz_alegre',
    cerro: 'Alegre',
    categoria: 'Bar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Paseo Dimalow',
    descripcion:
      'Auténtica cocina alemana con cervezas artesanales y salchichas. Tapa: bruschetta con salchicha alemana o bruschetta con hummus y falafel. Cóctel: schop de cerveza artesanal 300cc.',
    lat: -33.0425,
    lng: -71.6312,
  },
  {
    id: 'terratvalpo',
    nombre: 'Terrat',
    instagram: '@terratvalpo',
    cerro: 'Alegre',
    categoria: 'Restobar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Almirante Montt 448',
    descripcion:
      'Tapas, pescados y coctelería de autor con vista a la bahía. Tapa: tortilla de papas, tártaro de salmón o jamón ibérico con tomate. Cóctel: sangría, cerveza o sidra de pera.',
    lat: -33.0421,
    lng: -71.6303,
  },
  {
    id: 'quintorumbo',
    nombre: 'Quinto Rumbo',
    instagram: '@quintorumbo.cocinaybar',
    cerro: 'Concepción',
    categoria: 'Cocina & Bar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Templeman 362',
    descripcion:
      'Nueva cocina porteña que fusiona la memoria local con técnicas modernas. Tapa: taco de cerdo desmenuzado o taco de hongos (vegano). Cóctel: Cabernet Sauvignon Viña Ranquilhue (mocktail: mojito de berries).',
    lat: -33.0430,
    lng: -71.6292,
  },
  {
    id: 'corazoncontinto',
    nombre: 'Corazón con Tinto',
    instagram: '@corazoncontinto.cl',
    cerro: 'Concepción',
    categoria: 'Bar de Vinos & Tapas',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Templeman 561',
    descripcion:
      'Bar de vinos independiente sin protocolo, foco en cepas chilenas. Tapa: taco de vacuno, tártaro de bonito o crostini con vegetales encurtidos. Cóctel: sangría araucana, sangría blanca o copa de vino.',
    lat: -33.0428,
    lng: -71.6285,
  },
  {
    id: 'almamiavalparaiso',
    nombre: 'Alma Mía',
    instagram: '@almamiavalparaiso',
    cerro: 'Alegre',
    categoria: 'Restobar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Almirante Montt 484',
    descripcion:
      'Café de especialidad, pastelería y cocina contemporánea. Tapa: pez espada grillado con chimichurri o croqueta de hongos (vegetariana). Cóctel: gin de lavanda, copa de vino o mocktail de espresso con jarabe de vino tinto.',
    lat: -33.0424,
    lng: -71.6301,
  },
  {
    id: 'malizioso_pizzeria',
    nombre: 'Malizioso Pizzería',
    instagram: '@malizioso.pizzeria',
    cerro: 'Alegre',
    categoria: 'Pizzería',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Almirante Montt 332',
    descripcion:
      'Pizzas artesanales italianas con ingredientes frescos. Tapa: bruschetta Meze o bruschetta Piamontesca. Cóctel: limoncello con pisco, licor de sauco y maracuyá.',
    lat: -33.0412,
    lng: -71.6308,
  },
  {
    id: 'medialunavalpo',
    nombre: 'Media Luna',
    instagram: '@medialunavalpo',
    cerro: 'Concepción',
    categoria: 'Café & Bar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Abtao 589',
    descripcion:
      'Café y restaurante con brunch, café de especialidad y cocina casera. Tapa: pizza de ricotta al pesto o pizza de crema y hongos (con opciones dulces). Cóctel: vermouth (solo o con soda) o Espresso Martini.',
    lat: -33.0434,
    lng: -71.6292,
  },
  {
    id: 'raizchilena',
    nombre: 'Raíz Chilena',
    instagram: '@raizchilena.cl',
    cerro: 'Concepción',
    categoria: 'Cocina de Autor',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Abtao',
    descripcion:
      'Gastronomía tradicional chilena con preparaciones caseras. Tapa: brocheta marina de pescado, almejas y verduras, o empanada de hongos (vegetariana). Cóctel: Torpeñaca (pisco, piña, naranja, araucano y jarabe de hibiscus).',
    lat: -33.0436,
    lng: -71.6291,
  },
  {
    id: 'terapiavalpo',
    nombre: 'Terapia Valpo',
    instagram: '@terapiavalpo',
    cerro: 'Alegre',
    categoria: 'Bar & Coctelería',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Capilla',
    descripcion:
      'Buena cocina y coctelería de autor en un ambiente relajado. Tapa: focaccia con leche de tigre, atún sellado y rabanito. Cóctel: sangría tropical (vino, pisco, maracuyá y limón).',
    lat: -33.0419,
    lng: -71.6315,
  },
  {
    id: 'piano_cafe',
    nombre: 'Piano Café',
    instagram: '@piano.cafe.valpo',
    cerro: 'Concepción',
    categoria: 'Café & Restobar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Concepción',
    descripcion:
      'Café de especialidad, pastelería artesanal, desayunos y brunch. Tapa: danés de queso crema con mermelada de mango o mini croissant con alcachofa. Cóctel: mocktail con cáscara de café, jarabe de chai y tónica.',
    lat: -33.0433,
    lng: -71.6294,
  },
  {
    id: 'parrilla_doncesar',
    nombre: 'Parrilla Don César',
    instagram: '@parrilla.doncesar',
    cerro: 'Concepción',
    categoria: 'Parrilla & Vinos',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Templeman',
    descripcion:
      'Parrilla al estilo argentino: cortes Angus a las brasas y recetas argentino-chilenas. Tapa: baba ganoush con chorizo y variedad de cortes de vacuno. Cóctel: vino de la casa.',
    lat: -33.0430,
    lng: -71.6288,
  },
  {
    id: 'cafeparaiso',
    nombre: 'Café Paraíso 3.0',
    instagram: '@cafeparaiso3.0',
    cerro: 'Concepción',
    categoria: 'Cafetería & Bar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Gálvez',
    descripcion:
      'Café de especialidad, pastelería artesanal, desayunos y brunch. Tapa: pan de masa madre con pollo teriyaki al pesto o pesto vegano de vegetales. Cóctel: Esmeralda (matcha, vodka, crema de coco) o Sunset Cremoso (espresso, Amaretto).',
    lat: -33.0435,
    lng: -71.6278,
  },
  {
    id: 'cocinapuerto',
    nombre: 'Cocina Puerto',
    instagram: '@cocinapuerto_valpo',
    cerro: 'Alegre',
    categoria: 'Cocina de Mar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Lautaro',
    descripcion:
      'Cocina chilena de autor con pescados y mariscos frescos. Tapa: chapalele frito con curanto porteño (con versión vegetariana). Cóctel: melón con vino (mocktail: sandía con berries).',
    lat: -33.0416,
    lng: -71.6310,
  },
  {
    id: 'mariamaria_valpo',
    nombre: 'María María',
    instagram: '@mariamaria_valpo',
    cerro: 'Concepción',
    categoria: 'Restobar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Beethoven',
    descripcion:
      'Cocina de autor con identidad porteña, pastas y pastelería artesanal. Tapa: polenta grillada con lengua de vacuno o croqueta de alcachofa (vegetariana). Cóctel: Cynar julep (cynar, pomelo, limón, menta).',
    lat: -33.0432,
    lng: -71.6305,
  },
  {
    id: 'aidas_pizzeria',
    nombre: "Aida's Pizzería",
    instagram: '@aidas.pizzeria',
    cerro: 'Alegre',
    categoria: 'Pizzería',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Alvaro Besa',
    descripcion:
      'Pizzas y pastas de inspiración italiana con preparaciones tradicionales. Tapa: pizza a la piedra con chorizo o milanesa napolitana de berenjena (vegetariana). Cóctel: Fernet Bianco con pomelo (mocktail: mango o pomelo).',
    lat: -33.0426,
    lng: -71.6278,
  },
  {
    id: 'barlemutt',
    nombre: 'Bar Lemutt',
    instagram: '@barlemutt',
    cerro: 'Concepción',
    categoria: 'Bar',
    promoText: '1 Tapa + 1 Cóctel x $6.000',
    direccion: 'Urriola',
    descripcion:
      'Bar acogedor y bohemio con cervezas y coctelería de autor. Tapa: profiterol salado con vacuno y queso azul o pastelito de choclo (vegetariano). Cóctel: vermouth de la casa con pomelo y tónica, o tequila con cordial de kiwi.',
    lat: -33.0441,
    lng: -71.6280,
  },
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
