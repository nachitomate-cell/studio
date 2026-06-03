"use client";

import { useEffect } from "react";
import { captureUTMParams, registrarVisitaUTM } from "@/lib/utmTracking";

export default function UTMTracker() {
  useEffect(() => {
    const utm = captureUTMParams();
    if (utm) registrarVisitaUTM(utm, null);
  }, []);
  return null;
}
