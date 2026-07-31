// API-keys management · PraxisOS Universal API
//
// Hver tenant kan oprette flere API-keys med forskellige scopes og rate-limits.
// Format: pk_live_xxx (public/visible) eller sk_live_xxx (secret/server)
// Bearer-token auth: Authorization: Bearer sk_live_xxx
//
// Secrets marked with **** are display-masked and cannot authenticate.
// verifyApiKey() requires an exact match against a full active secret.

import { createHash, timingSafeEqual } from "node:crypto";

export type ApiKeyScope =
  | "read:bookings" | "write:bookings"
  | "read:clients" | "write:clients"
  | "read:journal" | "write:journal"
  | "read:services" | "write:services"
  | "read:payments" | "write:payments"
  | "read:vouchers" | "write:vouchers"
  | "read:subsidies"
  | "webhooks:manage"
  | "*"; // alle scopes

export type ApiKey = {
  id: string;
  tenant: string;
  name: string;
  prefix: string;       // pk_live_xxxxxxxx · synlig
  hashedSecret: string; // sk_live_xxxxxxxx · vises kun ved oprettelse
  scopes: ApiKeyScope[];
  rateLimit: number;    // req/min
  createdBy: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  status: "active" | "revoked";
  // For UI: requests sidste 7 dage
  recentUsage: { date: string; count: number }[];
};

// SEED
function days(offset: number) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString();
}

function usage7d(base: number) {
  return Array.from({ length: 7 }, (_, i) => ({
    date: days(-6 + i).slice(0, 10),
    count: Math.round(base * (0.5 + Math.abs(Math.sin(i * 0.7)) * 1.2)),
  }));
}

export const apiKeys: ApiKey[] = [
  {
    id: "key_001",
    tenant: "bypilar",
    name: "bypilar.dk · production",
    prefix: "pk_live_8f2a9c47bf24",
    hashedSecret: "sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47",
    scopes: ["read:bookings", "write:bookings", "read:services", "read:clients", "write:clients", "webhooks:manage"],
    rateLimit: 600,
    createdBy: "Pilar Mortensen",
    createdAt: days(-90),
    lastUsedAt: days(0).replace(/T.*/, "T08:47:21Z"),
    status: "active",
    recentUsage: usage7d(820),
  },
  {
    id: "key_002",
    tenant: "bypilar",
    name: "Webflow embed widget",
    prefix: "pk_live_3e1b8a2c9f47",
    // Masked in UI listings — cannot authenticate until rotated to a full secret
    hashedSecret: "sk_live_3e1b8a2c9f47****",
    scopes: ["read:services"],
    rateLimit: 120,
    createdBy: "Pilar Mortensen",
    createdAt: days(-30),
    lastUsedAt: days(0).replace(/T.*/, "T09:12:04Z"),
    status: "active",
    recentUsage: usage7d(180),
  },
  {
    id: "key_003",
    tenant: "bypilar",
    name: "Zapier connector · regnskab",
    prefix: "pk_live_a72f4d18c0e9",
    hashedSecret: "sk_live_a72f4d18c0e9****",
    scopes: ["read:bookings", "read:payments"],
    rateLimit: 60,
    createdBy: "Pilar Mortensen",
    createdAt: days(-7),
    lastUsedAt: days(-1),
    status: "active",
    recentUsage: usage7d(40),
  },
  {
    id: "key_004",
    tenant: "bypilar",
    name: "Test-key · sandbox",
    prefix: "pk_test_dead0000beef",
    hashedSecret: "sk_test_dead0000beef0000",
    scopes: ["*"],
    rateLimit: 100,
    createdBy: "Pilar Mortensen",
    createdAt: days(-180),
    status: "revoked",
    recentUsage: usage7d(0),
  },
  {
    id: "key_005",
    tenant: "nordlys",
    name: "nordlys.dk · production",
    prefix: "pk_live_9d3e5b8a4c12",
    hashedSecret: "sk_live_9d3e5b8a4c12f0e1d2c3b4a5968778",
    scopes: ["*"],
    rateLimit: 1000,
    createdBy: "Nadia Berg",
    createdAt: days(-60),
    lastUsedAt: days(0),
    status: "active",
    recentUsage: usage7d(1200),
  },
];

function isMaskedSecret(secret: string): boolean {
  return secret.includes("*");
}

function safeEqualStr(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function scopeAllows(key: ApiKey, required?: ApiKeyScope): boolean {
  if (!required) return true;
  if (key.scopes.includes("*")) return true;
  return key.scopes.includes(required);
}

/**
 * Verify a raw Bearer secret against in-memory (and later DB) API keys.
 * Rejects revoked keys, masked display secrets, wrong tenant, and missing scopes.
 */
export function verifyApiKey(
  token: string,
  tenant: string,
  requiredScope?: ApiKeyScope,
): { ok: true; key: ApiKey } | { ok: false; error: string } {
  if (!token || token.length < 16) {
    return { ok: false, error: "invalid_token" };
  }
  if (
    !token.startsWith("sk_live_") &&
    !token.startsWith("sk_test_") &&
    !token.startsWith("pk_live_") &&
    !token.startsWith("pk_test_")
  ) {
    return { ok: false, error: "invalid_token" };
  }

  const candidates = apiKeys.filter(
    (k) =>
      k.tenant === tenant &&
      k.status === "active" &&
      !isMaskedSecret(k.hashedSecret),
  );

  const match = candidates.find((k) => safeEqualStr(k.hashedSecret, token));
  if (!match) {
    // Distinguish revoked exact match for clearer ops debugging
    const revoked = apiKeys.find(
      (k) =>
        k.tenant === tenant &&
        k.status === "revoked" &&
        !isMaskedSecret(k.hashedSecret) &&
        safeEqualStr(k.hashedSecret, token),
    );
    if (revoked) return { ok: false, error: "key_revoked" };
    return { ok: false, error: "invalid_token" };
  }

  if (!scopeAllows(match, requiredScope)) {
    return { ok: false, error: "insufficient_scope" };
  }

  match.lastUsedAt = new Date().toISOString();
  return { ok: true, key: match };
}

/** Mask secret for UI — never echo full sk_ back to clients. */
export function maskApiKeySecret(secret: string): string {
  if (secret.length < 12) return "****";
  return `${secret.slice(0, 12)}****`;
}

export function listApiKeys(tenant: string): ApiKey[] {
  return apiKeys
    .filter((k) => k.tenant === tenant)
    .map((k) => ({
      ...k,
      hashedSecret: isMaskedSecret(k.hashedSecret)
        ? k.hashedSecret
        : maskApiKeySecret(k.hashedSecret),
    }));
}

export const SCOPE_LABEL: Record<ApiKeyScope, string> = {
  "read:bookings": "Læs bookings",
  "write:bookings": "Skriv bookings",
  "read:clients": "Læs klienter",
  "write:clients": "Skriv klienter",
  "read:journal": "Læs journaler",
  "write:journal": "Skriv journaler",
  "read:services": "Læs ydelser",
  "write:services": "Skriv ydelser",
  "read:payments": "Læs betalinger",
  "write:payments": "Skriv betalinger",
  "read:vouchers": "Læs vouchers",
  "write:vouchers": "Skriv vouchers",
  "read:subsidies": "Læs tilskud",
  "webhooks:manage": "Webhooks",
  "*": "Fuld adgang",
};

// Webhook subscriptions per tenant
export type WebhookSubscription = {
  id: string;
  tenant: string;
  url: string;
  events: string[];
  active: boolean;
  hmacSecret: string;
  createdAt: string;
  lastDeliveryAt?: string;
  lastStatus?: number;
};

export const webhookSubs: WebhookSubscription[] = [
  {
    id: "whk_001",
    tenant: "bypilar",
    url: "https://bypilar.dk/api/praxis-webhook",
    events: ["booking.created", "booking.cancelled", "payment.captured"],
    active: true,
    hmacSecret: "whsec_****8a47",
    createdAt: days(-90),
    lastDeliveryAt: days(0).replace(/T.*/, "T07:32:18Z"),
    lastStatus: 200,
  },
  {
    id: "whk_002",
    tenant: "bypilar",
    url: "https://hooks.zapier.com/hooks/catch/12345/praxis-bookings",
    events: ["booking.created", "booking.completed"],
    active: true,
    hmacSecret: "whsec_****ef12",
    createdAt: days(-30),
    lastDeliveryAt: days(-1),
    lastStatus: 200,
  },
];
