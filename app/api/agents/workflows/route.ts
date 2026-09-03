import { NextResponse } from "next/server";
import {
  listWorkflows,
  getWorkflow,
  runWorkflow,
  tickAutomation,
  ensureWorkflowSubscription,
} from "@/lib/agents/workflows";
import { authorizeWorker } from "@/lib/agent-worker-auth";

export const runtime = "nodejs";

export async function GET() {
  ensureWorkflowSubscription();
  return NextResponse.json({
    workflows: listWorkflows().map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      schedule: w.schedule,
      agents: w.agents,
      enabled: w.enabled,
      eventTypes: w.eventTypes ?? [],
    })),
  });
}

export async function POST(req: Request) {
  ensureWorkflowSubscription();
  if (!authorizeWorker(req).ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { action?: string; workflowId?: string; tenant?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = (body.action ?? "run") as "tick" | "run" | "run_all_due";
  const tenant = body.tenant ?? "bypilar";

  switch (action) {
    case "tick": {
      const result = await tickAutomation({ tenant, force: body.force });
      return NextResponse.json(result);
    }
    case "run": {
      if (!body.workflowId || !getWorkflow(body.workflowId)) {
        return NextResponse.json({ error: "workflowId_required" }, { status: 400 });
      }
      const result = await runWorkflow(body.workflowId, { tenant, force: true });
      return NextResponse.json({ ok: true, ...result });
    }
    case "run_all_due": {
      const result = await tickAutomation({ tenant, force: Boolean(body.force) });
      return NextResponse.json(result);
    }
    default: {
      const _exhaustive: never = action;
      return NextResponse.json({ error: "unknown_action", action: _exhaustive }, { status: 400 });
    }
  }
}
