import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { getDaemonState, tickDaemon } from "@/lib/swarm/daemon";
import { isSwarmEnabled } from "@/lib/swarm/meta-harness";
import { jsonAuthFail, requireTenantAccess } from "@/lib/request-auth";

/**
 * POST /api/v1/{tenant}/swarm/tick
 * One autonomous cycle — for Vercel cron / external schedulers (24/7 recurring).
 * Also accepts Authorization: Bearer cron secret via SWARM_CRON_SECRET.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ tenant: string }> },
) {
  if (!isSwarmEnabled()) {
    return NextResponse.json({ error: "SWARM_DISABLED" }, { status: 503 });
  }

  const { tenant } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const cronSecret = process.env.SWARM_CRON_SECRET?.trim();
  const bearer = req.headers.get("authorization");
  const cronOk =
    Boolean(cronSecret) && bearer === `Bearer ${cronSecret}`;

  if (!cronOk) {
    // F41 · requireTenantAccess for staff path (cron Bearer unchanged)
    const auth = requireTenantAccess(req, tenant, {
      roles: ["owner", "support"],
    });
    if (!auth.ok) return jsonAuthFail(auth);
  }

  try {
    const result = await tickDaemon({ tenantSlug: tenant });
    return NextResponse.json({
      ok: true,
      ...result,
      daemon: getDaemonState(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
