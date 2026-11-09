/**
 * Configuración por defecto del geopush. Se puede pisar campo a campo desde
 * Firestore (`configuracion/geopush`) sin publicar una versión nueva de la app.
 *
 * Coordenadas verificadas el 08-11-2026 contra OpenStreetMap y las direcciones
 * que los locales cargaron en su perfil:
 * - Outlet Curauma, Av. Lomas de la Luz 4650 (la mayoría de los locales).
 * - Tienda Patio Curauma, Av. Universidad 134, local 1.
 */

import type { ConfigGeoPush } from "@/lib/geopush";

export const GEOPUSH_POR_DEFECTO: ConfigGeoPush = {
  activo: true,
  esperaMinutos: 3,
  cooldownHoras: 24,
  cooldownGlobalHoras: 8,
  silencio: { desde: 21, hasta: 10 },
  color: "#C9920A",
  zonas: [
    {
      id: "outlet",
      lat: -33.1318,
      lng: -71.5645,
      radio: 250,
      titulo: "Llegaste a Patio Curauma 🛍️",
      mensaje: "Muestra tu código en caja y suma sellos en cada compra. Mira qué premios te quedan cerca.",
      url: "/",
    },
    {
      id: "tienda",
      lat: -33.144649,
      lng: -71.5715651,
      radio: 150,
      titulo: "Estás en la Tienda Patio 🛍️",
      mensaje: "Tus sellos también corren acá. Abre Club Patio y muestra tu código al pagar.",
      url: "/",
    },
  ],
};

/** Mezcla lo guardado en Firestore con los valores por defecto, descartando zonas inválidas. */
export function normalizarConfig(guardado: Partial<ConfigGeoPush> | undefined | null): ConfigGeoPush {
  const base = GEOPUSH_POR_DEFECTO;
  const g = guardado ?? {};
  const zonas = Array.isArray(g.zonas)
    ? g.zonas.filter(
        (z) =>
          z && typeof z.id === "string" && z.id &&
          Number.isFinite(z.lat) && Number.isFinite(z.lng) &&
          typeof z.titulo === "string" && typeof z.mensaje === "string",
      ).map((z) => ({ ...z, radio: Math.min(Math.max(Number(z.radio) || 200, 100), 2000) }))
    : base.zonas;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    activo: typeof g.activo === "boolean" ? g.activo : base.activo,
    esperaMinutos: num(g.esperaMinutos, base.esperaMinutos),
    cooldownHoras: num(g.cooldownHoras, base.cooldownHoras),
    cooldownGlobalHoras: num(g.cooldownGlobalHoras, base.cooldownGlobalHoras),
    silencio: {
      desde: num(g.silencio?.desde, base.silencio.desde),
      hasta: num(g.silencio?.hasta, base.silencio.hasta),
    },
    color: typeof g.color === "string" ? g.color : base.color,
    zonas: zonas.slice(0, 18),
  };
}
