/**
 * /api/geo/resolver — convierte un enlace corto de Google Maps en coordenadas.
 *
 * La app de Maps comparte enlaces del tipo https://maps.app.goo.gl/AbC123, que
 * el navegador no puede seguir por CORS. Aquí se sigue la redirección y se leen
 * las coordenadas de la URL larga.
 *
 * Solo se aceptan dominios de Google: este endpoint sigue redirecciones, así que
 * sin esa restricción serviría para que un tercero lo usara de proxy contra
 * cualquier host (incluida la red interna).
 */

import { NextResponse } from "next/server";
import { extraerCoords } from "@/lib/geoLink";

const HOSTS_PERMITIDOS = [
  "maps.app.goo.gl",
  "goo.gl",
  "g.co",
  "maps.google.com",
  "www.google.com",
  "google.com",
];

function hostPermitido(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return HOSTS_PERMITIDOS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let url: string;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "Falta el enlace." }, { status: 400 });
  }
  if (!hostPermitido(url)) {
    return NextResponse.json(
      { error: "Solo se aceptan enlaces de Google Maps." },
      { status: 400 }
    );
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    // Un GET normal: Google responde el destino final en res.url tras seguir
    // las redirecciones. HEAD no siempre las resuelve en los enlaces cortos.
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        // Sin un User-Agent de navegador, los enlaces cortos responden con una
        // página intermedia en vez de redirigir.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    clearTimeout(timer);

    if (!hostPermitido(res.url)) {
      return NextResponse.json(
        { error: "El enlace no llevó a Google Maps." },
        { status: 400 }
      );
    }

    // Primero la URL final; si ahí no vienen, se buscan en el HTML, donde
    // Google deja el marcador del lugar.
    let coords = extraerCoords(res.url);
    if (!coords) {
      const html = (await res.text()).slice(0, 200_000);
      coords = extraerCoords(html);
    }

    if (!coords) {
      return NextResponse.json(
        { error: "No se pudieron leer las coordenadas de ese enlace." },
        { status: 422 }
      );
    }

    return NextResponse.json({ ...coords, urlFinal: res.url });
  } catch (err) {
    const abortada = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: abortada ? "El enlace tardó demasiado en responder." : "No se pudo abrir el enlace." },
      { status: 504 }
    );
  }
}
