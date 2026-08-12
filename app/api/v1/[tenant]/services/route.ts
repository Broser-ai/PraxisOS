import { NextResponse } from "next/server";
import { getActiveServices, getTenant, hasModule } from "@/lib/tenants";

// GET /api/v1/{tenant}/services
// Public booking-API — used by bypilar.dk (headless) + /t/{tenant}/book
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

  const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "1";
  const list = includeInactive ? t.services : getActiveServices(t);

  return NextResponse.json(
    {
      tenant: {
        slug: t.slug,
        name: t.brand.name,
        currency: t.currency,
        locale: t.locale,
        timezone: t.timezone,
        tagline: t.brand.tagline,
      },
      services: list.map((s) => ({
        id: s.id,
        name: s.name,
        shortDescription: s.shortDescription ?? s.description,
        description: s.description,
        durationMin: s.durationMin ?? null,
        price: s.priceKr,
        currency: t.currency,
        category: s.category,
        modality: s.modality,
        active: s.active !== false,
        bookable: s.bookable !== false && s.active !== false,
        addOns: (s.addOns ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          price: a.chargeable ? (a.priceKr ?? null) : null,
          durationMin: a.durationMin ?? null,
          chargeable: a.chargeable,
          reviewNote: a.reviewNote ?? null,
        })),
        reviewNotes: s.reviewNotes ?? [],
        bookUrl: `${origin(req)}/t/${t.slug}/book?service=${encodeURIComponent(s.id)}`,
        embedBookUrl: `${origin(req)}/t/${t.slug}/book?embed=1&service=${encodeURIComponent(s.id)}`,
      })),
    },
    {
      headers: {
        "cache-control": "public, max-age=60",
        "access-control-allow-origin": "*",
      },
    }
  );
}

function origin(req: Request) {
  const configured = (process.env.PRAXIS_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "")
    .replace(/\/$/, "");
  if (configured && !configured.includes("0.0.0.0") && !configured.includes("localhost")) {
    return configured;
  }
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "http";
  if (host && !host.startsWith("0.0.0.0") && !host.includes("praxisos")) {
    return `${proto}://${host}`;
  }
  return "http://app.bypilar.dk";
}
