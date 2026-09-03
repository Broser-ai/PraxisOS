import { NextResponse } from "next/server";
import { tickDaemon, getDaemonState } from "@/lib/swarm/daemon";
import { isSwarmEnabled } from "@/lib/swarm/meta-harness";
import { auditLogWithContext } from "@/lib/audit";

/**
 * Vercel Cron → 24/7 recurring swarm ticks (every 15 min via vercel.json).
 * Auth: Vercel Cron sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set,
 * or we accept SWARM_CRON_SECRET / x-vercel-cron header.
 */
export async function GET(req: Request) {
  if (!isSwarmEnabled()) {
    return NextResponse.json({ error: "SWARM_DISABLED" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  const cronSecret =
    process.env.CRON_SECRET?.trim() || process.env.SWARM_CRON_SECRET?.trim();
  const vercelCron = req.headers.get("x-vercel-cron");
  const ok =
    Boolean(vercelCron) ||
    (Boolean(cronSecret) && auth === `Bearer ${cronSecret}`) ||
    process.env.NODE_ENV !== "production";

  if (!ok) {
    auditLogWithContext(req, "swarm.cron_unauthorized", {
      auth_mode: "machine",
      meta: { via: "vercel-cron" },
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tenant = process.env.SWARM_DEFAULT_TENANT || "bypilar";
  const result = await tickDaemon({ tenantSlug: tenant });

  // F53 · cron tick audit with request context
  auditLogWithContext(req, "swarm.cron_tick", {
    tenant_id: tenant,
    auth_mode: "machine",
    meta: {
      via: "vercel-cron",
      ok: true,
      cycle: result.cycle,
      taskId: result.taskId,
      status: result.status,
    },
  });

  return NextResponse.json({
    ok: true,
    ...result,
    daemon: getDaemonState(),
    via: "vercel-cron",
  });
}
