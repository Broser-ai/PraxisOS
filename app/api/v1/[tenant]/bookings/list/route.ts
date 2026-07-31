// GET /api/v1/{tenant}/bookings/list · liste over bookings (session eller verified Bearer)

import { NextResponse } from "next/server";
import {
  dataBackend,
  listBookingsForTenant,
} from "@/lib/data/repo";
import type { BookingStatus } from "@/lib/bookings";
import { authorizeTenantRequest } from "@/lib/request-auth";
import { getTenant } from "@/lib/tenants";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const auth = authorizeTenantRequest(req, tenant, "read:bookings");
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const url = new URL(req.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? "25"));
  const status = url.searchParams.get("status") as BookingStatus | null;

  const bookings = await listBookingsForTenant(tenant, {
    status: status ?? undefined,
    limit,
  });

  return NextResponse.json(
    {
      data: bookings.map((b) => ({
        id: b.id,
        status: b.status,
        startsAt: b.startsAt,
        durationMin: b.durationMin,
        service: { id: b.serviceId, name: b.service },
        client: { id: b.clientId, name: b.clientName },
        practitioner: b.practitioner,
        modality: b.modality,
        priceKr: b.priceKr,
        paid: b.paid,
      })),
      meta: {
        count: bookings.length,
        limit,
        tenant,
        backend: dataBackend(),
        auth: auth.mode,
      },
    },
    { headers: { "access-control-allow-origin": "*" } },
  );
}
