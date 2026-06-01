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
  if (!source) return null;
  return {
    utm_source: source,
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
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
