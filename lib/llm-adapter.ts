// PraxisOS · LLM adapter mod Anthropic Claude.
// Wrapper omkring @langchain/anthropic så orchestrator.ts kan forblive
// provider-agnostisk (og trivielt testbar via stub-LLMCaller).
//
// Miljø-variable:
//   ANTHROPIC_API_KEY   — påkrævet i prod
//   PRAXIS_LLM_MODE     — "live" | "stub" (default "stub" hvis nøgle mangler)

import { ChatAnthropic } from "@langchain/anthropic";
import type { LLMCaller, LLMCallInput, LLMCallResult } from "./orchestrator";

/** Live-adapter: rigtige Anthropic-kald. Skal have ANTHROPIC_API_KEY sat. */
export function createLiveLLMCaller(): LLMCaller {
  return async (input: LLMCallInput): Promise<LLMCallResult> => {
    const client = new ChatAnthropic({
      model: input.model,
      temperature: input.temperature,
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const langchainMessages = [
      { role: "system" as const, content: input.system },
      ...input.messages.map((m) => ({
        role:
          m.role === "assistant"
            ? ("assistant" as const)
            : m.role === "user"
              ? ("user" as const)
              : ("user" as const),
        content: m.content,
      })),
    ];

    const response = await client.invoke(langchainMessages);
    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    return {
      content,
      usage: {
        prompt: response.usage_metadata?.input_tokens ?? 0,
        completion: response.usage_metadata?.output_tokens ?? 0,
      },
    };
  };
}

/**
 * Stub-adapter: bruges i tests og når ANTHROPIC_API_KEY ikke er sat.
 * Returnerer minimalt gyldigt supervisor-svar (→ FINISH).
 */
export function createStubLLMCaller(): LLMCaller {
  return async (input: LLMCallInput): Promise<LLMCallResult> => {
    // Hvis supervisor beder om JSON, giv en FINISH-beslutning
    if (input.jsonSchema) {
      return {
        content: '{"next":"FINISH","reason":"stub"}',
        json: { next: "FINISH", reason: "stub" },
        usage: { prompt: 10, completion: 5 },
      };
    }
    return {
      content: "[stub-svar fra worker]",
      usage: { prompt: 15, completion: 8 },
    };
  };
}

/** Auto-vælger stub eller live baseret på env. */
export function createDefaultLLMCaller(): LLMCaller {
  const mode = process.env.PRAXIS_LLM_MODE;
  if (mode === "stub" || !process.env.ANTHROPIC_API_KEY) {
    return createStubLLMCaller();
  }
  return createLiveLLMCaller();
}
