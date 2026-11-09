"use client";

/**
 * Geopush: aviso al llegar a Patio Curauma, con la app CERRADA.
 *
 * Las zonas se registran como geocercas del sistema operativo (plugin nativo
 * `plugins/geopush`). Cuando la persona llega y se queda unos minutos, el
 * teléfono publica el aviso por su cuenta: no depende de que el WebView esté
 * vivo, ni del servidor, ni de señal en ese momento. Por eso el texto del aviso
 * viaja al teléfono ANTES, con la configuración.
 *
 * El servidor decide qué zonas y qué textos (`configuracion/geopush`); este
 * módulo solo los baja, se los pasa al plugin y sube la bitácora de lo que pasó.
 */

import { registerPlugin } from "@capacitor/core";
import type { User } from "firebase/auth";
import { esAppNativa } from "@/lib/nativo";

export type EstadoPermiso = "granted" | "denied" | "prompt";

export interface EstadoGeoPush {
  plataforma: "android" | "ios";
  ubicacion: EstadoPermiso;
  /** Android: "Permitir todo el tiempo". iOS: "Siempre". */
  segundoPlano: EstadoPermiso;
  avisos: EstadoPermiso;
  zonas: number;
  /** Hay zonas registradas y los permisos alcanzan para avisar. */
  activo: boolean;
  /** Solo iOS: con "mientras se usa" también avisa, con menos control. */
  modo?: "siempre" | "mientras_se_usa" | "ninguno";
  registradas?: number;
}

export interface ZonaGeoPush {
  id: string;
  lat: number;
  lng: number;
  radio: number;
  titulo: string;
  mensaje: string;
  /** Ruta a abrir cuando tocan el aviso. */
  url?: string;
  cooldownHoras?: number;
}

export interface ConfigGeoPush {
  activo: boolean;
  zonas: ZonaGeoPush[];
  /** Minutos que hay que quedarse dentro antes del aviso (no avisar a quien pasa en auto). */
  esperaMinutos: number;
  cooldownHoras: number;
  /** Entre avisos de zonas distintas. */
  cooldownGlobalHoras: number;
  /** Horas locales sin avisos. Rango [desde, hasta), puede cruzar medianoche. */
  silencio: { desde: number; hasta: number };
  color?: string;
}

export interface EventoGeoPush {
  zona: string;
  tipo: "aviso" | "toque" | "prueba" | "enfriamiento" | "silencio" | "paso_de_largo" | "sin_permiso_avisos";
  ts: number;
}

interface GeoPushPlugin {
  estado(): Promise<EstadoGeoPush>;
  configurar(o: { config: ConfigGeoPush }): Promise<EstadoGeoPush>;
  apagar(): Promise<EstadoGeoPush>;
  pedirPermiso(o: { paso: "ubicacion" | "segundoPlano" | "avisos" }): Promise<EstadoGeoPush>;
  abrirAjustes(): Promise<void>;
  eventos(o: { limpiar: boolean }): Promise<{ eventos: EventoGeoPush[] }>;
  probar(o: { zona?: string }): Promise<{ enviado: boolean }>;
  addListener(evento: "toque", fn: (d: { zona: string }) => void): Promise<{ remove: () => Promise<void> }>;
}

export const GeoPush = registerPlugin<GeoPushPlugin>("GeoPush");

/** El plugin solo existe en la app de las tiendas desde la v1.0 nativa. */
export function geoPushDisponible(): boolean {
  if (!esAppNativa()) return false;
  return !!(window as any).Capacitor?.isPluginAvailable?.("GeoPush");
}

let configCache: ConfigGeoPush | null = null;

export async function obtenerConfig(): Promise<ConfigGeoPush | null> {
  try {
    const r = await fetch("/api/geopush/config", { cache: "no-store" });
    if (!r.ok) return configCache;
    configCache = (await r.json()) as ConfigGeoPush;
    return configCache;
  } catch {
    return configCache;
  }
}

export function urlDeZona(zonaId: string): string {
  return configCache?.zonas.find((z) => z.id === zonaId)?.url || "/";
}

/**
 * Baja la config, se la pasa al teléfono y sube la bitácora. Se llama al abrir
 * la app y al volver a ella. Idempotente.
 */
export async function sincronizarGeoPush(user: User | null): Promise<EstadoGeoPush | null> {
  if (!geoPushDisponible()) return null;
  let estado: EstadoGeoPush | null = null;
  const cfg = await obtenerConfig();
  try {
    estado = cfg ? await GeoPush.configurar({ config: cfg }) : await GeoPush.estado();
  } catch (e) {
    console.warn("[GeoPush] No se pudo configurar:", e);
  }
  if (user) await subirEventos(user);
  return estado;
}

async function subirEventos(user: User) {
  try {
    const { eventos } = await GeoPush.eventos({ limpiar: false });
    if (!eventos?.length) return;
    const token = await user.getIdToken();
    const r = await fetch("/api/geopush/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        eventos,
        plataforma: (window as any).Capacitor?.getPlatform?.() ?? "desconocida",
      }),
    });
    // Se borran solo si llegaron: sin señal en el Patio no se pierde nada.
    if (r.ok) await GeoPush.eventos({ limpiar: true });
  } catch (e) {
    console.warn("[GeoPush] No se pudo subir la bitácora:", e);
  }
}
