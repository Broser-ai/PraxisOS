// PraxisOS · Sprint 6 Batch 3 · Edge middleware (SEC-12 + SEC-14 + boot-guard)
//
// Kontrakt (COMPLETE-AUDIT-REPORT.md · Batch 3 mandate):
//   Middleware skal:
//     (a) Verificere session-cookie for /admin/* + /api/v1/{tenant}/*  ruter
//     (b) Injektere tenant-context i request headers saa route-handlers
//         ikke behoever at re-parse URL'en
//     (c) Rate-limit stub via SharedStore (Redis/upstash i prod)
//     (d) Injektere per-request nonce i CSP-headeren (script-src)
//     (e) Fejle-tidligt paa env-vars i production
//
// Middleware koerer paa Edge Runtime (V8 isolate). Vi maa derfor undgaa Node-
// specifikke APIs som node:crypto - vi bruger Web Crypto (crypto.subtle +
// crypto.getRandomValues) i stedet. Session-verifikation deles med lib/session-
// token.ts som er Node-baseret; her genimplementerer vi HMAC-verify med Web
// Crypto for at holde det edge-kompatibelt.

import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

const SESSION_COOKIE = "praxis_session";
const TENANT_HEADER = "x-praxis-tenant";
const NONCE_HEADER = "x-praxis-csp-nonce";
const RATE_LIMIT_HEADER = "x-praxis-rate-limit";

// Ruter der KRAEVER en gyldig session-cookie.
const PROTECTED_PATH_PATTERNS: RegExp[] = [
  /^\/admin(?:\/|$)/, // hele admin-flade
  /^\/api\/v1\/[^/]+\/(?!public)/, // /api/v1/{tenant}/* undtagen /public/*
];

// Ruter der ER offentlige (whitelist trumfer PROTECTED).
// Sprint 6 · B5: bookings-route er PUBLIC (bypilar.dk widget kalder uden session)
// men self-hardened med IP-rate-limit + origin-allowlist + body-size cap.
const PUBLIC_PATH_PATTERNS: RegExp[] = [
  /^\/api\/auth\/(login|logout)$/,
  /^\/api\/health$/,
  /^\/api\/v1\/[^/]+\/public\//,
  /^\/api\/v1\/[^/]+\/bookings(?:\/|$)/,
];

// Ruter der selv verificerer Authorization: Bearer + tenant-scope i deres
// route.ts (via lib/api-keys.ts::verifyBearerToken). Middleware'en må ikke
// 401'e disse på manglende cookie hvis en syntaktisk Bearer-header er sat —
// bearer-verify sker på route-lag hvor node:crypto's timingSafeEqual er
// tilgængelig (Edge-runtime har den ikke universelt).
const BEARER_CAPABLE_PATH_PATTERNS: RegExp[] = [
  /^\/api\/v1\/[^/]+\/clients(?:\/|$)/,
  /^\/api\/v1\/[^/]+\/foot-scan\//,
  /^\/api\/mcp\//,
];

// Simpel edge-rate-limit (5000 req / min pr. IP). Bruges kun som stub -
// prod-rate-limit ligger i lib/rate-limit.ts med SharedStore-backend.
const EDGE_RATE_LIMIT_PER_MIN = 5000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generer 128-bit nonce som base64. Ny per request. Edge-kompatibel.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Web Crypto HMAC-SHA256 verify. Matcher lib/session-token.ts's Node-side
 * implementation saa samme token virker paa begge sider.
 */
async function verifyHmac(
  payloadB64: string,
  sigB64: string,
  secret: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    // Genopbyg base64-padding
    const padded = sigB64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const sigBytes = Uint8Array.from(atob(padded + pad), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(payloadB64),
    );
  } catch {
    return false;
  }
}

/**
 * Ekstraher tenant-slug fra pathen. Kun /api/v1/{tenant}/... samt /admin/{tenant}/...
 * Returnerer null hvis pathen ikke matcher noget kendt tenant-format.
 */
function extractTenant(pathname: string): string | null {
  const apiMatch = /^\/api\/v1\/([^/]+)\//.exec(pathname);
  if (apiMatch) return apiMatch[1];
  const adminMatch = /^\/admin\/([^/]+)(?:\/|$)/.exec(pathname);
  if (adminMatch) return adminMatch[1];
  return null;
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATH_PATTERNS.some((re) => re.test(pathname));
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PATH_PATTERNS.some((re) => re.test(pathname));
}

function isBearerCapable(pathname: string): boolean {
  return BEARER_CAPABLE_PATH_PATTERNS.some((re) => re.test(pathname));
}

/**
 * Session-verify · Edge-runtime HMAC-check af cookie'en fra
 * lib/session-token.ts (base64url(payload).base64url(hmac)).
 */
async function verifySession(
  cookieValue: string | undefined,
  secret: string | undefined,
): Promise<{ ok: boolean; payload?: unknown }> {
  if (!cookieValue) return { ok: false };
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return { ok: false };
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return { ok: false };

  if (!secret) return { ok: false }; // I prod har env.ts allerede kastet

  const valid = await verifyHmac(payloadB64, sigB64, secret);
  if (!valid) return { ok: false };

  try {
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const json = atob(padded + pad);
    return { ok: true, payload: JSON.parse(json) };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Edge-rate-limit · in-memory pr. isolate (stub · prod bruger SharedStore)
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, remaining: EDGE_RATE_LIMIT_PER_MIN - 1 };
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= EDGE_RATE_LIMIT_PER_MIN,
    remaining: Math.max(0, EDGE_RATE_LIMIT_PER_MIN - bucket.count),
  };
}

// ---------------------------------------------------------------------------
// Middleware entry
// ---------------------------------------------------------------------------

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // 1. Rate-limit paa Edge (stub - Redis-backend haandteres i route-lag)
  if (process.env.PRAXIS_RATE_LIMIT_EDGE !== "off") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    const rl = checkRateLimit(ip);
    if (!rl.allowed) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "retry-after": "60",
          [RATE_LIMIT_HEADER]: `0/${EDGE_RATE_LIMIT_PER_MIN}`,
        },
      });
    }
  }

  // 2. Generér CSP-nonce pr. request og injecter i response-headere
  const nonce = generateNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(NONCE_HEADER, nonce);

  // 3. Tenant-context injektion
  const tenant = extractTenant(pathname);
  if (tenant) requestHeaders.set(TENANT_HEADER, tenant);

  // 4. Session-check paa beskyttede ruter
  if (isProtectedRoute(pathname) && !isPublicRoute(pathname)) {
    // Sprint 6 · B5: bearer-capable routes verificerer selv Authorization
    // headeren i deres route.ts (via lib/api-keys.ts::verifyBearerToken).
    // node:crypto's timingSafeEqual er ikke universelt på Edge, så vi
    // lader den bare passere og delegerer til route-laget.
    const authHeader = req.headers.get("authorization");
    const hasBearer = authHeader?.startsWith("Bearer ") ?? false;
    if (hasBearer && isBearerCapable(pathname)) {
      // Fortsæt uden cookie-check — route-lag verify'er bearer + tenant-scope
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    const cookie = req.cookies.get(SESSION_COOKIE)?.value;
    const secret = process.env.PRAXIS_SESSION_SECRET;
    const { ok, payload } = await verifySession(cookie, secret);
    if (!ok) {
      // API-ruter -> JSON 401; admin-ruter -> redirect til login
      if (pathname.startsWith("/api/")) {
        return new NextResponse(
          JSON.stringify({ error: "unauthorized", scope: pathname }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Injekter session-info til route-handler
    if (payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>;
      if (typeof p.accountId === "string") {
        requestHeaders.set("x-praxis-account", p.accountId);
      }
      if (typeof p.role === "string") {
        requestHeaders.set("x-praxis-role", p.role);
      }
      // Tenant-match: hvis session'ens tenant afviger fra URL'ens tenant
      // afviser vi (cross-tenant angreb via en anden tenants session).
      if (
        tenant
        && typeof p.tenant === "string"
        && p.tenant !== tenant
      ) {
        return new NextResponse(
          JSON.stringify({ error: "tenant_mismatch" }),
          { status: 403, headers: { "content-type": "application/json" } },
        );
      }
    }
  }

  // 5. Byg response med injected headers + nonce-baseret CSP override
  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Overskriv CSP med det friske nonce (erstat placeholder fra next.config.mjs)
  const baseCsp = res.headers.get("content-security-policy");
  if (baseCsp && baseCsp.includes("{NONCE}")) {
    res.headers.set(
      "content-security-policy",
      baseCsp.replace("{NONCE}", nonce),
    );
  }
  res.headers.set(NONCE_HEADER, nonce);

  return res;
}

// Koer paa alt bortset fra Next.js interne assets og statiske files.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml
     * - public files (any file with an extension)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};

// Test-eksporter · unit-tests kan importere raa helpers uden at booter Next.
export const _test = {
  generateNonce,
  extractTenant,
  isProtectedRoute,
  isPublicRoute,
  verifySession,
  checkRateLimit,
  SESSION_COOKIE,
  TENANT_HEADER,
  NONCE_HEADER,
};
