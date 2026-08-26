import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth";
import { getTenant } from "@/lib/tenants";
import { getDaemonState, tickDaemon } from "@/lib/swarm/daemon";
import { isSwarmEnabled } from "@/lib/swarm/meta-harness";

/**
 * POST /api/v1/{tenant}/swarm/tick
 * One autonomous cycle — for Vercel cron / external schedulers (24/7 recurring).
 * Also accepts Authorization: Bearer cron secret via SWARM_CRON_SECRET.
 */
export async function POST(
  req: NextRequest,
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
    const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value ?? "");
    if (!session || session.tenant !== tenant) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (session.role !== "owner" && session.role !== "support") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
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
