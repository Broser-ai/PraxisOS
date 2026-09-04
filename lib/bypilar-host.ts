/**
 * byPilar customer hosts — white-label clinic surface (not PraxisOS B2B brand).
 * Keep in sync with middleware.ts BYPILAR_HOSTS.
 */

export const BYPILAR_HOSTS = new Set([
  "app.bypilar.dk",
  "bypilar.dk",
  "www.bypilar.dk",
]);

/** Public clinic OS base for by Pilar (always HTTPS in instructions). */
export const BYPILAR_APP_ORIGIN = "https://app.bypilar.dk";

/** WordPress marketing site (always HTTPS in instructions). */
export const BYPILAR_WP_ORIGIN = "https://bypilar.dk";

export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.toLowerCase().split(":")[0] ?? "";
}

export function isBypilarHost(host: string | null | undefined): boolean {
  return BYPILAR_HOSTS.has(normalizeHost(host));
}

/** Safe internal redirect after staff login (no open redirect). */
export function safeStaffNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return fallback;
  }
  // Block protocol-relative and external; allow staff/clinic paths only.
  const allowedPrefixes = [
    "/dashboard",
    "/kalender",
    "/klienter",
    "/journal",
    "/scan",
    "/admin",
    "/bookings",
    "/review",
    "/scribe",
    "/agent",
    "/chat",
    "/felt",
    "/indstillinger",
    "/setup",
  ];
  if (allowedPrefixes.some((p) => raw === p || raw.startsWith(p + "/"))) {
    return raw;
  }
  return fallback;
}
