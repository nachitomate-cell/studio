/**
 * Hook único para leer las categorías del directorio.
 *
 * Fuente combinada:
 *   - Base canónica (CATEGORIES_BASE en src/lib/data.ts) — 8 categorías del
 *     directorio original. Se usa como "piso" para que la UI nunca quede
 *     vacía aunque Firestore esté sin sembrar.
 *   - Colección Firestore `categorias_negocios` — administrada desde /director.
 *     Cada doc con { nombre, icono (emoji), orden } se mapea al type Category
 *     y GANA sobre la base si comparten id (permite renombrar/re-emojear las
 *     canónicas sin tocar código).
 *
 * Uso:
 *   const { categorias, categoriasConTodos, loading } = useCategorias();
 *   - `categorias` → array sin el filtro sintético "Todos" (para selectores).
 *   - `categoriasConTodos` → incluye { id: "all" } al inicio (para filtros).
 */

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CATEGORIES_BASE, CATEGORY_ALL, type Category } from "@/lib/data";

/**
 * Algunas categorías se cargaron en mayúsculas ("RESTAURANTE", "SERVICIOS") y
 * junto a "Cafetería" se veía descuidado. Solo toca las que vienen enteras en
 * mayúsculas; "Deco & Hogar" o "Gourmet & Licores" quedan tal cual.
 */
function formatearNombre(nombre: string): string {
  const t = nombre.trim();
  if (t !== t.toUpperCase() || !/\p{L}/u.test(t)) return t;
  const min = t.toLocaleLowerCase("es-CL");
  return min.charAt(0).toLocaleUpperCase("es-CL") + min.slice(1);
}

export function useCategorias(): {
  categorias: Category[];
  categoriasConTodos: Category[];
  loading: boolean;
} {
  const [firestoreCats, setFirestoreCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "categorias_negocios"),
      (snap) => {
        setFirestoreCats(
          snap.docs.map((d) => {
            const data = d.data() as { nombre?: string; icono?: string; orden?: number };
            return {
              id: d.id,
              name: formatearNombre(data.nombre ?? d.id),
              icon: "", // legacy Lucide field — no lo usa nadie en runtime
              emoji: data.icono,
              orden: typeof data.orden === "number" ? data.orden : undefined,
            };
          })
        );
        setLoading(false);
      },
      () => {
        // Sin permisos o red caída → nos quedamos con la base como fallback.
        setFirestoreCats([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const categorias = useMemo(() => {
    // Merge por id: base primero, Firestore sobrescribe.
    const byId = new Map<string, Category>();
    for (const c of CATEGORIES_BASE) byId.set(c.id, c);
    for (const c of firestoreCats) byId.set(c.id, { ...byId.get(c.id), ...c });
    return Array.from(byId.values()).sort(
      (a, b) => (a.orden ?? 999) - (b.orden ?? 999)
    );
  }, [firestoreCats]);

  const categoriasConTodos = useMemo(
    () => [CATEGORY_ALL, ...categorias],
    [categorias]
  );

  return { categorias, categoriasConTodos, loading };
}
