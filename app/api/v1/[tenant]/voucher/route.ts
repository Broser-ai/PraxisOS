// GET /api/v1/{tenant}/voucher?code=GIFT-XXXX-YYYY&service=fod-med
// Validér voucher-kode og se hvad den dækker
import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { findVoucherByCode } from "@/lib/vouchers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const serviceId = url.searchParams.get("service");

  const v = findVoucherByCode(code, slug);
  if (!v) {
    return NextResponse.json({ valid: false, error: "Ukendt kode" }, {
      status: 404,
      headers: { "access-control-allow-origin": "*" },
    });
  }

  if (v.status !== "active") {
    return NextResponse.json({ valid: false, error: `Voucher er ${v.status}` }, {
      headers: { "access-control-allow-origin": "*" },
    });
  }

  if (new Date(v.expiresAt) < new Date()) {
    return NextResponse.json({ valid: false, error: "Voucher er udløbet" }, {
      headers: { "access-control-allow-origin": "*" },
    });
  }

  // Klippekort skal matche ydelsen
  if (v.kind === "clip" && v.serviceId !== serviceId) {
    return NextResponse.json({
      valid: false,
      error: `Klippekortet er kun gyldigt til "${v.serviceName}"`,
    }, { headers: { "access-control-allow-origin": "*" } });
  }

  return NextResponse.json({
    valid: true,
    voucher: {
      code: v.code,
      kind: v.kind,
      sessionsRemaining: v.sessionsRemaining,
      balanceKr: v.balanceOere ? v.balanceOere / 100 : undefined,
      serviceName: v.serviceName,
      expiresAt: v.expiresAt,
    },
  }, { headers: { "access-control-allow-origin": "*" } });
}
