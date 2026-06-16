import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";

// GET /api/v1/{tenant}/availability?service=ID&from=YYYY-MM-DD&days=7
// Returnerer ledige tider — mock-generator, swappes til ægte kalender-engine senere.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("service");
  const days = Math.min(14, Math.max(1, Number(url.searchParams.get("days") ?? "5")));
  const fromParam = url.searchParams.get("from");
  const service = t.services.find((s) => s.id === serviceId) ?? t.services[0];

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

  return NextResponse.json(
    {
      service: { id: service.id, name: service.name, durationMin: service.durationMin },
      timezone: t.timezone,
      slots,
    },
    {
      headers: {
        "cache-control": "public, max-age=30",
        "access-control-allow-origin": "*",
      },
    }
  );
}
