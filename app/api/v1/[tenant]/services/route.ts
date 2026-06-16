import { NextResponse } from "next/server";
import { getTenant, hasModule } from "@/lib/tenants";

// GET /api/v1/{tenant}/services
// Public booking-API — bruges af bypilar.dk's eksisterende frontend (headless mode).
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
        bookUrl: `${origin(req)}/embed/v1/${t.slug}/book?service=${s.id}`,
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
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
