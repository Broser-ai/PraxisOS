import { NextResponse } from "next/server";
import { getTenant, updateTenantSetup, type Service } from "@/lib/tenants";
import { auditLog } from "@/lib/audit";
import {
  jsonAuthFail,
  requireRole,
  resolveRequestAuth,
  type AuthOk,
} from "@/lib/request-auth";

/** POST /api/tenant/setup — klinik-ejer færdiggør setup efter signup */
export async function POST(req: Request) {
  // Owner-only tenant brand/services write — was unauthenticated (hijack risk).
  const auth = resolveRequestAuth(req);
  if (!auth.ok) return jsonAuthFail(auth);
  const roleGate = requireRole(auth as AuthOk, ["owner", "support"]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);
  const session = auth as AuthOk;

  let body: {
    tenant?: string;
    brandName?: string;
    tagline?: string;
    services?: Service[];
    setupComplete?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const slug = body.tenant?.trim() ?? "";
  if (!slug || !getTenant(slug)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }
  // Tenant must match verified session (support may cross).
  if (session.tenant !== slug && session.role !== "support") {
    return NextResponse.json({ error: "tenant_mismatch" }, { status: 403 });
  }

  const result = updateTenantSetup(slug, {
    brandName: body.brandName,
    tagline: body.tagline,
    services: body.services,
    setupComplete: body.setupComplete ?? true,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  auditLog("tenant.setup_updated", {
    tenant_id: slug,
    actor_user_id: session.accountId,
    target_ref: `tenant/${slug}`,
  });

  return NextResponse.json({
    success: true,
    tenant: {
      slug: result.slug,
      brand: result.brand,
      services: result.services,
      setupComplete: result.setupComplete,
      license: result.license,
    },
  });
}
