import { NextResponse } from "next/server";
import { getTenant, updateTenantSetup, type Service } from "@/lib/tenants";

/** POST /api/tenant/setup — klinik-ejer færdiggør setup efter signup */
export async function POST(req: Request) {
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

  const result = updateTenantSetup(slug, {
    brandName: body.brandName,
    tagline: body.tagline,
    services: body.services,
    setupComplete: body.setupComplete ?? true,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

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
