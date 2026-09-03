import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agents/runtime";
import { ensureWorkflowSubscription } from "@/lib/agents/workflows";
import { getAgent, type AgentId } from "@/lib/agents";
import { auditLogWithContext } from "@/lib/audit";
import {
  jsonAuthFail,
  requireRole,
  resolveRequestAuth,
  type AuthOk,
} from "@/lib/request-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  ensureWorkflowSubscription();
  // Staff-only agent run — tenant from verified session, not free body.
  const auth = resolveRequestAuth(req);
  if (!auth.ok) return jsonAuthFail(auth);
  const roleGate = requireRole(auth as AuthOk, [
    "practitioner",
    "owner",
    "support",
  ]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);
  const session = auth as AuthOk;

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

  // Ignore client-supplied tenant; use verified session tenant (support crosses).
  const tenant = session.tenant;

  const result = await runAgent({
    message,
    agentId: body.agentId as AgentId | undefined,
    tenant,
    trigger: "chat",
    autoRoute: body.autoRoute !== false && !body.agentId,
  });

  // F45 · agents/run audit request context
  auditLogWithContext(req, "agent.run", {
    tenant_id: tenant,
    actor_user_id: session.accountId,
    target_ref: `agent/${result.agentId}/run/${result.run.id}`,
    auth_mode: session.mode,
    meta: {
      status: result.run.status,
      mode: result.mode,
      requiresApproval: result.run.requiresApproval,
      messageLen: message.length,
    },
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
