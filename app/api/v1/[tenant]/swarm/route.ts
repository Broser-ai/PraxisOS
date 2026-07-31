import { NextRequest, NextResponse } from "next/server";
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
import { listJournals } from "@/lib/swarm/journal";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await ctx.params;
  if (!getTenant(tenant)) {
    return NextResponse.json({ error: "tenant_not_found" }, { status: 404 });
  }

  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!session || session.tenant !== tenant) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "status";

  if (view === "tasks") {
    return NextResponse.json({ data: listSwarmTasks(tenant) });
  }
  if (view === "journals") {
    return NextResponse.json({ data: listJournals({ limit: 40 }) });
  }
  return NextResponse.json({ ...getSwarmStatus(), tenant });
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
  if (!session || session.tenant !== tenant) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "owner" && session.role !== "support") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    action?: "enqueue" | "execute" | "savage" | "approve";
    type?: SwarmTaskType;
    title?: string;
    brief?: string;
    priority?: 1 | 2 | 3;
    taskId?: string;
    approveToken?: string;
    targetBranch?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action ?? "savage";

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

  // savage = enqueue + execute immediately
  const task = await savageRun({
    type: body.type,
    title: body.title,
    brief: body.brief ?? body.title,
    tenantSlug: tenant,
    priority: body.priority,
  });
  return NextResponse.json({ task }, { status: 201 });
}
