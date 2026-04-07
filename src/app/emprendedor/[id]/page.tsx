
import { EntrepreneurDetailView } from "@/components/directory/EntrepreneurDetailView";
import { ENTREPRENEURS } from "@/lib/data";

/**
 * En modo 'output: export' (estático), Next.js necesita conocer todas las rutas
 * dinámicas posibles en tiempo de compilación.
 * Mantenemos esta página por compatibilidad, pero redirigimos la lógica a parámetros de búsqueda.
 */
export async function generateStaticParams() {
  // Aseguramos que siempre haya al menos una ruta para que el build no falle
  const params = ENTREPRENEURS.map((entrepreneur) => ({
    id: entrepreneur.id,
  }));
  return params.length > 0 ? params : [{ id: 'default' }];
}

export const dynamicParams = false;

export default function Page() {
  return <EntrepreneurDetailView />;
}
