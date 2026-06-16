// GET /api/v1/{tenant}/bookings/list  · liste over bookings (kræver token)
import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { listBookings } from "@/lib/bookings";

export async function GET(req: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  if (!getTenant(tenant)) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? "25"));
  const status = url.searchParams.get("status") as any;

  let bookings = listBookings({ tenant, status: status ? [status] : undefined });
  bookings = bookings.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()).slice(0, limit);

  return NextResponse.json({
    data: bookings.map((b) => ({
      id: b.id, status: b.status, startsAt: b.startsAt, durationMin: b.durationMin,
      service: { id: b.serviceId, name: b.service }, client: { id: b.clientId, name: b.clientName },
      practitioner: b.practitioner, modality: b.modality, priceKr: b.priceKr, paid: b.paid,
    })),
    meta: { count: bookings.length, limit, tenant },
  }, { headers: { "access-control-allow-origin": "*" } });
}
