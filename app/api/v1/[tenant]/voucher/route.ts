// GET /api/v1/{tenant}/voucher?code=GIFT-XXXX-YYYY&service=fod-med
// Validér voucher-kode og se hvad den dækker
import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { findVoucherByCode } from "@/lib/vouchers";
import {
  publicLookupRateLimit,
  clientIp,
  bookingAllowedOrigin,
} from "@/lib/public-booking-kit";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant: slug } = await params;
  const t = getTenant(slug);
  if (!t) return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });

  // F22 · stricter separate rate-limit (code brute-force control).
  const limit = publicLookupRateLimit(clientIp(req), slug);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: limit.retryAfter },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  const headers: Record<string, string> = { vary: "Origin" };
  const allowed = bookingAllowedOrigin(req, slug);
  if (allowed) headers["access-control-allow-origin"] = allowed;

  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  const serviceId = url.searchParams.get("service");

  // F48 · reject short / empty codes before store probe (brute-force friction)
  if (!code || code.length < 6) {
    return NextResponse.json(
      { valid: false, error: "invalid_code" },
      { status: 400, headers },
    );
  }

  const v = findVoucherByCode(code, slug);
  if (!v) {
    return NextResponse.json({ valid: false, error: "Ukendt kode" }, {
      status: 404,
      headers,
    });
  }

  if (v.status !== "active") {
    return NextResponse.json({ valid: false, error: `Voucher er ${v.status}` }, {
      headers,
    });
  }

  if (new Date(v.expiresAt) < new Date()) {
    return NextResponse.json({ valid: false, error: "Voucher er udløbet" }, {
      headers,
    });
  }

  // Klippekort skal matche ydelsen
  if (v.kind === "clip" && v.serviceId !== serviceId) {
    return NextResponse.json({
      valid: false,
      error: `Klippekortet er kun gyldigt til "${v.serviceName}"`,
    }, { headers });
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
  }, { headers });
}
