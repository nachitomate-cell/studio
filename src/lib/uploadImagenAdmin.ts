import { auth } from "@/lib/firebase";

/**
 * Sube una imagen desde un panel de staff (director/moderador/admin) a través de
 * /api/admin/upload-imagen, que usa el Admin SDK.
 *
 * No usamos uploadBytes() directo en estos casos porque la regla de Storage para
 * `entrepreneur_photos/{otroVendor}` y `publicidad/` verifica el rol con un
 * `firestore.get()` cross-service que falla para varios directores en producción
 * (mismo motivo por el que las boletas se resuelven vía /api/admin/boleta-url).
 * El vendedor subiendo su propia foto sí puede seguir usando uploadBytes().
 *
 * @returns la URL pública de descarga de la imagen ya subida.
 */
export async function uploadImagenAdmin(
  file: File,
  destino: { tipo: "local"; vendorId: string } | { tipo: "publicidad" },
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Debes iniciar sesión para subir imágenes.");

  const idToken = await user.getIdToken();

  const form = new FormData();
  form.append("file", file);
  form.append("destino", destino.tipo);
  if (destino.tipo === "local") form.append("vendorId", destino.vendorId);

  const res = await fetch("/api/admin/upload-imagen", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `No se pudo subir la imagen (HTTP ${res.status}).`);
  }
  return data.url as string;
}
