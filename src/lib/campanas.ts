/**
 * Registro de campañas de evento.
 *
 * Cada entrada define cómo se comporta el registro cuando alguien llega desde
 * el QR de ese evento: qué marca queda en su cuenta, cómo se ve el formulario
 * y a qué pantalla se le manda después de inscribirse.
 *
 * Para el próximo evento basta agregar una entrada acá — no hay que tocar el
 * formulario, ni el badge, ni el panel de sorteos.
 *
 * El slug es el valor de `?evento=` en la URL del QR y el que queda guardado
 * en `usuarios.campanaRegistro`.
 */

export type Campana = {
  slug: string;
  /** Nombre del evento tal como se muestra al público. */
  nombre: string;
  /** Texto del distintivo que lleva el socio en su perfil. */
  etiqueta: string;
  emoji: string;
  /** A dónde se le manda al terminar el registro. */
  destino: string;
  /** Frase corta bajo el título del formulario. */
  gancho: string;
  colorPrimario: string;
  colorTexto: string;
};

export const CAMPANAS: Record<string, Campana> = {
  expovino: {
    slug: "expovino",
    nombre: "Expovino",
    etiqueta: "Socio desde Expovino",
    emoji: "🍷",
    destino: "/expovino",
    gancho: "Inscríbete y participa por el premio que sorteamos al final de la noche.",
    colorPrimario: "#7B1E3A",
    colorTexto: "#F3D9E1",
  },
};

export function campanaPorSlug(slug: string | null | undefined): Campana | null {
  if (!slug) return null;
  return CAMPANAS[slug.trim().toLowerCase()] ?? null;
}
