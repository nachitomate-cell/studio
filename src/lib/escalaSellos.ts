/**
 * Flag de la escala monto → sellos (src/lib/sellos.ts), configurable desde
 * /moderador (doc configuracion/general.escalaMontoSellos).
 * Con la escala desactivada, toda compra entrega 1 sello fijo sin importar el monto.
 * Solo server-side (Admin SDK).
 */
import { adminDb } from "./firebaseAdmin";

export async function getEscalaMontoActiva(): Promise<boolean> {
  try {
    const snap = await adminDb.collection("configuracion").doc("general").get();
    const cfg = snap.exists ? (snap.data()?.escalaMontoSellos as { activo?: boolean } | undefined) : undefined;
    return cfg?.activo !== false;
  } catch (e) {
    console.warn("[escalaSellos] No se pudo leer configuración, se asume escala activa:", e);
    return true;
  }
}
