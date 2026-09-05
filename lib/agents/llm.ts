// OpenAI-compatible chat completions via fetch (no SDK dependency)
// Optional BudgetGuard hook when missionId is provided.

import { resolveSecret } from "@/lib/secrets";
import {
  estimateTokensFromMessages,
  extractProviderUsage,
  recordBudget,
  reserveBudget,
} from "@/lib/prime/budget-guard";
import type { MissionRole } from "@/lib/prime/mission-types";

export type LlmMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "tool"; tool_call_id: string; content: string };

export type LlmToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type LlmToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean;
};

export type LlmChatResult =
  | {
      ok: true;
      content: string | null;
      toolCalls: LlmToolCall[];
      model: string;
      raw?: unknown;
      usage?: LlmUsage;
    }
  | { ok: false; error: string; statusCode?: number; budgetExhausted?: boolean };

/** Optional mission budget context — when set, BudgetGuard reserve/record wraps the call. */
export type LlmBudgetContext = {
  missionId: string;
  workstreamId?: string;
  role?: MissionRole;
};

export function isLlmConfigured(): boolean {
  return Boolean(resolveSecret("OPENAI_API_KEY"));
}

export function llmModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export async function chatCompletions(opts: {
  messages: LlmMessage[];
  tools?: LlmToolDef[];
  temperature?: number;
  budget?: LlmBudgetContext;
  toolCallsSoFar?: number;
}): Promise<LlmChatResult> {
  const apiKey = resolveSecret("OPENAI_API_KEY");
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY mangler" };

  let reservationRunId: string | undefined;
  let reservedTokens = 0;

  if (opts.budget?.missionId) {
    const estimate = estimateTokensFromMessages({
      messages: opts.messages,
      toolCallCount: opts.toolCallsSoFar ?? 0,
    });
    const reserved = reserveBudget({
      missionId: opts.budget.missionId,
      workstreamId: opts.budget.workstreamId,
      role: opts.budget.role ?? "builder",
      estimatedTokens: estimate,
      toolCallsSoFar: opts.toolCallsSoFar ?? 0,
    });
    if (!reserved.ok) {
      return {
        ok: false,
        error: reserved.reason ?? "budget_exhausted",
        budgetExhausted: reserved.code === "budget_exhausted",
      };
    }
    reservationRunId = reserved.run?.id;
    reservedTokens = reserved.reservation ?? estimate;
  }

  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = llmModel();

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.3,
        messages: opts.messages,
        tools: opts.tools?.length ? opts.tools : undefined,
        tool_choice: opts.tools?.length ? "auto" : undefined,
      }),
    });
    const raw: any = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        error: raw?.error?.message || `OpenAI HTTP ${res.status}`,
        statusCode: res.status,
      };
    }
    const choice = raw?.choices?.[0]?.message;
    const toolCalls: LlmToolCall[] = Array.isArray(choice?.tool_calls)
      ? choice.tool_calls
      : [];
    const content =
      typeof choice?.content === "string" ? choice.content : null;

    const provider = extractProviderUsage(raw);
    const usage: LlmUsage = provider
      ? {
          promptTokens: provider.promptTokens,
          completionTokens: provider.completionTokens,
          totalTokens: provider.totalTokens,
          estimated: false,
        }
      : {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: estimateTokensFromMessages({
            messages: opts.messages,
            completion: content,
            toolCallCount: toolCalls.length,
          }),
          estimated: true,
        };

    if (opts.budget?.missionId && reservationRunId) {
      const recorded = recordBudget({
        missionId: opts.budget.missionId,
        runId: reservationRunId,
        usage: {
          ...usage,
          reservedTokens,
        },
        toolCallCount: toolCalls.length,
      });
      if (!recorded.ok && recorded.code === "budget_exhausted") {
        return {
          ok: true,
          content,
          toolCalls,
          model,
          raw,
          usage,
        };
      }
    }

    return {
      ok: true,
      content,
      toolCalls,
      model,
      raw,
      usage,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "llm_network_error" };
  }
}

export function toOpenAiTools(
  tools: { name: string; description: string; inputSchema: Record<string, unknown> }[],
): LlmToolDef[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

/**
 * Machine-readable outcome of contacting the LLM provider.
 *
 * `not_configured` and every failure kind mean no model produced the reply, so
 * callers must not report the run as completed work.
 */
export type ProviderOutcome =
  | "ok"
  | "not_configured"
  | "timeout"
  | "unavailable"
  | "budget_exhausted"
  | "error";

/** Classify a provider failure into a stable, machine-readable kind. */
export function classifyProviderError(input: {
  error?: string;
  statusCode?: number;
  budgetExhausted?: boolean;
}): Exclude<ProviderOutcome, "ok"> {
  if (input.budgetExhausted) return "budget_exhausted";
  const msg = (input.error ?? "").toLowerCase();
  if (/mangler|missing|not configured|no api key/.test(msg)) return "not_configured";
  if (/timeout|timed out|etimedout|abort/.test(msg)) return "timeout";
  if (input.statusCode === 429 || (input.statusCode ?? 0) >= 500) return "unavailable";
  if (/network|econnrefused|enotfound|fetch failed/.test(msg)) return "unavailable";
  return "error";
}

/** True when the reply did not come from a real model call. */
export function isSimulatedOutcome(outcome: ProviderOutcome): boolean {
  return outcome !== "ok";
}
