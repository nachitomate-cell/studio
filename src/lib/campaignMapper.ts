import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Diccionario base de IDs de campaña detectados en analítica.
 * Se puede extender dinámicamente desde Firestore
 * (config_trafico/campaign_dictionary con un mapa { ids: {...} }).
 */
export const CAMPAIGN_NAMES: Record<string, string> = {
  "120245149954220474": "IG Ads · Promo Sorteo / Polla",
  "120245061307220474": "IG Ads · Reels Tráfico Patio",
  "120243951809330474": "IG Ads · Campaña Retargeting",
  entrada_local: "QR · Mesón Entrada Local",
  ig_link_in_bio: "Instagram · Link en Bio",
  NOMBRE: "Test · Link Ejemplo",
};

let dynamicDictionary: Record<string, string> = {};
let dictionaryLoaded = false;

/**
 * Carga el diccionario dinámico desde Firestore una sola vez.
 * Falla silenciosamente hacia el diccionario en memoria si no existe.
 */
export async function loadCampaignDictionary(): Promise<void> {
  if (dictionaryLoaded) return;
  try {
    const snap = await getDoc(doc(db, "config_trafico", "campaign_dictionary"));
    if (snap.exists()) {
      const data = snap.data();
      const ids = (data?.ids ?? data) as Record<string, unknown>;
      const entries: Record<string, string> = {};
      for (const [k, v] of Object.entries(ids || {})) {
        if (typeof v === "string" && v.trim()) entries[k] = v;
      }
      dynamicDictionary = entries;
    }
  } catch {
    /* fallback silencioso al diccionario en memoria */
  } finally {
    dictionaryLoaded = true;
  }
}

/**
 * Traduce un UTM Campaign crudo a un nombre comercial legible.
 * Prioriza el diccionario dinámico (Firestore) sobre el estático.
 */
export function formatCampaignName(rawCampaign?: string | null): string {
  if (!rawCampaign || rawCampaign === "null" || rawCampaign === "undefined") {
    return "(sin datos)";
  }
  return dynamicDictionary[rawCampaign] || CAMPAIGN_NAMES[rawCampaign] || rawCampaign;
}

/**
 * Indica si un raw campaign fue traducido (útil para mostrar tooltip con ID crudo).
 */
export function hasCampaignAlias(rawCampaign?: string | null): boolean {
  if (!rawCampaign) return false;
  return Boolean(dynamicDictionary[rawCampaign] || CAMPAIGN_NAMES[rawCampaign]);
}

/**
 * Normaliza fuentes de tráfico para agrupar variaciones del mismo canal.
 */
export function normalizeSource(rawSource?: string | null): string {
  if (!rawSource) return "Directo / Desconocido";
  const s = rawSource.toLowerCase().trim();
  if (s === "ig" || s === "instagram" || s === "fb" || s === "facebook" || s === "meta") {
    return "Instagram / Meta";
  }
  if (s === "qr") return "QR Físico";
  if (s === "flyer" || s === "volante") return "Flyer Impreso";
  if (s === "whatsapp" || s === "wsp" || s === "wa") return "WhatsApp";
  return rawSource;
}
