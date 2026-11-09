/**
 * ¿Corre dentro de la app de las tiendas (Capacitor) o en el navegador/PWA?
 *
 * Se lee de window.Capacitor (lo inyecta el puente nativo) y no de
 * `@capacitor/core`, para que importar este módulo no arrastre Capacitor al
 * bundle de quien solo usa la web.
 */

export type PlataformaNativa = "android" | "ios";

export function esAppNativa(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

export function plataformaNativa(): PlataformaNativa | null {
  if (!esAppNativa()) return null;
  const p = (window as any).Capacitor?.getPlatform?.();
  return p === "android" || p === "ios" ? p : null;
}
