import { NextResponse } from "next/server";
import { getAlphaxivOverview, getAlphaxivPaper } from "@/lib/alphaxiv";
import { getTenant } from "@/lib/tenants";
import { jsonAuthFail, requireTenantAccess } from "@/lib/request-auth";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tenant: string; arxivId: string }> },
) {
  const { tenant, arxivId } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  // F41 · requireTenantAccess replaces raw session-cookie decode
  const auth = requireTenantAccess(req, tenant);
  if (!auth.ok) return jsonAuthFail(auth);

  const paper = await getAlphaxivPaper(arxivId);
  if (!paper) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const wantOverview = new URL(req.url).searchParams.get("overview") === "1";
  const overview = wantOverview ? await getAlphaxivOverview(arxivId) : null;

  return NextResponse.json({
    data: paper,
    overview,
    tenant,
  });
}
