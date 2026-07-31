// Rate-limit + brute-force-beskyttelse
//
// Princip:
// - IP-baseret: forhindrer distribuerede angreb
// - User-baseret: forhindrer targeted brute-force (selv hvis attacker roterer IP)
// - Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, max 5min
// - Aldrig lockout (lockout = DoS-vektor); altid backoff + CAPTCHA-step-up
//
// Best practice: bag SaaS-platform CAPTCHA på POST /login (Cloudflare Turnstile)
// + log alle forsøg til audit-log med IP, user-agent, geo.
//
// Sprint 6 · B5: attempt-counters flyttet fra lokale Map til SharedStore.
// Ellers kunne en angriber ramme forskellige serverless-instances og
// omgå backoff’en (hver instance havde sin egen bucket).

import {
  getDefaultSharedStore,
  type SharedStore,
} from "@/lib/shared-store/adapter";
// Side-effect: sikrer memory-store self-registrerer sig som default-factory.
// Prod-runtime der swapper til Redis kalder setDefaultSharedStore() ovenpaa.
import "@/lib/shared-store/memory-store";

const WINDOW_MS = 15 * 60 * 1000; // 15 min sliding window

function ipKey(ip: string): string {
  return `rl:ip:${ip}`;
}

function userKey(email: string): string {
  return `rl:user:${email.toLowerCase()}`;
}

/**
 * Registrer et login-forsøg. Success nulstiller bucketten (både IP + user).
 * Fejl inkrementerer og forlænger sliding-window’ets TTL.
 */
export async function recordAttempt(
  ip: string,
  email: string,
  success: boolean,
  store: SharedStore = getDefaultSharedStore(),
): Promise<void> {
  const keys = [ipKey(ip), userKey(email)];
  for (const k of keys) {
    if (success) {
      await store.resetCounter(k);
      continue;
    }
    const current = await store.getCounter(k);
    // Sliding-window: hvert failed attempt renews TTL så vinduet ruller
    // fra sidste fejl. Prod-Redis backend har atomisk incrby + expire.
    await store.setCounterWithTtl(k, current + 1, WINDOW_MS);
  }
}

/**
 * Returnerer krav om backoff i millisekunder. Baseret på max(ip, user).
 * Exponential fra 4. forsøg: 2s, 4s, 8s ... cappet ved 300s.
 */
export async function getBackoffMs(
  ip: string,
  email: string,
  store: SharedStore = getDefaultSharedStore(),
): Promise<number> {
  const [ipN, userN] = await Promise.all([
    store.getCounter(ipKey(ip)),
    store.getCounter(userKey(email)),
  ]);
  const worst = Math.max(ipN, userN);
  if (worst < 3) return 0;
  const ms = Math.min(300_000, Math.pow(2, worst - 3) * 1000);
  return ms;
}

/** CAPTCHA-step-up fra 3+ fejl (matcher backoff-threshold). */
export async function requiresCaptcha(
  ip: string,
  email: string,
  store: SharedStore = getDefaultSharedStore(),
): Promise<boolean> {
  const [ipN, userN] = await Promise.all([
    store.getCounter(ipKey(ip)),
    store.getCounter(userKey(email)),
  ]);
  return Math.max(ipN, userN) >= 3;
}

export async function getAttempts(
  ip: string,
  email: string,
  store: SharedStore = getDefaultSharedStore(),
): Promise<{ ip: number; user: number }> {
  const [ipN, userN] = await Promise.all([
    store.getCounter(ipKey(ip)),
    store.getCounter(userKey(email)),
  ]);
  return { ip: ipN, user: userN };
}

// ---------------------------------------------------------------------------
// Audit-log · uændret; renderes af dashboardet.
// ---------------------------------------------------------------------------

export type AttemptLog = {
  at: string;
  ip: string;
  email: string;
  success: boolean;
  userAgent: string;
  geo?: string;
  blocked?: boolean;
  reason?: string;
};

const attemptLog: AttemptLog[] = [
  { at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), ip: "62.198.4.117", email: "pilar@bypilar.dk", success: true, userAgent: "Chrome 138 · macOS", geo: "Aarhus, DK" },
  { at: new Date(Date.now() - 1000 * 60 * 22).toISOString(), ip: "85.184.91.4", email: "sofie@bypilar.dk", success: true, userAgent: "Safari 18 · iOS", geo: "København, DK" },
  { at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), ip: "203.0.113.7", email: "admin@bypilar.dk", success: false, userAgent: "curl/8.5", geo: "Shenzhen, CN", blocked: true, reason: "ip_rate_limit · 6 forsøg" },
  { at: new Date(Date.now() - 1000 * 60 * 47).toISOString(), ip: "203.0.113.7", email: "admin@bypilar.dk", success: false, userAgent: "curl/8.5", geo: "Shenzhen, CN", reason: "wrong_password" },
  { at: new Date(Date.now() - 1000 * 60 * 50).toISOString(), ip: "203.0.113.7", email: "pilar@bypilar.dk", success: false, userAgent: "curl/8.5", geo: "Shenzhen, CN", reason: "wrong_password" },
  { at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), ip: "62.198.4.117", email: "pilar@bypilar.dk", success: true, userAgent: "Chrome 138 · macOS", geo: "Aarhus, DK" },
  { at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), ip: "185.220.101.45", email: "test@bypilar.dk", success: false, userAgent: "Firefox 122 · Linux", geo: "TOR exit-node", blocked: true, reason: "anomaly · TOR + unknown_email" },
];

export function listAttempts(limit = 20): AttemptLog[] {
  return attemptLog.slice(0, limit);
}
