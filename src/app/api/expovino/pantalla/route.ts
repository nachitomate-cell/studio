/**
 * GET /api/expovino/pantalla?campana=expovino
 *
 * Alimenta la pantalla del stand. Es PÚBLICO a propósito: la alternativa era
 * dejar una sesión de staff abierta en un notebook conectado a una pantalla
 * gigante durante toda una feria, con cualquiera pudiendo tocarlo. Un endpoint
 * público de solo lectura es bastante menos riesgoso que eso.
 *
 * Por lo mismo devuelve el mínimo: el total y los nombres de pila de los
 * últimos inscritos. Nada de apellidos, correos ni teléfonos — lo que se ve en
 * la pantalla es lo que ve la feria entera.
 */

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

const ULTIMOS = 10;

/**
 * Cuánto se queda el cartel del ganador antes de devolver la pantalla a la
 * rotación. Suficiente para que la sala lo vea y se saque la foto, y no tanto
 * como para que el tótem quede congelado el resto de la noche.
 */
const VIGENCIA_GANADOR_MS = 90 * 1000;

/** Solo el nombre de pila, capitalizado. Nunca el apellido. */
function nombrePila(completo: unknown): string {
  const s = String(completo ?? "").trim();
  if (!s) return "";
  const primero = s.split(/\s+/)[0];
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const campana = (url.searchParams.get("campana") || "expovino").trim().toLowerCase();

    const [socios, sorteos, premios] = await Promise.all([
      adminDb.collection("usuarios").where("campanaRegistro", "==", campana).get(),
      adminDb.collection("sorteos").where("campana", "==", campana).get(),
      adminDb.collection("premios_campana")
        .where("campana", "==", campana)
        .where("estado", "==", "disponible").get(),
    ]);

    const inscritos = socios.docs
      .filter((d) => d.data().baneado !== true)
      .map((d) => ({
        nombre: nombrePila(d.data().nombre),
        en: String(d.data().campanaRegistroEn ?? d.data().createdAt ?? ""),
      }))
      .filter((x) => x.nombre);

    const ultimos = [...inscritos]
      .sort((a, b) => b.en.localeCompare(a.en))
      .slice(0, ULTIMOS)
      .map((x) => x.nombre);

    // El último sorteo realizado, si ya hubo
    const ultimoSorteo = sorteos.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];

    // Nombres para la ruleta. Se manda una muestra y no los cientos que puede
    // haber: la rueda solo tiene que verse llena mientras gira.
    const nombresRuleta = inscritos
      .map((x) => x.nombre)
      .sort(() => Math.random() - 0.5)
      .slice(0, 12);

    return NextResponse.json(
      {
        campana,
        total: inscritos.length,
        ultimos,
        nombresRuleta,
        premiosDisponibles: premios.size,
        // El id permite a la pantalla distinguir un sorteo NUEVO de uno que ya
        // mostró, que es lo que dispara la animación de la ruleta.
        sorteoId: ultimoSorteo?.id ?? null,
        // El cartel del ganador CADUCA. Sin esto, con un sorteo registrado la
        // pantalla quedaba tapada de forma permanente y dejaba de rotar — en un
        // evento con 11 premios eso es la mayor parte de la noche.
        ganador: ultimoSorteo && Date.now() - Date.parse(ultimoSorteo.fecha) < VIGENCIA_GANADOR_MS
          ? { nombre: nombrePila(ultimoSorteo.ganadorNombre), premio: ultimoSorteo.premio ?? null }
          : null,
      },
      // Sin caché: la gracia de la pantalla es que el número suba en vivo.
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    console.error("[expovino/pantalla] Error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
