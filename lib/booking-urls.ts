/**
 * Public booking URL helpers for by Pilar / multi-tenant PraxisOS.
 *
 * White-label rule: customer-facing hosts (bypilar.dk, app.bypilar.dk patient
 * surfaces) must never advertise "Planway" or require Planway. Staff entry
 * uses "Klinik" / "Kom i gang" / app.bypilar.dk — not the PraxisOS product name.
 *
 * Clinical invariant: booking URLs only open the public book flow; they do not
 * auto-merge clinical records (NO_AUTO_MERGE / suggestion_only elsewhere).
 */

export const BYPILAR_PUBLIC_ORIGIN = "https://app.bypilar.dk";
export const BYPILAR_TENANT = "bypilar";
export const BYPILAR_BOOK_PATH = `/t/${BYPILAR_TENANT}/book`;

/** Canonical patient booking URL (HTTPS only). */
export const BYPILAR_BOOK_URL = `${BYPILAR_PUBLIC_ORIGIN}${BYPILAR_BOOK_PATH}`;

/** Embeddable booking URL for WordPress iframe / modal. */
export const BYPILAR_BOOK_EMBED_URL = `${BYPILAR_BOOK_URL}?embed=1`;

/** Staff clinic entry on byPilar host — white-label (no "PraxisOS" label). */
export const BYPILAR_KLINIK_URL = `${BYPILAR_PUBLIC_ORIGIN}/login`;
export const BYPILAR_KOM_I_GANG_URL = `${BYPILAR_PUBLIC_ORIGIN}/t/${BYPILAR_TENANT}`;

const PLANWAY_HOST_RE = /(^|\.)planway\.com$/i;

/**
 * Resolve the public origin used in API bookUrl fields.
 * Prefers PRAXIS_PUBLIC_BASE_URL / NEXT_PUBLIC_BASE_URL, else request origin,
 * else the byPilar production origin.
 */
export function publicBookingOrigin(req?: Request): string {
  const fromEnv =
    process.env.PRAXIS_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      // fall through
    }
  }
  if (req) {
    try {
      const url = new URL(req.url);
      return `${url.protocol}//${url.host}`;
    } catch {
      // fall through
    }
  }
  return BYPILAR_PUBLIC_ORIGIN;
}

export type BookUrlOptions = {
  service?: string | null;
  embed?: boolean;
  origin?: string;
};

/** Build `/t/{tenant}/book` URL with optional service + embed=1. */
export function publicBookUrl(
  tenant: string,
  opts: BookUrlOptions = {},
): string {
  const origin = (opts.origin ?? BYPILAR_PUBLIC_ORIGIN).replace(/\/$/, "");
  const url = new URL(`${origin}/t/${encodeURIComponent(tenant)}/book`);
  if (opts.service) url.searchParams.set("service", opts.service);
  if (opts.embed) url.searchParams.set("embed", "1");
  return url.toString();
}

export function embedBookUrl(
  tenant: string,
  service?: string | null,
  origin?: string,
): string {
  return publicBookUrl(tenant, { service, embed: true, origin });
}

/** True if URL host is Planway (legacy — must not appear on byPilar surfaces). */
export function isPlanwayUrl(href: string): boolean {
  try {
    const host = new URL(href).hostname.toLowerCase();
    return PLANWAY_HOST_RE.test(host);
  } catch {
    return /planway\.com/i.test(href);
  }
}

/**
 * Rewrite a Planway booking href to the PraxisOS byPilar book URL.
 * Unknown Planway paths map to the generic book page.
 */
export function rewritePlanwayToPraxis(
  href: string,
  opts: { service?: string | null; embed?: boolean } = {},
): string {
  if (!isPlanwayUrl(href) && !/planway/i.test(href)) {
    return href;
  }
  return publicBookUrl(BYPILAR_TENANT, {
    service: opts.service,
    embed: opts.embed ?? /\/book/i.test(href),
    origin: BYPILAR_PUBLIC_ORIGIN,
  });
}

/** Staff entry href + white-label label for byPilar customer hosts. */
export function byPilarStaffEntry(): { href: string; label: string; sublabel: string } {
  return {
    href: BYPILAR_KLINIK_URL,
    label: "Kom i gang",
    sublabel: "Klinik",
  };
}
