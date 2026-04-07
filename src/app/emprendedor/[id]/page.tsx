
"use client";

import { EntrepreneurDetailView } from "@/components/directory/EntrepreneurDetailView";

/**
 * En modo 'output: export' (estático), Next.js necesita conocer todas las rutas
 * dinámicas posibles en tiempo de compilación.
 * Retornamos un array vacío para permitir que las rutas se manejen dinámicamente en el cliente.
 */
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <EntrepreneurDetailView />;
}
