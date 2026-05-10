import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// IPs permitidas en desarrollo local
const LOCAL_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "192.168.0.5"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/superadmin")) {
    return NextResponse.next();
  }

  // Extraer IP del cliente
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip") ?? "";
  const ip = (forwarded ? forwarded.split(",")[0] : realIp).trim();

  // Si la IP es local/dev, pasar directo (la página también valida email)
  if (LOCAL_IPS.has(ip) || ip === "" || ip.startsWith("192.168.")) {
    return NextResponse.next();
  }

  // IP no reconocida — continuar pero marcar para que la página haga doble verificación
  // La página valida email de Firebase Auth como capa adicional de seguridad
  const res = NextResponse.next();
  res.headers.set("x-superadmin-ip-check", "email-required");
  return res;
}

export const config = {
  matcher: ["/superadmin/:path*"],
};
