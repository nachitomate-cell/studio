/**
 * Modelo de segmentación conductual — Club Patio Curauma
 * ──────────────────────────────────────────────────────────────────────────
 * Clasifica a cada cliente en uno de 5 perfiles conductuales propietarios a
 * partir de tres dimensiones medibles que el sistema ya registra por cada
 * interacción de fidelización:
 *
 *   • Frecuencia  → número de visitas/sellos acumulados con el comercio
 *   • Valor       → gasto acumulado y ticket promedio por visita
 *   • Recencia    → días transcurridos desde la última visita
 *
 * Este es el núcleo del I+D del proyecto (segmentación incorporada en la
 * Versión 2.0): un modelo de datos conductual que ningún sistema estándar de
 * fidelización por sellos ofrece de forma nativa.
 */

export type PerfilConductual =
  | "VIP"
  | "Fidelizado"
  | "Alto Valor"
  | "En Desarrollo"
  | "Potencial";

export interface ClienteConductual {
  /** Total de visitas/sellos del cliente con este comercio. */
  visitas: number;
  /** Gasto acumulado (CLP). Puede ser 0 si el comercio no registra montos. */
  gasto: number;
  /** Última visita en formato ISO ("YYYY-MM-DD" o "YYYY-MM-DDTHH:mm..."). */
  ultimaVisita: string;
}

export interface ConfigPerfiles {
  /** Visitas mínimas para considerarse VIP. */
  visitasVIP: number;
  /** Días desde la última visita para considerarse "activo". */
  diasActivo: number;
  /** Visitas mínimas para considerarse Fidelizado. */
  visitasFidelizado: number;
  /** Días máximos desde la última visita para Fidelizado. */
  diasFidelizado: number;
  /** Gasto acumulado (CLP) que marca a un cliente como Alto Valor. */
  gastoAltoValor: number;
  /** Ticket promedio (CLP) que marca a un cliente como Alto Valor. */
  ticketAltoValor: number;
}

/**
 * Umbrales por defecto. Calibrados para un programa de sellos de retail/gastronomía
 * chileno. Se pueden sobrescribir por comercio o por contexto del ecosistema.
 */
export const CONFIG_PERFILES_DEFAULT: ConfigPerfiles = {
  visitasVIP: 5,
  diasActivo: 30,
  visitasFidelizado: 3,
  diasFidelizado: 45,
  gastoAltoValor: 50000,
  ticketAltoValor: 25000,
};

export interface PerfilMeta {
  label: PerfilConductual;
  emoji: string;
  /** Clases Tailwind para badge (texto + fondo + borde). */
  badgeClass: string;
  /** Color hex para gráficos. */
  color: string;
  /** Descripción operativa del perfil. */
  descripcion: string;
  /** Acción de marketing recomendada. */
  accion: string;
}

export const PERFILES_META: Record<PerfilConductual, PerfilMeta> = {
  VIP: {
    label: "VIP",
    emoji: "👑",
    badgeClass: "text-amber-700 bg-amber-50 border-amber-200",
    color: "#C9920A",
    descripcion: "Cliente de élite: alta frecuencia y actividad reciente. El núcleo más valioso del comercio.",
    accion: "Reconocimiento exclusivo, beneficios anticipados y trato preferente.",
  },
  "Alto Valor": {
    label: "Alto Valor",
    emoji: "💎",
    badgeClass: "text-violet-700 bg-violet-50 border-violet-200",
    color: "#7C3AED",
    descripcion: "Gasta por sobre el promedio aunque no sea el más frecuente. Alto ticket por visita.",
    accion: "Cross-sell de productos premium y experiencias de mayor valor.",
  },
  Fidelizado: {
    label: "Fidelizado",
    emoji: "🤝",
    badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    color: "#059669",
    descripcion: "Cliente recurrente y activo. Ya consolidó el hábito de volver.",
    accion: "Mantener el vínculo con recompensas por constancia y referidos.",
  },
  "En Desarrollo": {
    label: "En Desarrollo",
    emoji: "🌱",
    badgeClass: "text-sky-700 bg-sky-50 border-sky-200",
    color: "#0284C7",
    descripcion: "Comenzó a construir hábito (2–3 visitas). En proceso de fidelización.",
    accion: "Incentivos por la próxima visita para consolidar la recurrencia.",
  },
  Potencial: {
    label: "Potencial",
    emoji: "✨",
    badgeClass: "text-slate-600 bg-slate-50 border-slate-200",
    color: "#64748B",
    descripcion: "Cliente nuevo (primera visita) o por reactivar. Potencial de conversión sin explotar.",
    accion: "Bienvenida personalizada y primer incentivo para gatillar el regreso.",
  },
};

/** Orden canónico de presentación (de mayor a menor valor estratégico). */
export const ORDEN_PERFILES: PerfilConductual[] = [
  "VIP",
  "Alto Valor",
  "Fidelizado",
  "En Desarrollo",
  "Potencial",
];

function diasDesde(iso: string): number {
  if (!iso) return Infinity;
  const base = iso.length === 10 ? iso + "T12:00" : iso;
  const t = new Date(base).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86_400_000);
}

/**
 * Clasifica a un cliente en uno de los 5 perfiles conductuales.
 *
 * La cascada de prioridad garantiza que cada cliente reciba exactamente un
 * perfil, asignando primero los segmentos de mayor valor estratégico:
 *   VIP → Alto Valor → Fidelizado → En Desarrollo → Potencial
 */
export function clasificarPerfil(
  cliente: ClienteConductual,
  config: ConfigPerfiles = CONFIG_PERFILES_DEFAULT
): PerfilConductual {
  const { visitas, gasto } = cliente;
  const recencia = diasDesde(cliente.ultimaVisita);
  const ticket = visitas > 0 ? gasto / visitas : 0;
  const esAltoValor = gasto >= config.gastoAltoValor || ticket >= config.ticketAltoValor;

  // VIP: élite por frecuencia + actividad reciente.
  if (visitas >= config.visitasVIP && recencia <= config.diasActivo) return "VIP";

  // Alto Valor: gasta por sobre el promedio aunque su frecuencia no sea VIP.
  if (esAltoValor && visitas >= 2) return "Alto Valor";

  // Fidelizado: recurrente y aún activo.
  if (visitas >= config.visitasFidelizado && recencia <= config.diasFidelizado) return "Fidelizado";

  // En Desarrollo: 2+ visitas, construyendo hábito.
  if (visitas >= 2) return "En Desarrollo";

  // Potencial: nuevos (1 visita) o por reactivar.
  return "Potencial";
}

export interface SegmentoConteo {
  perfil: PerfilConductual;
  meta: PerfilMeta;
  cantidad: number;
  porcentaje: number;
}

/**
 * Calcula la distribución de una cartera de clientes entre los 5 perfiles.
 * Devuelve los segmentos en orden canónico, con conteo y porcentaje.
 */
export function calcularSegmentacion(
  clientes: ClienteConductual[],
  config: ConfigPerfiles = CONFIG_PERFILES_DEFAULT
): SegmentoConteo[] {
  const conteo: Record<PerfilConductual, number> = {
    VIP: 0,
    "Alto Valor": 0,
    Fidelizado: 0,
    "En Desarrollo": 0,
    Potencial: 0,
  };

  for (const c of clientes) {
    conteo[clasificarPerfil(c, config)]++;
  }

  const total = clientes.length || 1;

  return ORDEN_PERFILES.map((perfil) => ({
    perfil,
    meta: PERFILES_META[perfil],
    cantidad: conteo[perfil],
    porcentaje: Math.round((conteo[perfil] / total) * 100),
  }));
}
