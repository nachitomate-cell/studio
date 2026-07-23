/**
 * Marketing WhatsApp del Club Patio — tipos, segmentos y candados anti-ban.
 *
 * Doctrina (acordada con SynapTech, 2026-07-20):
 *   · SOLO socios con teléfono y sin opt-out (respuesta STOP/BAJA los excluye
 *     para siempre, automáticamente).
 *   · Tope duro de CAP_DIARIO mensajes por día, ventana horaria 11:00–20:00
 *     (hora Chile), lotes chicos con pausa entre mensajes.
 *   · Mensajes NUNCA idénticos: plantillas con variables ({nombre}, {sellos},
 *     {faltan}) + hasta 3 redacciones rotadas por campaña.
 *   · Español neutro de "tú", sin chilenismos (van a clientes finales).
 *
 * Compartido entre la vista (client) y las rutas API (server) — sin imports
 * de firebase-admin acá.
 */

export const CANDADOS = {
  CAP_DIARIO: 50,          // mensajes máx. por día (todas las campañas sumadas)
  VENTANA_INICIO: 11,      // hora Chile — desde las 11:00
  VENTANA_FIN: 20,         // hasta las 19:59
  LOTE_POR_CICLO: 2,       // envíos por ejecución del cron (cada 5 min)
  PAUSA_MIN_MS: 12_000,    // pausa entre mensajes del mismo lote
  PAUSA_MAX_MS: 22_000,
  MAX_PLANTILLAS: 3,
} as const;

export type SegmentoId = "todos" | "vip" | "cerca_premio" | "sin_sellos" | "excel";

export const SEGMENTOS: { id: SegmentoId; label: string; desc: string }[] = [
  { id: "todos",        label: "Todos los socios",     desc: "Todo socio con teléfono registrado (sin opt-out)." },
  { id: "vip",          label: "VIP (10+ sellos)",     desc: "Los más fieles: premios exclusivos, preventa, sorteos." },
  { id: "cerca_premio", label: "A 1–3 sellos del premio", desc: "Máxima urgencia: les falta poquito para canjear." },
  { id: "sin_sellos",   label: "Sin sellos aún",       desc: "Se registraron pero no han estrenado el club." },
];

/** Origen alternativo: lista propia subida en Excel/CSV (no es un card de SEGMENTOS). */
export const SEGMENTO_EXCEL = { id: "excel" as const, label: "Lista Excel", desc: "Contactos subidos desde un archivo Excel o CSV." };
export const MAX_LISTA_EXCEL = 2000;   // filas máx. por campaña (sanidad del request)

export function segmentoLabel(id: string): string {
  if (id === SEGMENTO_EXCEL.id) return SEGMENTO_EXCEL.label;
  return SEGMENTOS.find(s => s.id === id)?.label || id;
}

/** Sellos que faltan para completar el ciclo de 10 (0 sellos → faltan 10). */
export function sellosFaltantes(sellos: number): number {
  const resto = (Number(sellos) || 0) % 10;
  return resto === 0 ? 10 : 10 - resto;
}

/** ¿El socio cae en el segmento? (sellos = acumulados totales, ciclo de 10) */
export function enSegmento(segmento: SegmentoId, sellos: number): boolean {
  const s = Number(sellos) || 0;
  const faltan = sellosFaltantes(s);
  switch (segmento) {
    case "todos":        return true;
    case "vip":          return s >= 10;
    case "cerca_premio": return s > 0 && faltan >= 1 && faltan <= 3;
    case "sin_sellos":   return s === 0;
    case "excel":        return false; // la audiencia excel no se calcula por sellos
  }
}

/** Normaliza un teléfono chileno a formato Evolution (56 9 XXXXXXXX). */
export function normalizarTelefono(raw: string | null | undefined): string | null {
  let n = String(raw || "").replace(/\D/g, "");
  if (!n) return null;
  if (n.length === 11 && n.startsWith("569")) return n;
  if (n.length === 9 && n.startsWith("9")) return "56" + n;
  if (n.length === 8) return "569" + n;
  if (n.startsWith("56") && n.length >= 10) return n;
  return null; // formato irreconocible → fuera de la audiencia (mejor no adivinar)
}

export interface DatosSocio {
  nombre: string;
  sellos: number;
}

/** Renderiza una plantilla con las variables del socio.
 *  Tolerante a cómo las escriba el moderador: {nombre}/{Nombre}/{NOMBRE},
 *  [nombre], con o sin espacios internos — caso real 2026-07-22: una campaña
 *  salió con "{Nombre}" literal porque el reemplazo era case-sensitive. */
export function renderPlantilla(plantilla: string, socio: DatosSocio): string {
  const s = Number(socio.sellos) || 0;
  const primerNombre = String(socio.nombre || "").trim().split(/\s+/)[0] || "socio";
  const reemplazar = (texto: string, variable: string, valor: string) =>
    texto.replace(new RegExp(`[{\\[]\\s*${variable}\\s*[}\\]]`, "gi"), valor);
  let out = plantilla;
  out = reemplazar(out, "nombre", primerNombre);
  out = reemplazar(out, "sellos", String(s));
  out = reemplazar(out, "faltan", String(sellosFaltantes(s)));
  return out;
}

/** Pie obligatorio de todo mensaje de marketing: la salida siempre visible. */
export const PIE_OPT_OUT = "\n\n_Si no quieres recibir estos mensajes, responde STOP._";

/** Detección de opt-out en la respuesta del socio. */
export function esOptOut(texto: string): boolean {
  return /\b(stop|baja|no\s+molestar|no\s+m[aá]s\s+mensajes|salir|unsubscribe)\b/i.test(String(texto || ""));
}

export interface CampanaResumen {
  id: string;
  nombre: string;
  segmento: SegmentoId;
  estado: "activa" | "pausada" | "completada";
  total: number;
  enviados: number;
  fallidos: number;
  optouts: number;
  creadaEn?: string;
}
