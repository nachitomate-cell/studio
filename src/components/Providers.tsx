"use client";

import { useEffect } from "react";
import { LocationProvider } from "@/context/LocationContext";
import { capturarCampana } from "@/lib/campanaRegistro";

export function Providers({ children }: { children: React.ReactNode }) {
  // Captura de campaña a nivel global, no por página.
  //
  // El primer intento la capturaba en /scan y /unete, pero el QR físico del
  // mostrador apunta a /canje?localId=..., y sin sesión eso redirige a
  // /?login=true — perdiendo el parámetro antes de llegar al registro.
  // Montado acá corre en cualquier página de entrada, así el QR puede apuntar
  // a donde sea mientras lleve ?evento=.
  useEffect(() => { capturarCampana(); }, []);

  return <LocationProvider>{children}</LocationProvider>;
}
