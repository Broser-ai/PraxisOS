import { NextResponse } from "next/server";
import { registerOwnerAccount } from "@/lib/auth";
import { DB_MODE } from "@/lib/supabase";
import { getTenant, registerTenant } from "@/lib/tenants";
import { getBackoffMs, recordAttempt } from "@/lib/rate-limit";

type SignupBody = {
  cvr?: string;
  legalName?: string;
  address?: string;
  email?: string;
  phone?: string;
  contactName?: string;
  slug?: string;
  plan?: string;
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
}

/**
 * POST /api/signup
 * Opretter tenant + owner-konto.
 * - mock / supabase-local uden service_role: in-memory via lib/tenants + lib/auth
 * - supabase-eu med SUPABASE_SERVICE_ROLE_KEY: klar til rigtig insert (Sprint 1)
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";

  let body: SignupBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const legalName = body.legalName?.trim() ?? "";
  const contactName = body.contactName?.trim() ?? "";
  const cvr = body.cvr?.trim() ?? "";
  const slug = slugify(body.slug || legalName);
  const plan = body.plan || "practice";

  if (!legalName || !email || !contactName || !slug) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (cvr && !/^\d{8}$/.test(cvr)) {
    return NextResponse.json({ error: "invalid_cvr" }, { status: 400 });
  }

  const backoff = getBackoffMs(ip, email);
  if (backoff > 0) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: backoff },
      { status: 429, headers: { "Retry-After": Math.ceil(backoff / 1000).toString() } }
    );
  }

  if (getTenant(slug)) {
    recordAttempt(ip, email, false);
    return NextResponse.json({ error: "slug_taken", slug }, { status: 409 });
  }

  // Prod-path: når service_role er sat, forventes rigtig Supabase-insert (endnu ikke wired).
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (DB_MODE === "supabase-eu" && serviceRole) {
    // Placeholder indtil @supabase/supabase-js er koblet — falder tilbage til mock-registrering
    // så signup ikke er helt død i prod før env er komplet.
  }

  const tenantResult = registerTenant({
    slug,
    legalName,
    cvr,
    address: body.address?.trim() ?? "",
    email,
    phone: body.phone?.trim() ?? "",
    contactName,
    plan,
  });

  if ("error" in tenantResult) {
    recordAttempt(ip, email, false);
    return NextResponse.json({ error: tenantResult.error }, { status: 409 });
  }

  const accountResult = registerOwnerAccount({
    email,
    name: contactName,
    tenantSlug: tenantResult.slug,
  });

  if ("error" in accountResult) {
    recordAttempt(ip, email, false);
    return NextResponse.json({ error: accountResult.error }, { status: 409 });
  }

  recordAttempt(ip, email, true);

  return NextResponse.json(
    {
      success: true,
      mode: DB_MODE,
      tenant: {
        slug: tenantResult.slug,
        legalName: tenantResult.legalName,
        plan: tenantResult.license.plan,
        domain: `${tenantResult.slug}.praxis.app`,
        status: tenantResult.license.status,
        expiresAt: tenantResult.license.expiresAt,
      },
      account: {
        id: accountResult.id,
        email: accountResult.email,
        name: accountResult.name,
        role: "owner",
      },
      next: {
        loginUrl: "/login",
        onboardingUrl: `/t/${tenantResult.slug}/onboarding`,
        demoPassword: DB_MODE === "mock" ? "demo" : undefined,
        mitidInvite: DB_MODE === "mock"
          ? "Mock: log ind med e-mail + adgangskode «demo»"
          : "MitID-invite sendes når broker er aktiveret",
      },
    },
    { status: 201 }
  );
}
