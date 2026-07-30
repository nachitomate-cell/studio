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
  /** Título del pedido de notificaciones, en contexto del evento. */
  avisoTitulo: string;
  /** Explicación de qué se pierde si no las activa. */
  avisoTexto: string;
  colorPrimario: string;
  colorTexto: string;
  /**
   * Tenant de Wallo que emite el pase de esta campaña.
   *
   * Va por campaña y no global porque el pase lleva la marca del evento: sin
   * esto, alguien inscrito en Ruta BAC recibiría una tarjeta que dice Expovino.
   * Sin tenant no se ofrece pase, que es preferible a ofrecer el equivocado.
   */
  walloTenant?: string;
};

export const CAMPANAS: Record<string, Campana> = {
  expovino: {
    slug: "expovino",
    nombre: "Expovino",
    etiqueta: "Socio desde Expovino",
    emoji: "🍷",
    destino: "/expovino",
    gancho: "Inscríbete y participa por el premio que sorteamos al final de la noche.",
    avisoTitulo: "El sorteo es esta noche 🍷",
    avisoTexto:
      "Si sales ganador, te avisamos al instante en tu teléfono. Si no activas " +
      "los avisos, tendrías que ir revisando la app para enterarte.",
    colorPrimario: "#7B1E3A",
    colorTexto: "#F3D9E1",
    walloTenant: "clubpatio",
  },

  rutabac: {
    slug: "rutabac",
    nombre: "Ruta BAC",
    etiqueta: "Socio desde Ruta BAC",
    emoji: "🍸",
    destino: "/ruta-bac",
    gancho: "Inscríbete y empieza a juntar sellos en los 26 locales de la ruta.",
    avisoTitulo: "No te pierdas tus canjes 🍸",
    avisoTexto:
      "Te avisamos apenas tengas un premio listo para canjear en la ruta. " +
      "Sin los avisos, solo te enteras si entras a la app.",
    // Paleta de /ruta-bac: azul noche con magenta y crema.
    colorPrimario: "#FF4B91",
    colorTexto: "#FDF1D6",
    // Sin tenant de Wallo todavía: la ruta no tiene tarjeta propia emitida, y
    // es mejor no ofrecer pase que entregar uno con la marca de otro evento.
  },
};

export function campanaPorSlug(slug: string | null | undefined): Campana | null {
  if (!slug) return null;
  return CAMPANAS[slug.trim().toLowerCase()] ?? null;
}
