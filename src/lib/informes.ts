/**
 * Informes semanales por comercio.
 *
 * El PDF vive en Storage bajo `informes/`, que NO tiene regla propia: cae en el
 * deny-all final de storage.rules. Es deliberado — un informe trae las ventas de
 * un local y no puede quedar en una URL adivinable ni compartible. La única forma
 * de abrirlo es /api/informes/url, que valida quién pregunta y devuelve una
 * signed URL de minutos. Por eso tampoco se guarda `firebaseStorageDownloadTokens`
 * al subirlo, a diferencia de los logos y afiches.
 */

export const INFORMES_COLLECTION = "informes";

/** Un informe generado es texto, no fotos: 20 MB sobra y acota el abuso. */
export const MAX_INFORME_BYTES = 20 * 1024 * 1024;

export type AlcanceInforme = "general" | "comercio";

export interface Informe {
  id: string;
  titulo: string;
  alcance: AlcanceInforme;
  /** null cuando el alcance es "general". */
  vendorId: string | null;
  vendorNombre: string | null;
  archivoPath: string;
  nombreArchivo: string;
  tamanoBytes: number;
  /** ISO 8601. */
  creadoEn: string;
  subidoPor: string;
}

export function formatearPeso(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatearFechaInforme(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
