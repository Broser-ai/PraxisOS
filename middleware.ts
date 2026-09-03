import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Host-separation på bypilar-hosts:
 * - `/` = klinik (by Pilar) — ikke PraxisOS-salgsforside
 * - `/review` = Michael’s master-hub til at tjekke ALT
 * - Staff, admin, funktioner/priser/signup tilladt via hub
 * - B2B engros `/shop` forbliver væk (konkurrent-host)
 *
 * Defense-in-depth (P0 plan §F2): client-set `x-praxis-tenant|role|account`
 * identity headers are stripped at the edge so they can never be trusted by a
 * handler regardless of how its guard is written. The verified source of
 * identity is the HMAC session cookie (lib/request-auth.ts) or a verified
 * Bearer API key. `x-praxis-signature` (inbound webhook HMAC for /api/events)
 * is intentionally preserved.
 */

const BYPILAR_HOSTS = new Set([
  "app.bypilar.dk",
  "bypilar.dk",
  "www.bypilar.dk",
]);

// Identity headers a client must never be able to set. Guards resolve identity
// from the HMAC cookie or a verified Bearer; these headers are rejected even
// if they reach a handler (lib/request-auth.ts), and stripped here as
// belt-and-suspenders so a future permissive guard cannot regress to trusting them.
const SPOOFABLE_IDENTITY_HEADERS = [
  "x-praxis-tenant",
  "x-praxis-role",
  "x-praxis-account",
  "x-praxis-account-id",
];

function stripSpoofableIdentityHeaders(req: NextRequest): NextResponse {
  // Next.js middleware header-rewrite only overrides headers explicitly
  // present in the override set; headers omitted from the set are preserved
  // from the inbound request. So to neutralize a spoofable identity header we
  // must include it in the override with an empty value (falsy downstream, so
  // guards treat it as absent — see lib/request-auth.ts spoof check).
  const headers = new Headers(req.headers);
  let changed = false;
  for (const name of SPOOFABLE_IDENTITY_HEADERS) {
    if (headers.has(name)) {
      headers.set(name, "");
      changed = true;
    }
  }
  if (!changed) return NextResponse.next();
  return NextResponse.next({ request: { headers } });
}

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
  // Strip spoofable identity headers first (defense-in-depth, all hosts).
  // `cleaned` carries the rewritten headers downstream when returned; redirect
  // paths trigger a fresh client request that re-enters middleware and is
  // stripped again, so they need not forward the cleaned headers.
  const cleaned = stripSpoofableIdentityHeaders(req);

  const host = req.headers.get("host") ?? "";
  if (!isBypilarHost(host)) {
    return cleaned;
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

  return cleaned;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
