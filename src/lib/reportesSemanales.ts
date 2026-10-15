/**
 * Reportes semanales del Club para la administración del Patio.
 *
 * Cada semana se archiva el PDF del reporte y, si corresponde, la planilla de
 * socios de esa semana. Los archivos viven en Storage bajo `reportes_semanales/`,
 * que NO tiene regla propia: cae en el deny-all final de storage.rules. Es
 * deliberado — la planilla trae nombre, correo y teléfono de cada socio. Solo se
 * abren con una signed URL de minutos que emite /api/admin/reportes/url después
 * de validar al usuario con canAccessModPanel.
 *
 * La colección `reportes_semanales` tampoco tiene match en firestore.rules (el
 * cliente no la puede leer): el listado se pide a /api/admin/reportes, que la lee
 * con el Admin SDK. Los publica scripts/publicar-reporte-semanal.mjs.
 *
 * Este módulo lo importa la página del cliente: no puede traer nada de servidor.
 */

export const REPORTES_COLLECTION = "reportes_semanales";
export const REPORTES_STORAGE_PREFIX = "reportes_semanales/";

export type TipoArchivoReporte = "pdf" | "xlsx";

export interface ArchivoReporte {
  tipo: TipoArchivoReporte;
  nombre: string;
  path: string;
  tamanoBytes: number;
}

export interface ReporteSemanal {
  /** `${desde}_${hasta}` */
  id: string;
  titulo: string;
  /** AAAA-MM-DD */
  desde: string;
  /** AAAA-MM-DD */
  hasta: string;
  archivos: ArchivoReporte[];
  /** ISO 8601. */
  creadoEn: string;
  subidoPor: string;
}

/** Lo que devuelve /api/admin/reportes: sin rutas de Storage, no le sirven al cliente. */
export type ReporteSemanalPublico = Omit<ReporteSemanal, "archivos"> & {
  archivos: Omit<ArchivoReporte, "path">[];
};

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/;

export function esFechaValida(fecha: string): boolean {
  if (!FECHA_RE.test(fecha)) return false;
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

export function esIdReporteValido(id: string): boolean {
  return ID_RE.test(id);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * "5 al 11 de octubre de 2026", "28 de septiembre al 4 de octubre de 2026".
 * Se arma a mano desde el texto AAAA-MM-DD: pasar por `new Date()` corre el día
 * según la zona horaria del navegador.
 */
export function formatearRangoReporte(desde: string, hasta: string): string {
  if (!esFechaValida(desde) || !esFechaValida(hasta)) return `${desde} – ${hasta}`;
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  const fin = `${d2} de ${MESES[m2 - 1]} de ${a2}`;
  if (a1 !== a2) return `${d1} de ${MESES[m1 - 1]} de ${a1} al ${fin}`;
  if (m1 !== m2) return `${d1} de ${MESES[m1 - 1]} al ${fin}`;
  return `${d1} al ${fin}`;
}

export function etiquetaArchivo(tipo: TipoArchivoReporte): string {
  return tipo === "pdf" ? "Reporte (PDF)" : "Planilla (Excel)";
}

/** Fecha de hoy en Chile como DD-MM-AAAA, para el nombre de la planilla. */
export function fechaChileDDMMAAAA(fecha: Date = new Date()): string {
  // en-CA da AAAA-MM-DD; se reordena para no depender del formato de es-CL.
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
  const [a, m, d] = iso.split("-");
  return `${d}-${m}-${a}`;
}

export function nombreArchivoPlanilla(fecha: Date = new Date()): string {
  return `Base socios Club Patio - ${fechaChileDDMMAAAA(fecha)}.xlsx`;
}

export function formatearPesoReporte(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Content-Disposition de descarga con el nombre original. `filename` lleva una
 * versión ASCII (navegadores viejos) y `filename*` el nombre real con tildes.
 */
export function contentDispositionAdjunto(nombre: string): string {
  const ascii = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  // RFC 5987 tampoco admite ' ( ) * sin codificar, y encodeURIComponent los deja pasar.
  const utf8 = encodeURIComponent(nombre).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
