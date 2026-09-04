import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { bookingAllowedOrigin, clientIp } from "@/lib/public-booking-kit";

// GET /api/v1/{tenant}/availability?service=ID&from=YYYY-MM-DD&days=7
// Returnerer ledige tider — mock-generator, swappes til ægte kalender-engine senere.
// F65 · ACAO aligns with booking CORS allowlist (same as F6/F60).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });

  // F51 · public GET rate-limit
  const limit = checkIpRateLimit(clientIp(req), {
    key: `availability-get:${slug}`,
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

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("service");
  const days = Math.min(14, Math.max(1, Number(url.searchParams.get("days") ?? "5")));
  const fromParam = url.searchParams.get("from");
  // Do not silently fall back to services[0] — WP/marketing IDs must match
  // tenant catalog or the client books the wrong treatment.
  if (!serviceId) {
    return NextResponse.json({ error: "missing_service" }, { status: 400 });
  }
  const service = t.services.find((s) => s.id === serviceId);
  if (!service) {
    return NextResponse.json(
      { error: "service_not_found", serviceId },
      { status: 404 },
    );
  }

  const from = fromParam ? new Date(fromParam) : new Date();
  const slots: { day: string; times: string[] }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const dow = d.getDay(); // 0 = søndag
    if (dow === 0) continue; // lukket søndag
    const isSat = dow === 6;
    const base = isSat ? ["09:00", "10:30", "12:00", "13:30"] : ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30"];
    // pseudo-random hul: spring ét slot over på onsdage
    const times = dow === 3 ? base.slice(1) : base;
    slots.push({ day: d.toISOString().slice(0, 10), times });
  }

  const headers: Record<string, string> = {
    "cache-control": "public, max-age=30",
    vary: "Origin",
  };
  const allowed = bookingAllowedOrigin(req, t.slug);
  if (allowed) headers["access-control-allow-origin"] = allowed;

  return NextResponse.json(
    {
      service: { id: service.id, name: service.name, durationMin: service.durationMin },
      timezone: t.timezone,
      slots,
    },
    { headers },
  );
}
