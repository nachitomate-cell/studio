"use client";

import { LocationProvider } from "@/context/LocationContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <LocationProvider>{children}</LocationProvider>;
}
