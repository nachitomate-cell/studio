/**
 * Fotos livianas para los <img> que no usan next/image.
 *
 * POR QUÉ EXISTE: las fotos de los locales viven en Firebase Storage tal como
 * las subió cada uno. Medido el 2026-10-04: 52 fotos de tarjeta suman 43 MB,
 * 9 pesan más de 1 MB (la mayor 7,8 MB), y Storage las sirve con max-age=0.
 * Un thumbnail de 48 px bajaba la foto completa.
 *
 * Esta función pasa la URL por el optimizador de Next (/_next/image), que la
 * redimensiona al ancho real, la convierte a WebP/AVIF y la deja en caché. Así
 * se arregla cualquier <img> cambiando solo su src, sin tocar el diseño.
 */

/**
 * Anchos que acepta /_next/image por defecto (imageSizes + deviceSizes).
 * Pedir un ancho fuera de esta lista devuelve 400.
 */
const ANCHOS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

/** Hosts declarados en images.remotePatterns de next.config.ts. */
const HOSTS_PERMITIDOS = new Set(["firebasestorage.googleapis.com"]);

function anchoPermitido(px: number): number {
  return ANCHOS.find((w) => w >= px) ?? ANCHOS[ANCHOS.length - 1];
}

function optimizable(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    return HOSTS_PERMITIDOS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function urlOptimizada(url: string, ancho: number, calidad: number): string {
  return `/_next/image?url=${encodeURIComponent(url)}&w=${ancho}&q=${calidad}`;
}

/**
 * Devuelve `src` y `srcSet` para un <img> que se muestra a `anchoCss` píxeles.
 * El srcSet ofrece 1x y 2x para que en pantallas retina no se vea borrosa.
 * Si la URL no se puede optimizar (blob:, data:, otro dominio) la deja igual.
 */
export function fotoOptimizada(
  url: string | null | undefined,
  anchoCss: number,
  calidad = 70,
): { src: string; srcSet?: string } {
  if (!url) return { src: "" };
  if (!optimizable(url)) return { src: url };
  const w1 = anchoPermitido(anchoCss);
  const w2 = anchoPermitido(anchoCss * 2);
  return {
    src: urlOptimizada(url, w1, calidad),
    srcSet: w1 === w2
      ? undefined
      : `${urlOptimizada(url, w1, calidad)} 1x, ${urlOptimizada(url, w2, calidad)} 2x`,
  };
}
