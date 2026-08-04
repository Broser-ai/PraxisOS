import { NextResponse } from "next/server";
import { buildAvailabilitySlots } from "@/lib/calendar";
import { listBookingsForTenant } from "@/lib/data/repo";
import { getTenant } from "@/lib/tenants";

// GET /api/v1/{tenant}/availability?service=ID&from=YYYY-MM-DD&days=7
// Ledige tider minus eksisterende (ikke-cancelled) bookings.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("service");
  const days = Math.min(14, Math.max(1, Number(url.searchParams.get("days") ?? "5")));
  const fromParam = url.searchParams.get("from");
  const service = t.services.find((s) => s.id === serviceId) ?? t.services[0];
  if (!service) {
    return NextResponse.json({ error: "service_not_found" }, { status: 404 });
  }

  const from = fromParam ? new Date(fromParam) : new Date();
  if (Number.isNaN(from.getTime())) {
    return NextResponse.json({ error: "invalid_from" }, { status: 400 });
  }

  const busy = await listBookingsForTenant(slug, { limit: 500 });
  const slots = buildAvailabilitySlots({
    from,
    days,
    durationMin: service.durationMin,
    busy,
  });

  return NextResponse.json(
    {
      service: { id: service.id, name: service.name, durationMin: service.durationMin },
      timezone: t.timezone,
      slots,
      meta: { conflictAware: true, busyCount: busy.filter((b) => b.status !== "cancelled").length },
    },
    {
      headers: {
        "cache-control": "private, max-age=15",
        "access-control-allow-origin": "*",
      },
    },
  );
}
