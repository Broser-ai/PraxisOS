import { NextResponse } from "next/server";
import { getActiveServices, getTenant } from "@/lib/tenants";

// POST /api/v1/{tenant}/bookings
// Body: { serviceId, startsAt, client: { name, email, phone }, modality, notes?, addOnIds? }
// Idempotency: header "Idempotency-Key" anbefales.
//
// Demo: gemmer ikke noget — returnerer en kvittering. Senere skrives til DB + sender bekræftelse via Aria.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const required = ["serviceId", "startsAt", "client"];
  for (const k of required) if (!body[k]) return NextResponse.json({ error: `missing_${k}` }, { status: 400 });

  const service = getActiveServices(t).find((s) => s.id === body.serviceId);
  if (!service) return NextResponse.json({ error: "service_not_found_or_inactive" }, { status: 404 });

  const addOnIds: string[] = Array.isArray(body.addOnIds) ? body.addOnIds : [];
  const chargedAddOns = (service.addOns ?? []).filter(
    (a) => a.chargeable && a.priceKr != null && addOnIds.includes(a.id)
  );
  const addOnTotal = chargedAddOns.reduce((sum, a) => sum + (a.priceKr ?? 0), 0);

  const bookingId = "bk_" + Math.random().toString(36).slice(2, 11);
  const idempotencyKey = req.headers.get("idempotency-key") ?? bookingId;

  return NextResponse.json({
    id: bookingId,
    tenant: t.slug,
    service: {
      id: service.id,
      name: service.name,
      durationMin: service.durationMin ?? null,
      priceKr: service.priceKr,
    },
    addOns: chargedAddOns.map((a) => ({ id: a.id, name: a.name, priceKr: a.priceKr })),
    priceKr: service.priceKr + addOnTotal,
    startsAt: body.startsAt,
    modality: body.modality ?? "Klinik",
    client: { name: body.client.name, email: body.client.email, phone: body.client.phone },
    status: "confirmed",
    idempotencyKey,
    receiptUrl: `/r/${bookingId}`,
    aria: {
      reminderScheduled: true,
      message: "Tak! Du modtager en bekræftelse på e-mail og en SMS-påmindelse 24 timer før.",
    },
  }, { status: 201, headers: { "access-control-allow-origin": "*" } });
}

// CORS preflight til bypilar.dk
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, idempotency-key, authorization",
      "access-control-max-age": "86400",
    },
  });
}
