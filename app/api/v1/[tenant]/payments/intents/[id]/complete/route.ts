import { NextResponse } from "next/server";
import {
  completePaymentIntent,
  intentPublicView,
} from "@/lib/payments/intents";
import { getTenant } from "@/lib/tenants";

/** Complete / authorize / capture an intent (mock always; live MobilePay when configured). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
) {
  const { tenant, id } = await params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const result = await completePaymentIntent({ tenant, id });
  if ("error" in result) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "mobilepay_not_configured"
          ? 503
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(intentPublicView(result));
}
