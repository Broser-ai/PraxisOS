/**
 * Resolve the public HTTPS origin behind Traefik / reverse proxies.
 *
 * Internal Next `req.url` often shows `http://0.0.0.0:3000` when the
 * container binds HOSTNAME=0.0.0.0 — never use that for bookUrl / embed
 * iframe ORIGIN (breaks by Pilar WordPress embeds + postMessage handshake).
 *
 * Priority:
 *  1. PRAXIS_PUBLIC_BASE_URL / NEXT_PUBLIC_BASE_URL (explicit ops pin)
 *  2. X-Forwarded-Proto + X-Forwarded-Host / Host
 *  3. req.url fallback (dev)
 */

function envBaseOrigin(): string | null {
  for (const key of ["PRAXIS_PUBLIC_BASE_URL", "NEXT_PUBLIC_BASE_URL"] as const) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    try {
      const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
      if (u.hostname === "0.0.0.0" || u.hostname === "127.0.0.1") continue;
      return u.origin;
    } catch {
      // ignore malformed
    }
  }
  return null;
}

function forwardedOrigin(req: Request): string | null {
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-protocol")?.split(",")[0]?.trim();
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.trim();
  if (!host) return null;
  if (host.startsWith("0.0.0.0") || host.startsWith("127.0.0.1")) return null;
  const scheme = proto === "http" || proto === "https" ? proto : "https";
  return `${scheme}://${host}`;
}

function requestUrlOrigin(req: Request): string {
  try {
    const u = new URL(req.url);
    if (u.hostname === "0.0.0.0" || u.hostname === "127.0.0.1") {
      // Prefer https public host when only bind-address is known
      return envBaseOrigin() ?? "https://app.bypilar.dk";
    }
    return u.origin;
  } catch {
    return envBaseOrigin() ?? "https://app.bypilar.dk";
  }
}

/** Public origin for customer-facing URLs (book links, embed script ORIGIN). */
export function publicOrigin(req: Request): string {
  return envBaseOrigin() ?? forwardedOrigin(req) ?? requestUrlOrigin(req);
}
