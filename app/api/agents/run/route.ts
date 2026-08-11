import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agents/runtime";
import { ensureWorkflowSubscription } from "@/lib/agents/workflows";
import { getAgent, type AgentId } from "@/lib/agents";

export const runtime = "nodejs";

export async function POST(req: Request) {
  ensureWorkflowSubscription();
  let body: {
    message?: string;
    agentId?: string;
    tenant?: string;
    autoRoute?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "message_required" }, { status: 400 });

  if (body.agentId && !getAgent(body.agentId)) {
    return NextResponse.json({ error: "unknown_agent" }, { status: 400 });
  }

  const result = await runAgent({
    message,
    agentId: body.agentId as AgentId | undefined,
    tenant: body.tenant ?? "bypilar",
    trigger: "chat",
    autoRoute: body.autoRoute !== false && !body.agentId,
  });

  return NextResponse.json({
    ok: result.run.status !== "failed",
    agentId: result.agentId,
    reply: result.reply,
    mode: result.mode,
    run: {
      id: result.run.id,
      status: result.run.status,
      toolCalls: result.run.toolCalls,
      model: result.run.model,
      requiresApproval: result.run.requiresApproval,
    },
  });
}
