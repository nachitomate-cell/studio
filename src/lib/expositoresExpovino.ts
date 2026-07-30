/**
 * Expositores de Expovino 2026.
 *
 * Generado desde la planilla oficial "Base_Expositores_Expovino.xlsx".
 * 69 expositores: 62 viñas y 7 de gastronomía.
 *
 * OJO CON EL INSTAGRAM: en la planilla la columna viene rotulada como
 * "Perfil Instagram (Sugerido)" — son handles deducidos del nombre, no
 * verificados uno por uno. Por eso la ficha NO enlaza directo a Instagram: un
 * handle equivocado manda al visitante a la cuenta de otra persona. El enlace
 * va a una búsqueda, que siempre da con el expositor correcto.
 *
 * Cuando alguien confirme los perfiles reales, basta cambiar `instagram` por el
 * handle verificado y activar el enlace directo en la ficha.
 */

export type TipoExpositor = "vina" | "gastronomia";

export type Expositor = {
  nombre: string;
  tipo: TipoExpositor;
  /** Handle sugerido, sin @. Sin verificar — ver nota de arriba. */
  instagram: string;
  /** Dirección, correo o teléfono, cuando la planilla lo traía. */
  contacto?: string;
};

export const EXPOSITORES: Expositor[] = [
  { nombre: "VIÑATEROS DE RAÍZ", tipo: "vina", instagram: "vinaterosderaiz" },
  { nombre: "VILLALOBOS WINES", tipo: "vina", instagram: "villaloboswines" },
  { nombre: "VIÑA CANCHA ALEGRE", tipo: "vina", instagram: "vinacanchaalegre" },
  { nombre: "LE COQ WINES", tipo: "vina", instagram: "lecoqwines" },
  { nombre: "VIÑA SAINT EUGENE", tipo: "vina", instagram: "vinasainteugene" },
  { nombre: "WEICHAFE WINES", tipo: "vina", instagram: "weichafewines" },
  { nombre: "VIÑA GARIBALDI", tipo: "vina", instagram: "vinagaribaldi" },
  { nombre: "CLOS DES FOUS", tipo: "vina", instagram: "closdesfous" },
  { nombre: "INSITU WINES", tipo: "vina", instagram: "insituwines" },
  { nombre: "5TA DIMENSIÓN", tipo: "vina", instagram: "5tadimension" },
  { nombre: "ALMAWINES", tipo: "vina", instagram: "almawines" },
  { nombre: "BODEGA AGUADA LA PLATA", tipo: "vina", instagram: "bodegaaguadalaplata" },
  { nombre: "BODEGA MARIANA", tipo: "vina", instagram: "bodegamariana" },
  { nombre: "BODEGA QUIMEY", tipo: "vina", instagram: "bodegaquimey" },
  { nombre: "CASA MESA BOZZOLO", tipo: "vina", instagram: "casamesabozzolo" },
  { nombre: "CEPAS WINE", tipo: "vina", instagram: "cepaswine" },
  { nombre: "COOPERATIVA LONCOMILLA", tipo: "vina", instagram: "cooperativaloncomilla" },
  { nombre: "EMPERADOR", tipo: "vina", instagram: "emperador" },
  { nombre: "EPIFANÍA WINES", tipo: "vina", instagram: "epifaniawines" },
  { nombre: "FARADAY WINES", tipo: "vina", instagram: "faradaywines" },
  { nombre: "LACRE ROJO", tipo: "vina", instagram: "lacrerojo" },
  { nombre: "LATE HARVEST ALTOS DEL VALLE", tipo: "vina", instagram: "lateharvestaltosdelvalle" },
  { nombre: "MANALN WINES", tipo: "vina", instagram: "manalnwines" },
  { nombre: "SANGRÍA DEL LAGO", tipo: "vina", instagram: "sangriadellago" },
  { nombre: "SANGRÍA TORREGÓN", tipo: "vina", instagram: "sangriatorregon" },
  { nombre: "SEGOVIA WINES", tipo: "vina", instagram: "segoviawines" },
  { nombre: "SIETE WINES", tipo: "vina", instagram: "sietewines" },
  { nombre: "SINGULART WINE", tipo: "vina", instagram: "singulartwine" },
  { nombre: "TINTOMARE", tipo: "vina", instagram: "tintomare" },
  { nombre: "VINO ERIZO", tipo: "vina", instagram: "vinoerizo" },
  { nombre: "VINOS DE PATIO", tipo: "vina", instagram: "vinosdepatio" },
  { nombre: "VINOS WAYRA", tipo: "vina", instagram: "vinoswayra" },
  { nombre: "VIÑA ANCORA", tipo: "vina", instagram: "vinaancora" },
  { nombre: "VIÑA CALIBORO AVENTURA", tipo: "vina", instagram: "vinacaliboroaventura" },
  { nombre: "VIÑA CHOAPA", tipo: "vina", instagram: "vinachoapa" },
  { nombre: "VIÑA CASA TOSCANA", tipo: "vina", instagram: "vinacasatoscana" },
  { nombre: "VIÑA CASA VASQUEZ", tipo: "vina", instagram: "vinacasavasquez" },
  { nombre: "VIÑA CHATEAU POTRERO SECO", tipo: "vina", instagram: "vinachateaupotreroseco" },
  { nombre: "VIÑA CORTEZ", tipo: "vina", instagram: "vinacortez" },
  { nombre: "VIÑA DE TORO ALEXANDER", tipo: "vina", instagram: "vinadetoroalexander" },
  { nombre: "VIÑA DOÑA AURORA", tipo: "vina", instagram: "vinadonaaurora" },
  { nombre: "VIÑA EL GUINDO", tipo: "vina", instagram: "vinaelguindo" },
  { nombre: "VIÑA EL QUILLAY", tipo: "vina", instagram: "vinaelquillay" },
  { nombre: "VIÑA GONZÁLEZ BASTÍAS", tipo: "vina", instagram: "vinagonzalezbastias" },
  { nombre: "VIÑA HOPE VALLEY DE COLCHAGUA", tipo: "vina", instagram: "vinahopevalleydecolchagua" },
  { nombre: "VIÑA JORCA", tipo: "vina", instagram: "vinajorca" },
  { nombre: "VIÑA JULIETA", tipo: "vina", instagram: "vinajulieta" },
  { nombre: "VIÑA KURIMAN", tipo: "vina", instagram: "vinakuriman" },
  { nombre: "VIÑA LA MISIÓN DE FRANCISCO", tipo: "vina", instagram: "vinalamisiondefrancisco" },
  { nombre: "VIÑA LIZCAR", tipo: "vina", instagram: "vinalizcar" },
  { nombre: "VIÑA LOS QUISCOS", tipo: "vina", instagram: "vinalosquiscos" },
  { nombre: "VIÑA MENDOZA & CARRIEL", tipo: "vina", instagram: "vinamendozacarriel" },
  { nombre: "VIÑA SAAVEDRA", tipo: "vina", instagram: "vinasaavedra" },
  { nombre: "VIÑA CASA HERNÁNDEZ", tipo: "vina", instagram: "vinacasahernandez" },
  { nombre: "VIÑA SALAMANCA", tipo: "vina", instagram: "vinasalamanca" },
  { nombre: "VIÑA SAN LUIS", tipo: "vina", instagram: "vinasanluis" },
  { nombre: "VIÑA SAN SERAFÍN", tipo: "vina", instagram: "vinasanserafin" },
  { nombre: "VIÑA SANTA ESTER", tipo: "vina", instagram: "vinasantaester" },
  { nombre: "VIÑA TRES PALACIOS", tipo: "vina", instagram: "vinatrespalacios" },
  { nombre: "VIÑA Y BODEGA RONDÓ", tipo: "vina", instagram: "vinayrondo" },
  { nombre: "VIÑA ZAPATA", tipo: "vina", instagram: "vinazapata" },
  { nombre: "VITRIOL WINES", tipo: "vina", instagram: "vitriolwines" },
  { nombre: "CORAZON CONTINTO", tipo: "gastronomia", instagram: "corazoncontinto.cl", contacto: "info@corazoncontinto.cl / +56 9 6837 2258" },
  { nombre: "LOS CHINGANEROS", tipo: "gastronomia", instagram: "loschinganeros" },
  { nombre: "MILAMORES", tipo: "gastronomia", instagram: "milamoresvina", contacto: "2 Norte 162, Viña del Mar" },
  { nombre: "PORTO DIVINO", tipo: "gastronomia", instagram: "portodivino" },
  { nombre: "SUSHI ROLLS", tipo: "gastronomia", instagram: "sushirolls" },
  { nombre: "VERANDA RESTAURANT", tipo: "gastronomia", instagram: "verandarestaurant" },
  { nombre: "CHANCHITO GRILL", tipo: "gastronomia", instagram: "chanchitogrill" },
];

/** Búsqueda web del expositor. Segura ante handles de Instagram equivocados. */
export function urlBusqueda(e: Expositor): string {
  const q = `${e.nombre} ${e.tipo === "vina" ? "viña vino" : "restaurant"} Chile`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
