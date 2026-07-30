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

    const [socios, sorteos] = await Promise.all([
      adminDb.collection("usuarios").where("campanaRegistro", "==", campana).get(),
      adminDb.collection("sorteos").where("campana", "==", campana).get(),
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
    const ganador = sorteos.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];

    return NextResponse.json(
      {
        campana,
        total: inscritos.length,
        ultimos,
        ganador: ganador
          ? { nombre: nombrePila(ganador.ganadorNombre), premio: ganador.premio ?? null }
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
