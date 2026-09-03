// GET /api/v1/{tenant}/lookup?email=jane@example.com&service=fod-med
// Bruges af booking-flow til at slå op:
//   - er klienten kendt? (returnerer subsidy-profil hvis ja)
//   - er der vouchers (klippekort/gavekort) registreret på samme email?
//   - hvilke tilskud kan klienten få på den valgte ydelse?
//
// Hvis email ikke matcher noget, returneres tom — flowet fortsætter som ny klient.
import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { findClientByEmail } from "@/lib/clients";
import { calculateSubsidies, patientProfiles, SCHEME_LABEL, SCHEME_AUTHORITY } from "@/lib/subsidies";
import { listVouchers } from "@/lib/vouchers";
import {
  bookingRateLimit,
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

  // Rate-limit per IP + tenant (PII email enumeration control — no login).
  const limit = bookingRateLimit(clientIp(req), slug);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: limit.retryAfter },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "";
  const serviceId = url.searchParams.get("service");

  const headers: Record<string, string> = { "cache-control": "no-store", vary: "Origin" };
  const allowed = bookingAllowedOrigin(req, slug);
  if (allowed) headers["access-control-allow-origin"] = allowed;

  const client = findClientByEmail(email);
  if (!client) {
    return NextResponse.json({ known: false }, { headers });
  }

  const service = t.services.find((s) => s.id === serviceId);
  const profile = patientProfiles[client.id];
  const subsidies = service && profile
    ? calculateSubsidies({ serviceId: service.id, servicePriceKr: service.priceKr, clientId: client.id }).map((c) => ({
        scheme: c.scheme,
        schemeLabel: c.schemeLabel,
        subsidyKr: c.subsidyKr,
        eligible: c.eligible,
        reason: c.reason,
        authority: c.authority,
      }))
    : [];

  // Klippekort gyldige til denne ydelse + gavekort uanset ydelse
  const vouchers = listVouchers({ tenant: slug, status: "active" })
    .filter((v) => v.buyer.email.toLowerCase() === email.toLowerCase() || v.recipient?.email.toLowerCase() === email.toLowerCase())
    .filter((v) => v.kind === "gift" || v.serviceId === serviceId)
    .map((v) => ({
      code: v.code,
      kind: v.kind,
      sessionsRemaining: v.sessionsRemaining,
      balanceKr: v.balanceOere ? v.balanceOere / 100 : undefined,
      serviceName: v.serviceName,
      expiresAt: v.expiresAt,
    }));

  return NextResponse.json({
    known: true,
    client: { name: client.name, age: client.age, mitidVerified: client.mitidVerified },
    schemes: profile?.schemes.map((s) => ({ scheme: s.scheme, label: SCHEME_LABEL[s.scheme], memberId: s.memberId })) ?? [],
    subsidies,
    vouchers,
  }, {
    headers,
  });
}
