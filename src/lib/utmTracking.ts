import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface UTMParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
}

export function captureUTMParams(): UTMParams | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const source = params.get("utm_source") || "";
  const fbclid = params.get("fbclid") || "";

  // Instagram stripea los UTM pero siempre agrega fbclid
  if (!source && !fbclid) return null;

  return {
    utm_source: source || "instagram",
    utm_medium: params.get("utm_medium") || (fbclid && !source ? "social" : ""),
    utm_campaign: params.get("utm_campaign") || (fbclid && !source ? "ig_link_in_bio" : ""),
    utm_content: params.get("utm_content") || (fbclid && !source ? fbclid.slice(0, 20) : ""),
  };
}

export async function registrarVisitaUTM(utmParams: UTMParams, userId?: string | null): Promise<void> {
  const key = `utm_tracked_${utmParams.utm_source}_${utmParams.utm_campaign}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");

  try {
    await addDoc(collection(db, "utm_visitas"), {
      ...utmParams,
      userId: userId || null,
      timestamp: serverTimestamp(),
    });
  } catch {
    // tracking is best-effort
  }
}
