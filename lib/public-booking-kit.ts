// Public booking kit · protect by-Pilar embed booking WITHOUT staff login.
//
// Princip (P0 plan §A.9 / §F6):
//   - Origin/Referer allowlist per tenant (lib/tenants domains + env
//     PRAXIS_BOOKING_CORS_ORIGINS) replaces access-control-allow-origin: * on
//     write/list-sensitive public routes (bookings POST, lookup, voucher).
//   - Per-IP + tenant rate-limit (reuse fixed-window pattern).
//   - Optional public booking key (pk_live_…, scope write:bookings / read:services)
//     via Bearer — non-breaking: if absent, allowlisted origin still works.
//   - NEVER require praxis_session on patient booking (would break /embed/v1).
//
// Safety: when Origin is not allowlisted we do NOT block the booking (would
// break legit embeds / curl smoke); we simply omit the ACAO header so a
// browser blocks cross-origin JS from reading the response. Rate-limit is the
// real abuse control. This matches the plan's "start with allowlist, don't
// break by Pilar embed" guidance.

import { verifyApiKey } from "@/lib/api-keys";
import { getTenant } from "@/lib/tenants";

const BOOKING_WINDOW_MS = 15 * 60 * 1000; // 15 min
const DEFAULT_BOOKING_LIMIT = 30; // requests / window / IP / tenant
/** Stricter default for email/code enumeration surfaces (lookup + voucher). */
const DEFAULT_LOOKUP_LIMIT = 20;

type Bucket = { count: number; firstAt: number };
const buckets = new Map<string, Bucket>();
const lookupBuckets = new Map<string, Bucket>();

/** Test helper — clear rate-limit state between cases. */
export function _resetBookingRateLimitForTests(): void {
  buckets.clear();
  lookupBuckets.clear();
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function envList(name: string): string[] {
  const v = process.env[name];
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      // Accept either bare hosts (bypilar.dk) or full origins (https://bypilar.dk)
      try {
        if (/^https?:\/\//.test(entry)) return new URL(entry).host;
      } catch {
        // fall through
      }
      return entry.replace(/^https?:\/\//, "");
    });
}

/** Best-effort client IP (x-forwarded-for first hop, else x-real-ip, else unknown). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(host: string, pattern: string): boolean {
  return host === pattern || host.endsWith("." + pattern);
}

/**
 * Resolve the allowed CORS origin for a tenant booking request.
 * Returns the origin string to echo (ACAO header) when the request Origin is
 * allowlisted, otherwise null (caller omits / sets no ACAO header).
 */
export function bookingAllowedOrigin(
  req: Request,
  tenantSlug: string,
): string | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = hostOf(origin) ?? hostOf(referer);
  if (!host) return null; // same-origin / curl — no ACAO needed

  const tenant = getTenant(tenantSlug);
  const allowlist = [
    ...(tenant?.domains ?? []).map((d) => d.toLowerCase()),
    ...envList("PRAXIS_BOOKING_CORS_ORIGINS"),
    ...envList("PRAXIS_BOOKING_ALLOWED_ORIGINS"),
  ];

  const allowed = allowlist.some((p) => hostMatches(host, p));
  return allowed ? (origin ?? new URL(referer!).origin) : null;
}

/**
 * Per-IP + tenant fixed-window rate limit for public booking writes/lookups.
 * Returns ok or a 429 payload with retryAfter seconds.
 */
export function bookingRateLimit(
  ip: string,
  tenantSlug: string,
): { ok: true } | { ok: false; status: 429; retryAfter: number } {
  return fixedWindowLimit(
    buckets,
    `${tenantSlug}:${ip}`,
    envInt("PRAXIS_BOOKING_RATE_LIMIT", DEFAULT_BOOKING_LIMIT),
  );
}

/**
 * F22 · separate + stricter rate-limit for public lookup/voucher (PII email
 * enumeration + voucher code brute-force). Isolated from booking bucket so
 * booking traffic cannot exhaust (or be exhausted by) lookup probes.
 * Override via PRAXIS_LOOKUP_RATE_LIMIT (default 20 / 15 min).
 */
export function publicLookupRateLimit(
  ip: string,
  tenantSlug: string,
): { ok: true } | { ok: false; status: 429; retryAfter: number } {
  return fixedWindowLimit(
    lookupBuckets,
    `lookup:${tenantSlug}:${ip}`,
    envInt("PRAXIS_LOOKUP_RATE_LIMIT", DEFAULT_LOOKUP_LIMIT),
  );
}

function fixedWindowLimit(
  store: Map<string, Bucket>,
  key: string,
  limit: number,
): { ok: true } | { ok: false; status: 429; retryAfter: number } {
  const now = Date.now();
  const b = store.get(key);
  if (!b || now - b.firstAt > BOOKING_WINDOW_MS) {
    store.set(key, { count: 1, firstAt: now });
    return { ok: true };
  }
  b.count += 1;
  if (b.count > limit) {
    const retryAfter = Math.ceil((b.firstAt + BOOKING_WINDOW_MS - now) / 1000);
    return { ok: false, status: 429, retryAfter: Math.max(1, retryAfter) };
  }
  return { ok: true };
}

/**
 * Optional public booking key (pk_live_… with write:bookings / read:services).
 * Non-breaking: returns null when no Bearer is present. Returns the verified
 * key when a valid key is supplied; throws nothing — caller decides.
 */
export function optionalPublicBookingKey(
  req: Request,
  tenantSlug: string,
  scope: "write:bookings" | "read:services",
) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  const verified = verifyApiKey(token, tenantSlug, scope);
  return verified.ok ? verified.key : null;
}

/** Common CORS + rate-limit headers for booking responses. */
export function bookingHeaders(
  req: Request,
  tenantSlug: string,
  extra?: Record<string, string>,
): Record<string, string> {
  const allowed = bookingAllowedOrigin(req, tenantSlug);
  const headers: Record<string, string> = {
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, idempotency-key, authorization",
    vary: "Origin",
  };
  if (allowed) headers["access-control-allow-origin"] = allowed;
  return { ...headers, ...(extra ?? {}) };
}
