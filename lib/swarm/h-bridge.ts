// H-bridge · routes clinical/humanized work through LangGraph orchestrator

import { buildOrchestrator } from "@/lib/orchestrator";
import { createStubLLMCaller, createDefaultLLMCaller } from "@/lib/llm-adapter";
import { writeJournal } from "@/lib/swarm/journal";
import type { SwarmTask } from "@/lib/swarm/types";
import type { Role } from "@/lib/agents";

export async function runHBridge(task: SwarmTask, opts?: {
  actorRole?: Role;
  useLiveLlm?: boolean;
}): Promise<{ summary: string; status: "completed" | "failed"; steps: number }> {
  writeJournal({
    agent: "H_BRIDGE",
    kind: "action",
    taskId: task.id,
    content: `Dispatching H-agents via LangGraph for: ${task.title}`,
  });

  const orch = buildOrchestrator({
    llmCall: opts?.useLiveLlm ? createDefaultLLMCaller() : createStubLLMCaller(),
  });

  const result = await orch.invoke({
    tenantId: task.tenantSlug,
    tenantSlug: task.tenantSlug,
    actorRole: opts?.actorRole ?? "owner",
    origin: "api",
    messages: [{ role: "user", content: task.brief || task.title }],
    tenantMdrStatus: "none",
  });

  if (result.status !== "done") {
    writeJournal({
      agent: "H_BRIDGE",
      kind: "result",
      taskId: task.id,
      content: `H-bridge failed: ${result.error?.code ?? "unknown"} ${result.error?.message ?? ""}`,
    });
    return {
      summary: result.error?.message ?? "h_bridge_failed",
      status: "failed",
      steps: result.steps.length,
    };
  }

  const last = result.output.filter((m) => m.role === "assistant").at(-1)?.content;
  writeJournal({
    agent: "H_BRIDGE",
    kind: "result",
    taskId: task.id,
    content: last ?? `H-run done in ${result.steps.length} steps`,
    meta: { steps: result.steps.length, finalAgent: result.finalAgent },
  });

  return {
    summary: last ?? `Orchestrator finished (${result.steps.length} steps)`,
    status: "completed",
    steps: result.steps.length,
  };
}
