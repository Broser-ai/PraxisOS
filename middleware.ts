import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Host-separation:
 * - app.bypilar.dk / bypilar.dk = KUN by Pilar-klinik (kunde-flade)
 * - PraxisOS B2B-salg (funktioner/priser/signup) må IKKE ligge under bypilar —
 *   byPilar er konkurrent til de klinikker, der køber PraxisOS.
 *
 * Platform-hosts (localhost, IP, fremtidig praxisos-domæne) får fuld B2B + admin.
 */

const BYPILAR_HOSTS = new Set([
  "app.bypilar.dk",
  "bypilar.dk",
  "www.bypilar.dk",
]);

/** Paths der er PraxisOS B2B / platform-marketing — blokeres på bypilar-hosts */
const PLATFORM_ONLY_PREFIXES = [
  "/funktioner",
  "/pricing",
  "/signup",
  "/about",
  "/shop", // B2B engros — ikke under bypilar
];

function isBypilarHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0];
  return BYPILAR_HOSTS.has(h);
}

function isAllowedOnBypilar(pathname: string): boolean {
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname === "/icon.svg") {
    return true;
  }
  // Klinik white-label
  if (pathname.startsWith("/t/bypilar")) return true;
  if (pathname.startsWith("/embed/v1/bypilar")) return true;
  if (pathname.startsWith("/api/v1/bypilar")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/r/")) return true; // kvitteringer
  // Klinik-staff (by Pilar personale)
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
    "/review",
  ];
  if (staff.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  // Begrænset admin til klinik-drift (ikke B2B-salgsflader)
  if (pathname.startsWith("/admin/services") || pathname.startsWith("/admin/vouchers") || pathname.startsWith("/admin/staff") || pathname.startsWith("/admin/payments")) {
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

  // Eksplicit: B2B-marketing væk fra bypilar-host
  if (PLATFORM_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/t/bypilar";
    return NextResponse.redirect(url);
  }

  if (pathname === "/" || pathname === "") {
    const url = req.nextUrl.clone();
    url.pathname = "/t/bypilar";
    return NextResponse.redirect(url);
  }

  // Bloker øvrig platform (tenants admin, signup API, marketplace salg osv.)
  if (!isAllowedOnBypilar(pathname)) {
    // API signup/license er B2B — 404 på bypilar-host
    if (pathname.startsWith("/api/signup") || pathname.startsWith("/api/license") || pathname.startsWith("/api/tenant")) {
      return NextResponse.json({ error: "not_available_on_clinic_host" }, { status: 404 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/t/bypilar";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
