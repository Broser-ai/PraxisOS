// PraxisOS · Edge middleware — session gate + tenant header injection

import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "praxis_session";
const TENANT_HEADER = "x-praxis-tenant";
const ROLE_HEADER = "x-praxis-role";
const ACCOUNT_HEADER = "x-praxis-account";

const PROTECTED_PATH_PATTERNS: RegExp[] = [
  /^\/admin(?:\/|$)/,
  /^\/dashboard(?:\/|$)/,
  /^\/bookings(?:\/|$)/,
  /^\/klienter(?:\/|$)/,
  /^\/kalender(?:\/|$)/,
  /^\/scribe(?:\/|$)/,
  /^\/scan(?:\/|$)/,
  /^\/chat(?:\/|$)/,
  /^\/agent(?:\/|$)/,
  /^\/felt(?:\/|$)/,
  /^\/review(?:\/|$)/,
  /^\/indstillinger(?:\/|$)/,
  /^\/api\/auth\/me$/,
  /^\/api\/v1\/[^/]+\/clients(?:\/|$)/,
  /^\/api\/v1\/[^/]+\/bookings\/list(?:\/|$)/,
  /^\/api\/v1\/[^/]+\/swarm(?:\/|$)/,
  /^\/api\/v1\/[^/]+\/orchestrator(?:\/|$)/,
];

// Cron is authenticated inside the route (CRON_SECRET / x-vercel-cron).

const PUBLIC_PATH_PATTERNS: RegExp[] = [
  /^\/api\/auth\/(login|logout)$/,
  /^\/api\/signup$/,
  // /api/auth/me requires session — handled via PROTECTED below

  /^\/api\/dawa\//,
  /^\/api\/cvr\//,
  /^\/api\/cron\//,
  /^\/api\/v1\/[^/]+\/bookings$/,
  /^\/api\/v1\/[^/]+\/availability/,
  /^\/api\/v1\/[^/]+\/services/,
  /^\/login(?:\/|$)/,
  /^\/signup(?:\/|$)/,
];

const BEARER_CAPABLE_PATH_PATTERNS: RegExp[] = [
  /^\/api\/v1\/[^/]+\/clients(?:\/|$)/,
  /^\/api\/v1\/[^/]+\/bookings\/list(?:\/|$)/,
  /^\/api\/mcp\//,
];

const DEV_TEST_FALLBACK_KEY =
  "praxisos-dev-test-session-key-do-not-use-in-production";

function matches(patterns: RegExp[], path: string): boolean {
  return patterns.some((p) => p.test(path));
}

function getSecret(): string | null {
  const secret = process.env.PRAXIS_SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") return null;
  return DEV_TEST_FALLBACK_KEY;
}

function fromBase64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifySession(
  token: string,
  secret: string,
): Promise<{ accountId: string; tenant: string; role: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = fromBase64Url(sigB64);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as BufferSource,
      new TextEncoder().encode(payloadB64),
    );
    if (!ok) return null;
    const json = new TextDecoder().decode(fromBase64Url(payloadB64));
    const payload = JSON.parse(json) as {
      accountId?: string;
      tenant?: string;
      role?: string;
    };
    if (!payload.accountId || !payload.tenant || !payload.role) return null;
    return {
      accountId: payload.accountId,
      tenant: payload.tenant,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (matches(PUBLIC_PATH_PATTERNS, pathname)) {
    return NextResponse.next();
  }

  const needsAuth = matches(PROTECTED_PATH_PATTERNS, pathname);
  if (!needsAuth) return NextResponse.next();

  const hasBearer = Boolean(req.headers.get("authorization")?.startsWith("Bearer "));
  if (hasBearer && matches(BEARER_CAPABLE_PATH_PATTERNS, pathname)) {
    return NextResponse.next();
  }

  const secret = getSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "server_misconfigured", hint: "PRAXIS_SESSION_SECRET missing" },
      { status: 500 },
    );
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token, secret) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(TENANT_HEADER, session.tenant);
  requestHeaders.set(ROLE_HEADER, session.role);
  requestHeaders.set(ACCOUNT_HEADER, session.accountId);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/bookings/:path*",
    "/klienter/:path*",
    "/kalender/:path*",
    "/scribe/:path*",
    "/scan/:path*",
    "/chat/:path*",
    "/agent/:path*",
    "/felt/:path*",
    "/review/:path*",
    "/indstillinger/:path*",
    "/api/auth/me",
    "/api/v1/:tenant/clients",
    "/api/v1/:tenant/clients/:path*",
    "/api/v1/:tenant/bookings/list",
    "/api/v1/:tenant/swarm",
    "/api/v1/:tenant/swarm/:path*",
    "/api/v1/:tenant/orchestrator",
    "/api/v1/:tenant/orchestrator/:path*",
  ],
};
