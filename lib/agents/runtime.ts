// PraxisOS agent runtime · LLM tool-loop + truthful provider failure reporting

import { getAgent, routeMessage, type AgentId } from "@/lib/agents";
import { executeMcpTool } from "@/lib/mcp-handlers";
import {
  createRun,
  updateRun,
  type AgentProviderErrorCode,
  type AgentRun,
  type AgentToolCall,
} from "@/lib/agent-store";
import { buildSystemPrompt, toolsForAgent } from "@/lib/agents/prompts";
import {
  chatCompletions,
  isLlmConfigured,
  llmModel,
  toOpenAiTools,
  type LlmMessage,
  type ProviderErrorCode,
} from "@/lib/agents/llm";
import { getClient } from "@/lib/clients";
import { calculateSubsidies, bestSubsidy } from "@/lib/subsidies";

export type RunAgentInput = {
  message: string;
  agentId?: AgentId | string;
  tenant?: string;
  trigger?: AgentRun["trigger"];
  workflowId?: string;
  eventId?: string;
  autoRoute?: boolean;
  maxToolRounds?: number;
  /**
   * Opt-in only. When set, missing/failing provider may return a clearly marked
   * simulated reply (simulated + non_executing + not_real_llm_result) — never
   * silent success and never tool/model/code work claims.
   */
  allowSimulatedFallback?: boolean;
  /** Prime Execution Control — wires BudgetGuard into chatCompletions */
  missionId?: string;
  workstreamId?: string;
  missionRole?: import("@/lib/prime/mission-types").MissionRole;
};

export type RunAgentResult = {
  run: AgentRun;
  agentId: AgentId;
  reply: string;
  mode: "llm" | "heuristic" | "simulated";
};

const TRUTHFULNESS_MARKERS = {
  simulated: true as const,
  nonExecuting: true as const,
  notRealLlmResult: true as const,
};

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Non-executing simulated fallback — never claims tool/model/code work was done.
 * Only used when allowSimulatedFallback is explicitly set.
 */
function simulatedFallbackReply(
  agentId: AgentId,
  reason: string,
  code: ProviderErrorCode,
): { reply: string; toolCalls: AgentToolCall[] } {
  const agent = getAgent(agentId)!;
  return {
    reply: [
      `[SIMULATED · non_executing · not_real_llm_result]`,
      `AI-udbyder utilgængelig (${code}: ${reason}).`,
      `Ingen tool-kald, model-arbejde eller kode-arbejde er udført.`,
      agent.signature.replace("{clinic}", "bypilar"),
    ].join(" "),
    toolCalls: [],
  };
}

type LlmReplyOk = {
  ok: true;
  reply: string;
  toolCalls: AgentToolCall[];
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimated: boolean;
  };
};

type LlmReplyFail = {
  ok: false;
  code: ProviderErrorCode;
  error: string;
  toolCalls: AgentToolCall[];
  usage?: LlmReplyOk["usage"];
};

async function llmReply(
  agentId: AgentId,
  message: string,
  tenant: string,
  runId: string,
  maxToolRounds: number,
  budget?: {
    missionId: string;
    workstreamId?: string;
    role?: import("@/lib/prime/mission-types").MissionRole;
  },
): Promise<LlmReplyOk | LlmReplyFail> {
  const agent = getAgent(agentId)!;
  const tools = toolsForAgent(agentId);
  const messages: LlmMessage[] = [
    { role: "system", content: buildSystemPrompt(agent, tenant) },
    { role: "user", content: message },
  ];
  const toolCalls: AgentToolCall[] = [];
  const oaTools = toOpenAiTools(tools);
  let lastUsage: LlmReplyOk["usage"];

  for (let round = 0; round < maxToolRounds; round++) {
    const res = await chatCompletions({
      messages,
      tools: oaTools,
      budget: budget?.missionId ? budget : undefined,
      toolCallsSoFar: toolCalls.length,
    });
    if (!res.ok) {
      return {
        ok: false,
        code: res.code,
        error: res.error,
        toolCalls,
        usage: lastUsage,
      };
    }
    if (res.usage) lastUsage = res.usage;

    if (res.toolCalls.length === 0) {
      return {
        ok: true,
        reply: res.content?.trim() || "(tomt svar)",
        toolCalls,
        model: res.model,
        usage: lastUsage,
      };
    }

    messages.push({
      role: "assistant",
      content: res.content || "",
    } as LlmMessage);

    // Re-add tool_calls on assistant message for OpenAI format
    (messages[messages.length - 1] as any).tool_calls = res.toolCalls;

    for (const tc of res.toolCalls) {
      const args = parseArgs(tc.function.arguments);
      const at = new Date().toISOString();
      const result = await executeMcpTool(tc.function.name, args, { runId, agentId, tenant });
      toolCalls.push({
        name: tc.function.name,
        args,
        result: result.data,
        error: result.ok ? undefined : "tool_error",
        at,
      });
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result.data),
      });
    }
  }

  return {
    ok: true,
    reply: "Jeg nåede tool-loftet — her er hvad jeg har indtil videre. Prøv igen for næste skridt.",
    toolCalls,
    model: llmModel(),
    usage: lastUsage,
  };
}

function finishProviderMiss(
  run: AgentRun,
  agentId: AgentId,
  code: AgentProviderErrorCode,
  error: string,
  mode: RunAgentResult["mode"],
  extras?: {
    toolCalls?: AgentToolCall[];
    tokenUsage?: AgentRun["tokenUsage"];
  },
): RunAgentResult {
  // provider_unavailable → blocked; timeout/error → failed. Never completed/FINISH.
  const status = code === "provider_unavailable" ? "blocked" : "failed";
  const reply = `Agent ${status}: ${code} — ${error}. Ingen FINISH/success.`;
  const updated =
    updateRun(run.id, {
      status,
      error,
      errorCode: code,
      output: reply,
      toolCalls: extras?.toolCalls ?? [],
      mode,
      finishedAt: new Date().toISOString(),
      tokenUsage: extras?.tokenUsage,
      simulated: false,
      nonExecuting: true,
      notRealLlmResult: true,
    }) ?? run;
  return { run: updated, agentId, reply, mode };
}

function finishSimulated(
  run: AgentRun,
  agentId: AgentId,
  code: ProviderErrorCode,
  reason: string,
  tokenUsage?: AgentRun["tokenUsage"],
): RunAgentResult {
  const sim = simulatedFallbackReply(agentId, reason, code);
  const updated =
    updateRun(run.id, {
      // Simulated work is never success. A consumer filtering on
      // status === "completed" would otherwise count a run no model performed.
      status: "blocked",
      output: sim.reply,
      toolCalls: [],
      mode: "simulated",
      model: "simulated-non-executing",
      error: reason,
      errorCode: code,
      finishedAt: new Date().toISOString(),
      tokenUsage,
      ...TRUTHFULNESS_MARKERS,
    }) ?? run;
  return { run: updated, agentId, reply: sim.reply, mode: "simulated" };
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const tenant = input.tenant?.trim() || "bypilar";
  const routed =
    input.agentId && getAgent(input.agentId)
      ? { agent: input.agentId as AgentId, confidence: 1, reason: "explicit" }
      : input.autoRoute === false && input.agentId
        ? { agent: (input.agentId as AgentId) || "aria", confidence: 0.5, reason: "fallback" }
        : routeMessage(input.message);

  const agentId = (getAgent(routed.agent) ? routed.agent : "aria") as AgentId;
  const preferLlm = isLlmConfigured();
  const allowSimulated = input.allowSimulatedFallback === true;

  const run = createRun({
    agentId,
    tenant,
    trigger: input.trigger ?? "chat",
    workflowId: input.workflowId,
    eventId: input.eventId,
    input: input.message,
    model: preferLlm ? llmModel() : "unconfigured",
    mode: preferLlm ? "llm" : "simulated",
    status: "running",
    missionId: input.missionId,
    workstreamId: input.workstreamId,
  });

  try {
    const budget =
      input.missionId
        ? {
            missionId: input.missionId,
            workstreamId: input.workstreamId,
            role: input.missionRole,
          }
        : undefined;

    // Missing provider config → blocked (or opt-in simulated), never silent success
    if (!preferLlm) {
      const code: ProviderErrorCode = "provider_unavailable";
      const error = "OPENAI_API_KEY mangler — LLM ikke konfigureret";
      if (allowSimulated) {
        return finishSimulated(run, agentId, code, error);
      }
      return finishProviderMiss(run, agentId, code, error, "simulated");
    }

    const llm = await llmReply(
      agentId,
      input.message,
      tenant,
      run.id,
      input.maxToolRounds ?? 4,
      budget,
    );

    if (!llm.ok) {
      if (allowSimulated) {
        return finishSimulated(run, agentId, llm.code, llm.error, llm.usage);
      }
      return finishProviderMiss(run, agentId, llm.code, llm.error, "llm", {
        toolCalls: llm.toolCalls,
        tokenUsage: llm.usage,
      });
    }

    const needsApproval = llm.toolCalls.some((t) => {
      const r = t.result as any;
      return (
        r &&
        typeof r === "object" &&
        (r.status === "draft_pending_approval" ||
          r.requiresApproval ||
          r.status === "pending_approval")
      );
    });

    const updated =
      updateRun(run.id, {
        status: needsApproval ? "awaiting_approval" : "completed",
        output: llm.reply,
        toolCalls: llm.toolCalls,
        mode: "llm",
        model: llm.model,
        finishedAt: new Date().toISOString(),
        requiresApproval: needsApproval,
        tokenUsage: llm.usage,
        simulated: false,
        nonExecuting: false,
        notRealLlmResult: false,
        error: undefined,
        errorCode: undefined,
      }) ?? run;

    return { run: updated, agentId, reply: llm.reply, mode: "llm" };
  } catch (err: any) {
    const msg = err?.message || "agent_failed";
    const code: ProviderErrorCode = isTimeoutLike(msg) ? "provider_timeout" : "provider_error";
    if (allowSimulated) {
      return finishSimulated(run, agentId, code, msg);
    }
    return finishProviderMiss(run, agentId, code, msg, preferLlm ? "llm" : "simulated");
  }
}

function isTimeoutLike(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("timeout") || m.includes("timed out") || m.includes("aborted");
}

/** Lightweight helpers used by workflows without full chat */
export function peekSubsidy(clientId: string, serviceId = "fod-med") {
  const all = calculateSubsidies({ clientId, serviceId, servicePriceKr: 495 });
  return bestSubsidy(all);
}

export function peekClient(clientId: string) {
  return getClient(clientId);
}
