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

type Bucket = { attempts: number; firstAt: number; lastAt: number };

const ipBuckets = new Map<string, Bucket>();
const userBuckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000; // 15 min sliding window

export function recordAttempt(ip: string, email: string, success: boolean) {
  const now = Date.now();
  for (const [key, bucket, isIp] of [
    [ip, ipBuckets.get(ip), true] as const,
    [email.toLowerCase(), userBuckets.get(email.toLowerCase()), false] as const,
  ]) {
    const store = isIp ? ipBuckets : userBuckets;
    if (!bucket || now - bucket.firstAt > WINDOW_MS) {
      store.set(key, { attempts: success ? 0 : 1, firstAt: now, lastAt: now });
    } else {
      bucket.attempts = success ? 0 : bucket.attempts + 1;
      bucket.lastAt = now;
      store.set(key, bucket);
    }
  }
}

export function getBackoffMs(ip: string, email: string): number {
  const ipB = ipBuckets.get(ip);
  const userB = userBuckets.get(email.toLowerCase());
  const worst = Math.max(ipB?.attempts ?? 0, userB?.attempts ?? 0);
  if (worst < 3) return 0;
  // Exponential: 4. forsøg = 2s, 5. = 4s, 6. = 8s ... cappet ved 300s
  const ms = Math.min(300_000, Math.pow(2, worst - 3) * 1000);
  return ms;
}

export function requiresCaptcha(ip: string, email: string): boolean {
  const ipB = ipBuckets.get(ip);
  const userB = userBuckets.get(email.toLowerCase());
  return Math.max(ipB?.attempts ?? 0, userB?.attempts ?? 0) >= 3;
}

export function getAttempts(ip: string, email: string): { ip: number; user: number } {
  return {
    ip: ipBuckets.get(ip)?.attempts ?? 0,
    user: userBuckets.get(email.toLowerCase())?.attempts ?? 0,
  };
}

// For audit-log dashboard
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

// ---------------------------------------------------------------------------
// F32 · generic fixed-window IP rate-limit (CVR / DAWA / other public proxies)
// ---------------------------------------------------------------------------

type IpBucket = { count: number; firstAt: number };
const ipFixedWindows = new Map<string, IpBucket>();

/** Test helper — clear IP fixed-window buckets. */
export function _resetIpRateLimitForTests(): void {
  ipFixedWindows.clear();
}

/**
 * Fixed-window per-IP rate limit.
 * @returns { ok: true } or { ok: false, retryAfterMs }
 */
export function checkIpRateLimit(
  ip: string,
  opts: { key: string; limit: number; windowMs: number },
): { ok: true } | { ok: false; retryAfterMs: number } {
  const storeKey = `${opts.key}:${ip || "unknown"}`;
  const now = Date.now();
  const bucket = ipFixedWindows.get(storeKey);
  if (!bucket || now - bucket.firstAt > opts.windowMs) {
    ipFixedWindows.set(storeKey, { count: 1, firstAt: now });
    return { ok: true };
  }
  if (bucket.count >= opts.limit) {
    const retryAfterMs = Math.max(0, opts.windowMs - (now - bucket.firstAt));
    return { ok: false, retryAfterMs };
  }
  bucket.count += 1;
  ipFixedWindows.set(storeKey, bucket);
  return { ok: true };
}
