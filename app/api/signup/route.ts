import { NextResponse } from "next/server";
import { registerOwnerAccount } from "@/lib/auth";
import { dataBackend, signupTenantInSupabase } from "@/lib/data/repo";
import { getBackoffMs, recordAttempt } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getTenant, registerTenant } from "@/lib/tenants";
import { auditLogWithContext } from "@/lib/audit";

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
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

/**
 * POST /api/signup — creates tenant + owner account.
 * Uses Supabase when service role is configured; otherwise durable memory.
 * F25 · emits signup.success / signup.failure / signup.rate_limited audits
 * (public abuse trail; no patient AI; suggestion_only).
 */
export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

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
  const phone = body.phone?.trim() ?? "";
  const address = body.address?.trim() ?? "";

  if (!legalName || !email || !contactName || !slug) {
    auditLogWithContext(req, "signup.failure", {
      auth_mode: "public",
      meta: { reason: "missing_fields", slug: slug || undefined },
    });
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    auditLogWithContext(req, "signup.failure", {
      auth_mode: "public",
      meta: { reason: "invalid_email" },
    });
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (cvr && !/^\d{8}$/.test(cvr)) {
    auditLogWithContext(req, "signup.failure", {
      auth_mode: "public",
      meta: { reason: "invalid_cvr" },
    });
    return NextResponse.json({ error: "invalid_cvr" }, { status: 400 });
  }

  const backoff = getBackoffMs(ip, email);
  if (backoff > 0) {
    auditLogWithContext(req, "signup.rate_limited", {
      auth_mode: "public",
      meta: { retryAfterMs: backoff },
    });
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: backoff },
      {
        status: 429,
        headers: { "Retry-After": Math.ceil(backoff / 1000).toString() },
      },
    );
  }

  if (isSupabaseConfigured()) {
    const result = await signupTenantInSupabase({
      slug,
      legalName,
      cvr,
      address,
      email,
      phone,
      contactName,
      plan,
    });
    if ("error" in result) {
      recordAttempt(ip, email, false);
      auditLogWithContext(req, "signup.failure", {
        tenant_id: slug,
        auth_mode: "public",
        meta: { reason: result.error, backend: "supabase" },
      });
      const status =
        result.error === "slug_taken" || result.error === "email_taken"
          ? 409
          : 500;
      return NextResponse.json({ error: result.error, slug }, { status });
    }
    // Also register in memory so brand/UI getTenant works in same process.
    if (!getTenant(slug)) {
      registerTenant({
        slug,
        legalName,
        cvr,
        address,
        email,
        phone,
        contactName,
        plan,
      });
      registerOwnerAccount({ email, name: contactName, tenantSlug: slug });
    }
    recordAttempt(ip, email, true);
    auditLogWithContext(req, "signup.success", {
      tenant_id: slug,
      actor_user_id: result.userId,
      target_ref: `tenant/${slug}`,
      auth_mode: "public",
      meta: { backend: dataBackend(), plan },
    });
    return NextResponse.json(
      {
        success: true,
        backend: dataBackend(),
        tenant: { slug, id: result.tenantId },
        owner: { id: result.userId, email, temporaryPassword: "demo" },
        loginHint: "Log ind med email + password 'demo'",
      },
      { status: 201 },
    );
  }

  if (getTenant(slug)) {
    recordAttempt(ip, email, false);
    auditLogWithContext(req, "signup.failure", {
      tenant_id: slug,
      auth_mode: "public",
      meta: { reason: "slug_taken", backend: "memory" },
    });
    return NextResponse.json({ error: "slug_taken", slug }, { status: 409 });
  }

  const tenantResult = registerTenant({
    slug,
    legalName,
    cvr,
    address,
    email,
    phone,
    contactName,
    plan,
  });
  if ("error" in tenantResult) {
    recordAttempt(ip, email, false);
    auditLogWithContext(req, "signup.failure", {
      tenant_id: slug,
      auth_mode: "public",
      meta: { reason: tenantResult.error, backend: "memory" },
    });
    return NextResponse.json({ error: tenantResult.error }, { status: 400 });
  }

  const owner = registerOwnerAccount({
    email,
    name: contactName,
    tenantSlug: slug,
  });
  if ("error" in owner) {
    recordAttempt(ip, email, false);
    auditLogWithContext(req, "signup.failure", {
      tenant_id: slug,
      auth_mode: "public",
      meta: { reason: owner.error, backend: "memory" },
    });
    return NextResponse.json({ error: owner.error }, { status: 409 });
  }

  recordAttempt(ip, email, true);
  auditLogWithContext(req, "signup.success", {
    tenant_id: tenantResult.slug,
    actor_user_id: owner.id,
    target_ref: `tenant/${tenantResult.slug}`,
    auth_mode: "public",
    meta: { backend: dataBackend(), plan },
  });
  return NextResponse.json(
    {
      success: true,
      backend: dataBackend(),
      tenant: { slug: tenantResult.slug, legalName: tenantResult.legalName },
      owner: { id: owner.id, email: owner.email, temporaryPassword: "demo" },
      loginHint: "Log ind med email + password 'demo'",
    },
    { status: 201 },
  );
}
