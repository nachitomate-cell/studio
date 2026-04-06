
import { EntrepreneurDetailView } from "@/components/directory/EntrepreneurDetailView";
import { ENTREPRENEURS } from "@/lib/data";

/**
 * En modo 'output: export' (estático), Next.js necesita conocer todas las rutas
 * dinámicas posibles en tiempo de compilación.
 */
export async function generateStaticParams() {
  // Generamos una ruta para cada emprendedor definido en nuestra data base
  return ENTREPRENEURS.map((entrepreneur) => ({
    id: entrepreneur.id,
  }));
}

/**
 * Evita que se intenten generar rutas dinámicas en tiempo de ejecución,
 * lo cual es necesario para aplicaciones exportadas estáticamente (como en Capacitor).
 */
export const dynamicParams = false;

export default function Page() {
  return <EntrepreneurDetailView />;
}
