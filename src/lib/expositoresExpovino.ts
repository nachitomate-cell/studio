/**
 * Expositores confirmados de Expovino Invierno 2026.
 *
 * Fuente: listado oficial de confirmados entregado por la organización.
 * 104 expositores en 9 categorías.
 *
 * OJO CON EL INSTAGRAM: los handles vienen de la planilla previa, donde la
 * columna estaba rotulada "Perfil Instagram (Sugerido)" — deducidos del nombre,
 * sin verificar uno por uno. Por eso la ficha NO enlaza directo a Instagram: un
 * handle equivocado manda al visitante a la cuenta de otra persona. El enlace va
 * a una búsqueda, que siempre da con el expositor correcto.
 */

export type TipoExpositor =
  | "cafeteria"
  | "cerveceria"
  | "destilados"
  | "restaurante"
  | "tienda"
  | "tienda_dulce"
  | "tienda_gourmet"
  | "vina"
  | "artesania";

export const ETIQUETA_TIPO: Record<TipoExpositor, string> = {
  cafeteria: "Cafeterías",
  cerveceria: "Cervecerías",
  destilados: "Destilados",
  restaurante: "Restaurantes",
  tienda: "Tiendas",
  tienda_dulce: "Dulces",
  tienda_gourmet: "Gourmet",
  vina: "Viñas",
  artesania: "Artesanía",
};

export type Expositor = {
  nombre: string;
  tipo: TipoExpositor;
  /** Handle sugerido, sin @. Sin verificar — ver nota de arriba. */
  instagram: string;
  /** Dirección, correo o teléfono, cuando se conoce. */
  contacto?: string;
};

export const EXPOSITORES: Expositor[] = [
  { nombre: "EMPORIO TENTACIÓN", tipo: "cafeteria", instagram: "" },
  { nombre: "LA SEPTIMA", tipo: "cafeteria", instagram: "" },
  { nombre: "CERVEZA BIRRA ALEGRE", tipo: "cerveceria", instagram: "" },
  { nombre: "CERVEZA RIO SUR", tipo: "cerveceria", instagram: "" },
  { nombre: "CERVEZA SIBAROS", tipo: "cerveceria", instagram: "" },
  { nombre: "CODA", tipo: "cerveceria", instagram: "" },
  { nombre: "BAR EXPOVINO", tipo: "destilados", instagram: "" },
  { nombre: "CURAUMASABOR", tipo: "destilados", instagram: "" },
  { nombre: "DESTILADOS CASABLANCA", tipo: "destilados", instagram: "" },
  { nombre: "GIN BASTARDO", tipo: "destilados", instagram: "" },
  { nombre: "LA COCTELERA", tipo: "destilados", instagram: "" },
  { nombre: "NIRBAR.CL", tipo: "destilados", instagram: "" },
  { nombre: "PISCO LUMBRERA", tipo: "destilados", instagram: "" },
  { nombre: "PISCO TRASHUMANTE", tipo: "destilados", instagram: "" },
  { nombre: "REMOLCADOR GIN", tipo: "destilados", instagram: "" },
  { nombre: "CHANCHITO GRILL", tipo: "restaurante", instagram: "chanchitogrill" },
  { nombre: "CORAZON CONTINTO COCINA", tipo: "restaurante", instagram: "corazoncontinto.cl", contacto: "info@corazoncontinto.cl / +56 9 6837 2258" },
  { nombre: "LOS CHINGANEROS", tipo: "restaurante", instagram: "loschinganeros" },
  { nombre: "MILAMORES", tipo: "restaurante", instagram: "milamoresvina", contacto: "2 Norte 162, Viña del Mar" },
  { nombre: "PORTO DIVINO", tipo: "restaurante", instagram: "portodivino" },
  { nombre: "SUSHI ROLLS", tipo: "restaurante", instagram: "sushirolls" },
  { nombre: "VERANDA RESTAURANT", tipo: "restaurante", instagram: "verandarestaurant" },
  { nombre: "ANTUGUSTOS", tipo: "tienda", instagram: "" },
  { nombre: "BARRICAS CASABLANCA", tipo: "tienda", instagram: "" },
  { nombre: "CALZADOS PIEL CANELA", tipo: "tienda", instagram: "" },
  { nombre: "CULTURA VINILO", tipo: "tienda", instagram: "" },
  { nombre: "TÉ CON T", tipo: "tienda", instagram: "" },
  { nombre: "CORAZON DE AZUQUITA", tipo: "tienda_dulce", instagram: "" },
  { nombre: "CAMPOS BBQ", tipo: "tienda_gourmet", instagram: "" },
  { nombre: "CHARCU LAB", tipo: "tienda_gourmet", instagram: "" },
  { nombre: "EL MAQUI EMPORIO", tipo: "tienda_gourmet", instagram: "" },
  { nombre: "GUSTOSO GOURMET", tipo: "tienda_gourmet", instagram: "" },
  { nombre: "LA QUESERIA", tipo: "tienda_gourmet", instagram: "" },
  { nombre: "LAS DELICIAS DEL SUR", tipo: "tienda_gourmet", instagram: "" },
  { nombre: "STEFYMAR®️ Premium Seafood", tipo: "tienda_gourmet", instagram: "" },
  { nombre: "5TA DIMENSIÓN", tipo: "vina", instagram: "5tadimension" },
  { nombre: "ALMAWINES", tipo: "vina", instagram: "almawines" },
  { nombre: "ANDES VINEYARDS", tipo: "vina", instagram: "" },
  { nombre: "BODEGA AGUADA LA PLATA", tipo: "vina", instagram: "bodegaaguadalaplata" },
  { nombre: "BODEGA QUIMEY", tipo: "vina", instagram: "bodegaquimey" },
  { nombre: "CASA MESA BOZZOLO", tipo: "vina", instagram: "casamesabozzolo" },
  { nombre: "CAVAS BOUTIQUE MAULE", tipo: "vina", instagram: "" },
  { nombre: "CLOS DES FOUS", tipo: "vina", instagram: "closdesfous" },
  { nombre: "CLUB EL MUNDO DEL VINO", tipo: "vina", instagram: "" },
  { nombre: "COOPERATIVA LONCOMILLA", tipo: "vina", instagram: "cooperativaloncomilla" },
  { nombre: "EMPERADOR", tipo: "vina", instagram: "emperador" },
  { nombre: "EPIFANÍA WINES", tipo: "vina", instagram: "epifaniawines" },
  { nombre: "FARADAY WINES", tipo: "vina", instagram: "faradaywines" },
  { nombre: "INSITU WINES", tipo: "vina", instagram: "insituwines" },
  { nombre: "LACRE ROJO", tipo: "vina", instagram: "lacrerojo" },
  { nombre: "LATE HARVEST ALTOS DEL VALLE", tipo: "vina", instagram: "lateharvestaltosdelvalle" },
  { nombre: "LE COQ WINES", tipo: "vina", instagram: "lecoqwines" },
  { nombre: "MANALN WINES", tipo: "vina", instagram: "manalnwines" },
  { nombre: "SANGRÍA DEL LAGO", tipo: "vina", instagram: "sangriadellago" },
  { nombre: "SANGRÍA TORREGÓN", tipo: "vina", instagram: "sangriatorregon" },
  { nombre: "SEGOVIA WINES", tipo: "vina", instagram: "segoviawines" },
  { nombre: "SIETE WINES", tipo: "vina", instagram: "sietewines" },
  { nombre: "SINGULART WINE", tipo: "vina", instagram: "singulartwine" },
  { nombre: "TINTOMARE", tipo: "vina", instagram: "tintomare" },
  { nombre: "TOKEN", tipo: "vina", instagram: "" },
  { nombre: "VILLALOBOS WINES", tipo: "vina", instagram: "villaloboswines" },
  { nombre: "VINO ERIZO", tipo: "vina", instagram: "vinoerizo" },
  { nombre: "VINOS ARGENTINOS VINOTEKA", tipo: "vina", instagram: "" },
  { nombre: "VINOS DE PATIO", tipo: "vina", instagram: "vinosdepatio" },
  { nombre: "VINOS WAYRA", tipo: "vina", instagram: "vinoswayra" },
  { nombre: "VIÑA ANCORA", tipo: "vina", instagram: "vinaancora" },
  { nombre: "VIÑA CALIBORO AVENTURA", tipo: "vina", instagram: "vinacaliboroaventura" },
  { nombre: "VIÑA CANCHA ALEGRE", tipo: "vina", instagram: "vinacanchaalegre" },
  { nombre: "VIÑA CASA TOSCANA", tipo: "vina", instagram: "vinacasatoscana" },
  { nombre: "VIÑA CASA VASQUEZ", tipo: "vina", instagram: "vinacasavasquez" },
  { nombre: "VIÑA CHATEAU POTRERO SECO", tipo: "vina", instagram: "vinachateaupotreroseco" },
  { nombre: "VIÑA CHOAPA", tipo: "vina", instagram: "vinachoapa" },
  { nombre: "VIÑA CORTEZ", tipo: "vina", instagram: "vinacortez" },
  { nombre: "VIÑA DE TORO ALEXANDER", tipo: "vina", instagram: "vinadetoroalexander" },
  { nombre: "VIÑA DOÑA AURORA", tipo: "vina", instagram: "vinadonaaurora" },
  { nombre: "VIÑA DOÑA BLANCA", tipo: "vina", instagram: "" },
  { nombre: "VIÑA EL GUINDO", tipo: "vina", instagram: "vinaelguindo" },
  { nombre: "VIÑA EL QUILLAY", tipo: "vina", instagram: "vinaelquillay" },
  { nombre: "VIÑA GARIBALDI", tipo: "vina", instagram: "vinagaribaldi" },
  { nombre: "VIÑA HOPE VALLEY DE COLCHAGUA", tipo: "vina", instagram: "vinahopevalleydecolchagua" },
  { nombre: "VIÑA JORCA", tipo: "vina", instagram: "vinajorca" },
  { nombre: "VIÑA JULIETA", tipo: "vina", instagram: "vinajulieta" },
  { nombre: "VIÑA KURIMAN", tipo: "vina", instagram: "vinakuriman" },
  { nombre: "VIÑA LA MISIÓN DE FRANCISCO", tipo: "vina", instagram: "vinalamisiondefrancisco" },
  { nombre: "VIÑA LIZCAR", tipo: "vina", instagram: "vinalizcar" },
  { nombre: "VIÑA LOS QUISCOS", tipo: "vina", instagram: "vinalosquiscos" },
  { nombre: "VIÑA MENDOZA & CARRIEL", tipo: "vina", instagram: "vinamendozacarriel" },
  { nombre: "VIÑA SAAVEDRA", tipo: "vina", instagram: "vinasaavedra" },
  { nombre: "VIÑA SAINT EUGENE", tipo: "vina", instagram: "vinasainteugene" },
  { nombre: "VIÑA SALAMANCA", tipo: "vina", instagram: "vinasalamanca" },
  { nombre: "VIÑA SAN LUIS", tipo: "vina", instagram: "vinasanluis" },
  { nombre: "VIÑA SAN SERAFÍN", tipo: "vina", instagram: "vinasanserafin" },
  { nombre: "VIÑA SANTA ESTER", tipo: "vina", instagram: "vinasantaester" },
  { nombre: "VIÑA SELENTIA", tipo: "vina", instagram: "" },
  { nombre: "VIÑA Y BODEGA RONDÓ", tipo: "vina", instagram: "vinayrondo" },
  { nombre: "VIÑA ZAPATA", tipo: "vina", instagram: "vinazapata" },
  { nombre: "VIÑATEROS DE RAÍZ", tipo: "vina", instagram: "vinaterosderaiz" },
  { nombre: "WEICHAFE WINES", tipo: "vina", instagram: "weichafewines" },
  { nombre: "Mermeladas Gourmet", tipo: "artesania", instagram: "" },
  { nombre: "Cerámica Grez", tipo: "artesania", instagram: "" },
  { nombre: "Artesanía con Barricas", tipo: "artesania", instagram: "" },
  { nombre: "Cajas de madera para vino", tipo: "artesania", instagram: "" },
  { nombre: "Fieltro", tipo: "artesania", instagram: "" },
  { nombre: "Miel", tipo: "artesania", instagram: "" },
];

/**
 * Expositores que además son locales activos del Club Patio.
 *
 * Se resolvió cruzando el listado oficial contra `entrepreneur_profiles`. No
 * viene del listado del evento, por eso va aparte: si se regenera la lista de
 * expositores, esta constante sobrevive.
 */
export const EXPOSITORES_DEL_CLUB = new Set(["NIRBAR.CL", "ANDES VINEYARDS"]);

export function esLocalDelClub(e: Expositor): boolean {
  return EXPOSITORES_DEL_CLUB.has(e.nombre.toUpperCase());
}

/** Búsqueda web del expositor. Segura ante handles de Instagram equivocados. */
export function urlBusqueda(e: Expositor): string {
  const contexto = e.tipo === "vina" ? "viña vino"
    : e.tipo === "restaurante" ? "restaurant"
    : e.tipo === "destilados" ? "destilería gin pisco"
    : e.tipo === "cerveceria" ? "cerveza artesanal"
    : "";
  return `https://www.google.com/search?q=${encodeURIComponent(`${e.nombre} ${contexto} Chile`.trim())}`;
}
