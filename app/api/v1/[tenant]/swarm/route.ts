import { NextRequest, NextResponse } from "next/server";
import { listAgentLedger } from "@/lib/agents/ledger";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth";
import { getTenant } from "@/lib/tenants";
import {
  enqueueSwarmTask,
  executeSwarmTask,
  getSwarmStatus,
  humanApproveTask,
  isSwarmEnabled,
  listSwarmTasks,
  savageRun,
  type SwarmTaskType,
} from "@/lib/swarm";
import {
  getAutonomousSnapshot,
  getDaemonState,
  startDaemon,
  stopDaemon,
} from "@/lib/swarm/daemon";
import { listJournals } from "@/lib/swarm/journal";
import { ensureSwarmRemoteHydrated } from "@/lib/swarm/memory";
import { getShadowGateSnapshot } from "@/lib/swarm/shadow-gates";
import {
  cleanupSwarmWorktrees,
  createWorktreeForTask,
  discardWorktree,
  getSwarmWorktreeStatus,
  listWorktreeJobs,
} from "@/lib/swarm/worktree-manager";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!session || (session.tenant !== tenant && session.role !== "support")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await ensureSwarmRemoteHydrated();

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "status";

  if (view === "tasks") {
    return NextResponse.json({ data: listSwarmTasks(tenant) });
  }
  if (view === "journals") {
    return NextResponse.json({ data: listJournals({ limit: 40 }) });
  }
  if (view === "daemon") {
    return NextResponse.json(getAutonomousSnapshot());
  }
  if (view === "worktrees") {
    return NextResponse.json({
      data: listWorktreeJobs(),
      shadowGates: getShadowGateSnapshot(),
    });
  }
  if (view === "worktree_status") {
    const id = url.searchParams.get("id") ?? "";
    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }
    return NextResponse.json(getSwarmWorktreeStatus(id));
  }
  if (view === "ledger") {
    return NextResponse.json({
      data: listAgentLedger({ tenantSlug: tenant, limit: 40 }),
    });
  }
  if (view === "shadow_gates") {
    return NextResponse.json(getShadowGateSnapshot());
  }
  return NextResponse.json({
    ...getSwarmStatus(),
    tenant,
    daemon: getDaemonState(),
    shadowGates: getShadowGateSnapshot(),
  });
}

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

  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!session || (session.tenant !== tenant && session.role !== "support")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "owner" && session.role !== "support") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await ensureSwarmRemoteHydrated();

  let body: {
    action?:
      | "enqueue"
      | "execute"
      | "savage"
      | "approve"
      | "daemon_start"
      | "daemon_stop"
      | "worktree_create"
      | "worktree_cleanup"
      | "worktree_discard";
    type?: SwarmTaskType;
    title?: string;
    brief?: string;
    priority?: 1 | 2 | 3;
    taskId?: string;
    approveToken?: string;
    targetBranch?: string;
    intervalMs?: number;
    discardReady?: boolean;
    orphanedOnly?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action ?? "savage";

  if (action === "daemon_start") {
    const state = startDaemon({
      tenantSlug: tenant,
      intervalMs: body.intervalMs,
    });
    return NextResponse.json({
      ok: true,
      daemon: state,
      note: "24/7 recurring cycles · merge/deploy still human-gated",
    });
  }

  if (action === "daemon_stop") {
    return NextResponse.json({ ok: true, daemon: stopDaemon() });
  }

  if (action === "worktree_create") {
    if (!body.taskId || !body.title) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    const result = await createWorktreeForTask({
      taskId: body.taskId,
      title: body.title,
    });
    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ worktree: result }, { status: 201 });
  }

  if (action === "worktree_discard") {
    if (!body.taskId) {
      return NextResponse.json({ error: "missing_taskId" }, { status: 400 });
    }
    await discardWorktree(body.taskId);
    return NextResponse.json({ ok: true, taskId: body.taskId });
  }

  if (action === "worktree_cleanup") {
    const result = await cleanupSwarmWorktrees({
      discardReady: body.discardReady === true,
      orphanedOnly: body.orphanedOnly === true,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "approve") {
    if (!body.taskId || !body.approveToken) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    const result = await humanApproveTask({
      taskId: body.taskId,
      approveToken: body.approveToken,
      approvedBy: session.accountId,
      targetBranch: body.targetBranch,
    });
    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ task: result });
  }

  if (action === "execute") {
    if (!body.taskId) {
      return NextResponse.json({ error: "missing_taskId" }, { status: 400 });
    }
    const task = await executeSwarmTask(body.taskId);
    return NextResponse.json({ task });
  }

  if (!body.title || !body.type) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (action === "enqueue") {
    const task = enqueueSwarmTask({
      type: body.type,
      title: body.title,
      brief: body.brief ?? body.title,
      tenantSlug: tenant,
      priority: body.priority,
    });
    return NextResponse.json({ task }, { status: 201 });
  }

  const task = await savageRun({
    type: body.type,
    title: body.title,
    brief: body.brief ?? body.title,
    tenantSlug: tenant,
    priority: body.priority,
  });
  return NextResponse.json({ task }, { status: 201 });
}
