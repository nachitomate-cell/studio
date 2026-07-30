/**
 * GET /e  → atajo al registro del evento activo.
 *
 * Existe por el QR de la pantalla LED. El tótem es de 256 px de ancho con un
 * paso de píxel de ~2,5 mm, así que cada módulo del QR mide varios milímetros:
 * mientras más largo el texto codificado, más módulos y más finos, hasta que la
 * cámara deja de leerlo. La URL completa
 *   clubpatiocurauma.synaptechspa.cl/unete?evento=expovino   (61 caracteres)
 * necesita bastantes más módulos que
 *   clubpatiocurauma.synaptechspa.cl/e                       (33 caracteres)
 *
 * Menos módulos = módulos más gruesos = se lee de más lejos y con peor pulso.
 *
 * El destino se controla con EVENTO_ACTIVO; cambiarlo apunta el mismo QR
 * impreso a otro evento sin reimprimir nada.
 */

import { NextResponse } from "next/server";

const EVENTO_ACTIVO = "expovino";

export async function GET(request: Request) {
  const origen = new URL(request.url).origin;
  return NextResponse.redirect(`${origen}/unete?evento=${EVENTO_ACTIVO}`, {
    status: 302,                                  // temporal: el evento cambia
    headers: { "Cache-Control": "no-store" },     // que nadie lo cachee
  });
}
