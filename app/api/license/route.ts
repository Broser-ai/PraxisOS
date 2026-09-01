import { NextResponse } from "next/server";
import { getPlan, isPlanId, listLicenseOrders } from "@/lib/plans";
import { activateTenantLicense, getTenant, setTenantPlan } from "@/lib/tenants";

/**
 * GET /api/license?tenant=slug — ordrer for tenant
 * POST /api/license — aktiver / skift plan (mock B2B SaaS billing)
 * Body: { tenant, action: "activate" | "change_plan", planId? }
 */
export async function GET(req: Request) {
  const tenant = new URL(req.url).searchParams.get("tenant") ?? undefined;
  return NextResponse.json({
    orders: listLicenseOrders(tenant),
    plans: undefined,
  });
}

export async function POST(req: Request) {
  let body: { tenant?: string; action?: string; planId?: string; seats?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const slug = body.tenant?.trim() ?? "";
  if (!slug || !getTenant(slug)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const action = body.action ?? "activate";

  if (action === "change_plan") {
    if (!body.planId || !isPlanId(body.planId)) {
      return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
    }
    const result = setTenantPlan(slug, body.planId, {
      activate: true,
      seats: body.seats,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const plan = getPlan(body.planId);
    return NextResponse.json({
      success: true,
      action: "change_plan",
      tenant: {
        slug: result.slug,
        planId: result.license.planId,
        plan: result.license.plan,
        status: result.license.status,
        modules: result.license.modules,
        seats: result.license.seats,
        expiresAt: result.license.expiresAt,
      },
      chargedKr: plan.priceMonthlyKr,
      message: `Licens opdateret til ${plan.name}. Mock-betaling registreret.`,
    });
  }

  // activate trial → paid
  const result = activateTenantLicense(slug);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const plan = getPlan(String(result.license.planId));
  return NextResponse.json({
    success: true,
    action: "activate",
    tenant: {
      slug: result.slug,
      planId: result.license.planId,
      plan: result.license.plan,
      status: result.license.status,
      modules: result.license.modules,
      seats: result.license.seats,
      expiresAt: result.license.expiresAt,
    },
    chargedKr: plan.priceMonthlyKr,
    message:
      plan.priceMonthlyKr === 0
        ? "Starter-licens aktiveret."
        : `Mock-betaling ${plan.priceMonthlyKr} kr/md · licens aktiv.`,
  });
}
