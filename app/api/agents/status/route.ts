import { NextResponse } from "next/server";
import { getAutomationStats, listRuns, listApprovals, listJobs } from "@/lib/agent-store";
import { listWorkflows } from "@/lib/agents/workflows";
import { isLlmConfigured, llmModel } from "@/lib/agents/llm";
import { isBirdConfigured } from "@/lib/bird";
import { eventCount } from "@/lib/event-bus";
import { AGENTS } from "@/lib/agents";
import { ensureWorkflowSubscription } from "@/lib/agents/workflows";
import {
  jsonAuthFail,
  requireRole,
  resolveRequestAuth,
  type AuthOk,
} from "@/lib/request-auth";
import { auditLogWithContext } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // Automation-leak surface — owner/support only (was unauthenticated).
  const auth = resolveRequestAuth(req);
  if (!auth.ok) return jsonAuthFail(auth);
  const roleGate = requireRole(auth as AuthOk, ["owner", "support"]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);

  ensureWorkflowSubscription();
  const stats = getAutomationStats();

  // F56 · agents/status read audit (owner/support surface)
  auditLogWithContext(req, "agent.status_viewed", {
    tenant_id: (auth as AuthOk).tenant,
    actor_user_id: (auth as AuthOk).accountId,
    auth_mode: (auth as AuthOk).mode,
    meta: { runsTotal: stats.runsTotal },
  });

  return NextResponse.json({
    ok: true,
    automation: stats,
    llm: { configured: isLlmConfigured(), model: llmModel() },
    bird: { configured: isBirdConfigured() },
    agents: AGENTS.map((a) => ({ id: a.id, name: a.name, role: a.role, status: a.status })),
    workflows: listWorkflows().map((w) => ({
      id: w.id,
      name: w.name,
      schedule: w.schedule,
      agents: w.agents,
      enabled: w.enabled,
      description: w.description,
    })),
    recentRuns: listRuns({ limit: 15 }),
    pendingApprovals: listApprovals({ status: "pending", limit: 10 }),
    recentJobs: listJobs({ limit: 15 }),
    eventCount: eventCount(),
  });
}
