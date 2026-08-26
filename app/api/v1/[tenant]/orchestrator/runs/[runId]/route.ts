import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth";
import { orchRunMaps } from "@/lib/orchestrator-runs";
import { getTenant } from "@/lib/tenants";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenant: string; runId: string }> },
) {
  const { tenant, runId } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }
  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!session || session.tenant !== tenant) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
