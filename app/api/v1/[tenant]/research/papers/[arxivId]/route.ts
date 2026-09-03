import { NextResponse } from "next/server";
import { getAlphaxivOverview, getAlphaxivPaper } from "@/lib/alphaxiv";
import { getTenant } from "@/lib/tenants";
import { jsonAuthFail, requireTenantAccess, type GuardOk } from "@/lib/request-auth";
import { auditLogWithContext } from "@/lib/audit";

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
  const session = auth as GuardOk;

  const paper = await getAlphaxivPaper(arxivId);
  if (!paper) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const wantOverview = new URL(req.url).searchParams.get("overview") === "1";
  const overview = wantOverview ? await getAlphaxivOverview(arxivId) : null;

  // F76 · paper view audit (arxiv id only)
  auditLogWithContext(req, "research.paper_viewed", {
    tenant_id: tenant,
    actor_user_id: session.accountId,
    target_ref: arxivId,
    auth_mode: "session",
  });

  return NextResponse.json({
    data: paper,
    overview,
    tenant,
  });
}
