// OpenAI-compatible chat completions via fetch (no SDK dependency)

import { resolveSecret } from "@/lib/secrets";

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

export type LlmChatResult =
  | {
      ok: true;
      content: string | null;
      toolCalls: LlmToolCall[];
      model: string;
      raw?: unknown;
    }
  | { ok: false; error: string; statusCode?: number };

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
}): Promise<LlmChatResult> {
  const apiKey = resolveSecret("OPENAI_API_KEY");
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY mangler" };

  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
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
    const toolCalls: LlmToolCall[] = Array.isArray(choice?.tool_calls) ? choice.tool_calls : [];
    return {
      ok: true,
      content: typeof choice?.content === "string" ? choice.content : null,
      toolCalls,
      model,
      raw,
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
