/**
 * Achica una foto en el teléfono antes de subirla.
 *
 * POR QUÉ EXISTE: las fotos se subían tal como salían de la cámara. Medido el
 * 2026-10-04: 52 fotos de locales sumaban 43 MB en Storage, 9 de más de 1 MB
 * (la mayor 7,8 MB). Eso es tiempo de subida en la red móvil del local,
 * espacio en Storage, y fotos que pasan los 15 MB de storage.rules y se caen.
 * Ninguna pantalla muestra una foto a más de ~540 px de ancho, así que 1600 px
 * por lado sobra incluso en pantallas retina.
 *
 * Nunca bloquea una subida: si algo falla al comprimir (formato raro, navegador
 * viejo, memoria), devuelve el archivo original y la subida sigue como antes.
 */

"use client";

type Opciones = {
  /** Largo máximo del lado mayor, en píxeles. */
  maxLado?: number;
  /** Calidad JPEG entre 0 y 1. */
  calidad?: number;
};

function cargar(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    // Un <img> ya respeta la orientación EXIF: la foto vertical del celular
    // no queda acostada al dibujarla en el canvas.
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

/** ¿Algún pixel es transparente? Un logo PNG con fondo transparente no puede pasar a JPEG (quedaría negro). */
function tieneTransparencia(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const datos = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < datos.length; i += 4) {
    if (datos[i] < 255) return true;
  }
  return false;
}

export async function comprimirImagen<T extends Blob>(
  file: T,
  { maxLado = 1600, calidad = 0.82 }: Opciones = {},
): Promise<T | File> {
  // GIF (animado) y SVG (vectorial) se pierden al pasar por canvas.
  if (!file.type.startsWith("image/") && file.type !== "") return file;
  if (/gif|svg/.test(file.type)) return file;

  try {
    const img = await cargar(file);
    const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    if (!w || !h) return file;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const transparente = /png|webp/.test(file.type) && tieneTransparencia(ctx, w, h);
    const tipo = transparente ? "image/png" : "image/jpeg";
    const blob = await aBlob(canvas, tipo, calidad);

    // Si no hubo que achicar y la versión nueva pesa más, el original ya estaba bien.
    if (!blob || blob.size >= file.size) return file;

    const nombreBase = (file instanceof File ? file.name : "foto").replace(/\.[^.]+$/, "");
    return new File([blob], `${nombreBase}.${transparente ? "png" : "jpg"}`, { type: tipo });
  } catch {
    return file;
  }
}
