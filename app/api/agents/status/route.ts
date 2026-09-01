import { NextResponse } from "next/server";
import { getAutomationStats, listRuns, listApprovals, listJobs } from "@/lib/agent-store";
import { listWorkflows } from "@/lib/agents/workflows";
import { isLlmConfigured, llmModel } from "@/lib/agents/llm";
import { isBirdConfigured } from "@/lib/bird";
import { eventCount } from "@/lib/event-bus";
import { AGENTS } from "@/lib/agents";
import { ensureWorkflowSubscription } from "@/lib/agents/workflows";

export const runtime = "nodejs";

export async function GET() {
  ensureWorkflowSubscription();
  const stats = getAutomationStats();
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
