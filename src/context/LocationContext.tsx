"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export interface AppLocation {
  id: string;
  name: string;
  address: string;
}

export const LOCATIONS: AppLocation[] = [
  {
    id: "patio-curauma",
    name: "Patio Curauma",
    address: "Av. Lomas de la Luz 4650, Curauma, Valparaíso",
  },
  {
    id: "patio-universidad",
    name: "Patio Universidad",
    address: "Avenida Universidad 134, Local 1",
  },
  {
    id: "patio-villa-alemana",
    name: "Patio Villa Alemana",
    address: "Manuel Montt #1561, Villa Alemana",
  },
];

interface LocationContextValue {
  selectedLocation: AppLocation;
  setSelectedLocation: (loc: AppLocation) => void;
}

const LocationContext = createContext<LocationContextValue>({
  selectedLocation: LOCATIONS[0],
  setSelectedLocation: () => {},
});

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selectedLocation, setSelectedLocation] = useState<AppLocation>(LOCATIONS[0]);
  return (
    <LocationContext.Provider value={{ selectedLocation, setSelectedLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
