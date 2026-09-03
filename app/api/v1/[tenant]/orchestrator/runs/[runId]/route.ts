import { NextResponse } from "next/server";
import { orchRunMaps } from "@/lib/orchestrator-runs";
import { getTenant } from "@/lib/tenants";
import { jsonAuthFail, requireTenantAccess } from "@/lib/request-auth";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tenant: string; runId: string }> },
) {
  const { tenant, runId } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }
  // F41 · requireTenantAccess replaces raw decodeSession
  const auth = requireTenantAccess(req, tenant);
  if (!auth.ok) return jsonAuthFail(auth);

  const { completed, inflight } = orchRunMaps();
  if (completed.has(runId)) {
    return NextResponse.json({ run_id: runId, ...completed.get(runId) });
  }
  if (inflight.has(runId)) {
    return NextResponse.json(
      { run_id: runId, status: "processing" },
      { status: 202 },
    );
  }
  return NextResponse.json({ error: "run_not_found" }, { status: 404 });
}
