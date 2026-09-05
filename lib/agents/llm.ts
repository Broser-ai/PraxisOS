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

/** Machine-readable provider failure codes — never treat these as success. */
export type ProviderErrorCode =
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_error";

export type LlmChatResult =
  | {
      ok: true;
      content: string | null;
      toolCalls: LlmToolCall[];
      model: string;
      raw?: unknown;
      usage?: LlmUsage;
    }
  | {
      ok: false;
      error: string;
      code: ProviderErrorCode;
      statusCode?: number;
      budgetExhausted?: boolean;
    };

/** Optional mission budget context — when set, BudgetGuard reserve/record wraps the call. */
export type LlmBudgetContext = {
  missionId: string;
  workstreamId?: string;
  role?: MissionRole;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function llmTimeoutMs(): number {
  const raw = process.env.OPENAI_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name ?? "";
  const msg = String((err as { message?: string }).message ?? "").toLowerCase();
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("aborted")
  );
}

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
  if (!apiKey) {
    return {
      ok: false,
      error: "OPENAI_API_KEY mangler",
      code: "provider_unavailable",
    };
  }

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
        code: "provider_error",
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
  const timeoutMs = llmTimeoutMs();

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
      signal: AbortSignal.timeout(timeoutMs),
    });
    const raw: any = await res.json().catch(() => null);
    if (!res.ok) {
      const unavailable = res.status === 503 || res.status === 502 || res.status === 429;
      return {
        ok: false,
        error: raw?.error?.message || `OpenAI HTTP ${res.status}`,
        code: unavailable ? "provider_unavailable" : "provider_error",
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
    if (isTimeoutError(err)) {
      return {
        ok: false,
        error: err?.message || "llm_timeout",
        code: "provider_timeout",
      };
    }
    return {
      ok: false,
      error: err?.message || "llm_network_error",
      code: "provider_error",
    };
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
