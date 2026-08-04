import { NextResponse } from "next/server";
import {
  createPaymentIntent,
  intentPublicView,
  listPaymentIntents,
  mobilepayConfigured,
  paymentsMode,
} from "@/lib/payments/intents";
import type { PaymentMethod } from "@/lib/payments";
import { getTenant } from "@/lib/tenants";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }
  const data = listPaymentIntents(tenant).map(intentPublicView);
  return NextResponse.json({
    data,
    meta: {
      tenant,
      paymentsMode: paymentsMode(),
      mobilepayConfigured: mobilepayConfigured(),
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  let body: {
    amountKr?: number;
    method?: PaymentMethod;
    bookingId?: string;
    mobilepayPhone?: string;
    returnUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.amountKr || !body.method) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const intent = createPaymentIntent({
    tenant,
    amountKr: body.amountKr,
    method: body.method,
    bookingId: body.bookingId,
    mobilepayPhone: body.mobilepayPhone,
    returnUrl: body.returnUrl,
  });
  if ("error" in intent) {
    const status = intent.error === "risk_declined" ? 403 : 400;
    return NextResponse.json({ error: intent.error }, { status });
  }

  return NextResponse.json(
    {
      ...intentPublicView(intent),
      meta: {
        paymentsMode: paymentsMode(),
        mobilepayConfigured: mobilepayConfigured(),
      },
    },
    { status: 201 },
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}
