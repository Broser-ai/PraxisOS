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
import { calculateSubsidies, patientProfiles, SCHEME_LABEL } from "@/lib/subsidies";
import { listVouchers } from "@/lib/vouchers";
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

  // F22 · stricter separate rate-limit (PII email enumeration control).
  const limit = publicLookupRateLimit(clientIp(req), slug);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: limit.retryAfter },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  const url = new URL(req.url);
  const emailRaw = url.searchParams.get("email") ?? "";
  const email = emailRaw.trim().toLowerCase();
  const serviceId = url.searchParams.get("service");

  const headers: Record<string, string> = { "cache-control": "no-store", vary: "Origin" };
  const allowed = bookingAllowedOrigin(req, slug);
  if (allowed) headers["access-control-allow-origin"] = allowed;

  // F48 · reject empty / malformed email before any client store probe
  if (!email || email.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "invalid_email", known: false },
      { status: 400, headers },
    );
  }

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
    .filter((v) => v.buyer.email.toLowerCase() === email || v.recipient?.email.toLowerCase() === email)
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
    // F48 · scheme labels only — no memberId on public lookup
    schemes: profile?.schemes.map((s) => ({ scheme: s.scheme, label: SCHEME_LABEL[s.scheme] })) ?? [],
    subsidies,
    vouchers,
  }, {
    headers,
  });
}
