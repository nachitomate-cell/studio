import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/superadmin")) {
    return NextResponse.next();
  }

  // Real auth is enforced inside the page via Firebase Auth (email check).
  // No IP-based filtering — it's trivially bypassed via spoofed headers and
  // gives a false sense of security. The page is the authoritative gate.
  return NextResponse.next();
}

export const config = {
  matcher: ["/superadmin/:path*"],
};
