"use client";

import { EntrepreneurDetailView } from "@/components/directory/EntrepreneurDetailView";

/**
 * Vista de detalle del emprendedor.
 * Cargamos los datos dinámicamente en el cliente usando el ID de la URL.
 * Eliminadas funciones de generación estática para compatibilidad con desarrollo.
 */
export default function Page() {
  return <EntrepreneurDetailView />;
}
