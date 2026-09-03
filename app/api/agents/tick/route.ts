import { NextResponse } from "next/server";
import { tickAutomation, ensureWorkflowSubscription } from "@/lib/agents/workflows";
import { authorizeWorker } from "@/lib/agent-worker-auth";
import { auditLogWithContext } from "@/lib/audit";

export const runtime = "nodejs";

/** Cron / worker heartbeat — runs all due scheduled workflows */
export async function POST(req: Request) {
  ensureWorkflowSubscription();
  if (!authorizeWorker(req).ok) {
    auditLogWithContext(req, "agent.tick_unauthorized", {
      auth_mode: "worker_secret",
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let force = false;
  let tenant = "bypilar";
  try {
    const body = await req.json();
    force = Boolean(body?.force);
    if (typeof body?.tenant === "string") tenant = body.tenant;
  } catch {
    // empty body ok
  }
  const result = await tickAutomation({ tenant, force });
  // F62 · worker mutation audit
  auditLogWithContext(req, "agent.tick", {
    tenant_id: tenant,
    auth_mode: "worker_secret",
  });
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  ensureWorkflowSubscription();
  if (!authorizeWorker(req).ok) {
    auditLogWithContext(req, "agent.tick_unauthorized", {
      auth_mode: "worker_secret",
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const result = await tickAutomation({ force });
  auditLogWithContext(req, "agent.tick", {
    auth_mode: "worker_secret",
  });
  return NextResponse.json(result);
}
