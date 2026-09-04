import { NextResponse } from "next/server";
import { getTenant, hasModule } from "@/lib/tenants";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { bookingAllowedOrigin, clientIp } from "@/lib/public-booking-kit";
import { publicOrigin } from "@/lib/public-origin";

// GET /api/v1/{tenant}/services
// Public booking-API — bruges af bypilar.dk's eksisterende frontend (headless mode).
// F65 · ACAO aligns with booking CORS allowlist (same as F6/F60).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) {
    return NextResponse.json({ error: "tenant_not_found", slug }, { status: 404 });
  }
  if (!hasModule(t, "booking")) {
    return NextResponse.json({ error: "module_not_licensed", module: "booking" }, { status: 402 });
  }

  // F51 · public GET rate-limit (scrape / abuse control)
  const limit = checkIpRateLimit(clientIp(req), {
    key: `services-get:${slug}`,
    limit: 120,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
      },
    );
  }

  const headers: Record<string, string> = {
    "cache-control": "public, max-age=60",
    vary: "Origin",
  };
  const allowed = bookingAllowedOrigin(req, t.slug);
  if (allowed) headers["access-control-allow-origin"] = allowed;

  return NextResponse.json(
    {
      tenant: { slug: t.slug, name: t.brand.name, currency: t.currency, locale: t.locale, timezone: t.timezone },
      services: t.services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMin: s.durationMin,
        price: s.priceKr,
        currency: t.currency,
        category: s.category,
        modality: s.modality,
        bookUrl: `${publicOrigin(req)}/t/${t.slug}/book?service=${s.id}`,
      })),
    },
    { headers },
  );
}
