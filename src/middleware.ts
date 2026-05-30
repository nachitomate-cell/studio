import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Mapa de subdominios a IDs de documentos en Firestore (emprendedores/tenants)
const SUBDOMAIN_MAP: Record<string, string> = {
  "omegastudio": "omega-studio",
  "aurasalonmalegrooming": "aurasalon-premium",
  "marcelopalma": "marcelo-palma",
  "chameleonbarber": "chameleon-barber",
  "infinity": "infinity-barber",
  "machos": "machos-barber",
  "barberizacion": "barberizacion-premium",
  "barberiadjones": "barberiadjones",
  "delnerobarber": "delnerobarber",
  "lumenbarbershop": "lumenbarbershop",
  "deluxeperfumes": "deluxeperfumes",
  "mapubarbershop": "mapubarbershop",
  "barberiaferraza": "barberiaferraza",
  "gitana-nails": "gitana-nails"
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // Ignorar peticiones de recursos estáticos, APIs, etc., para evitar bucles de reescritura
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Extraer el host sin puerto (ej: omegastudio.synaptechspa.cl o omegastudio.localhost)
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");

  // Detectar si hay un subdominio válido
  // Caso A: Dominio real (ej: omegastudio.synaptechspa.cl -> parts.length >= 3)
  // Caso B: Desarrollo local (ej: omegastudio.localhost -> parts.length >= 2 y termina en localhost)
  const isLocalhost = hostname.endsWith("localhost");
  const hasSubdomain = parts.length >= 3 || (isLocalhost && parts.length >= 2);

  if (hasSubdomain) {
    const subdomain = parts[0].toLowerCase();

    // Evitar interceptar subdominios principales del portal
    if (subdomain !== "www" && subdomain !== "clubpatiocurauma") {
      const tenantId = SUBDOMAIN_MAP[subdomain] || subdomain;

      // Si el cliente entra a la raíz (/), reescribir transparentemente a su página de detalle
      if (pathname === "/") {
        const url = request.nextUrl.clone();
        url.pathname = `/emprendedor/${tenantId}`;
        return NextResponse.rewrite(url);
      }
    }
  }

  // Continuar flujo normal para la ruta solicitada
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas de solicitud excepto las que empiezan por:
     * - api (rutas de API)
     * - _next/static (archivos estáticos)
     * - _next/image (archivos de optimización de imágenes)
     * - favicon.ico (archivo favicon)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
