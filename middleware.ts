import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Host-separation på bypilar-hosts:
 * - `/` = klinik (by Pilar) — ikke PraxisOS-salgsforside
 * - `/review` = Michael’s master-hub til at tjekke ALT
 * - Staff, admin, funktioner/priser/signup tilladt via hub
 * - B2B engros `/shop` forbliver væk (konkurrent-host)
 */

const BYPILAR_HOSTS = new Set([
  "app.bypilar.dk",
  "bypilar.dk",
  "www.bypilar.dk",
]);

function isBypilarHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0];
  return BYPILAR_HOSTS.has(h);
}

function isAllowedOnBypilar(pathname: string): boolean {
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname === "/icon.svg") {
    return true;
  }
  // Master review-hub + hele programmet
  if (pathname === "/review" || pathname.startsWith("/review/")) return true;
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/demo")) return true;
  if (pathname.startsWith("/t/")) return true;
  if (pathname.startsWith("/embed/v1/")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/r/")) return true;
  const staff = [
    "/login",
    "/dashboard",
    "/kalender",
    "/klienter",
    "/bookings",
    "/scribe",
    "/agent",
    "/chat",
    "/scan",
    "/felt",
    "/indstillinger",
    "/journal",
  ];
  if (staff.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (
    pathname === "/funktioner" ||
    pathname.startsWith("/funktioner/") ||
    pathname === "/pricing" ||
    pathname === "/signup" ||
    pathname.startsWith("/signup/") ||
    pathname === "/about"
  ) {
    return true;
  }
  return false;
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (!isBypilarHost(host)) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // Forsiden = klinik (ikke PraxisOS B2B-landing)
  if (pathname === "/" || pathname === "") {
    const url = req.nextUrl.clone();
    url.pathname = "/t/bypilar";
    return NextResponse.redirect(url);
  }

  // B2B engros hører ikke under bypilar-host
  if (pathname === "/shop" || pathname.startsWith("/shop/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/t/bypilar";
    return NextResponse.redirect(url);
  }

  if (!isAllowedOnBypilar(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/review";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
