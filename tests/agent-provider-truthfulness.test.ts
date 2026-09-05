// Provider truthfulness guards.
//
// The runtime previously marked a run "completed" even when OPENAI_API_KEY was
// absent or the provider call failed, because it silently fell back to a local
// heuristic. A tick could therefore look like finished work with no model
// involved at all.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyProviderError,
  isSimulatedOutcome,
  type ProviderOutcome,
} from "@/lib/agents/llm";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("provider outcome · classification", () => {
  it("maps a missing key to not_configured", () => {
    expect(classifyProviderError({ error: "OPENAI_API_KEY mangler" })).toBe(
      "not_configured",
    );
    expect(classifyProviderError({ error: "no api key configured" })).toBe(
      "not_configured",
    );
  });

  it("maps timeouts", () => {
    for (const msg of ["Request timeout", "ETIMEDOUT", "The operation was aborted"]) {
      expect(classifyProviderError({ error: msg })).toBe("timeout");
    }
  });

  it("maps rate limits and 5xx to unavailable", () => {
    expect(classifyProviderError({ error: "OpenAI HTTP 429", statusCode: 429 })).toBe(
      "unavailable",
    );
    expect(classifyProviderError({ error: "OpenAI HTTP 503", statusCode: 503 })).toBe(
      "unavailable",
    );
    expect(classifyProviderError({ error: "fetch failed" })).toBe("unavailable");
  });

  it("maps budget exhaustion ahead of everything else", () => {
    expect(
      classifyProviderError({ error: "timeout", budgetExhausted: true }),
    ).toBe("budget_exhausted");
  });

  it("falls back to error for anything unrecognised", () => {
    expect(classifyProviderError({ error: "something odd" })).toBe("error");
  });

  it("treats every non-ok outcome as simulated", () => {
    const kinds: ProviderOutcome[] = [
      "not_configured",
      "timeout",
      "unavailable",
      "budget_exhausted",
      "error",
    ];
    for (const k of kinds) expect(isSimulatedOutcome(k)).toBe(true);
    expect(isSimulatedOutcome("ok")).toBe(false);
  });
});

describe("agent runtime · missing provider configuration", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();
  });

  it("blocks the run instead of completing it", async () => {
    const { runAgent, SIMULATED_PREFIX } = await import("@/lib/agents/runtime");
    const res = await runAgent({
      agentId: "aria",
      message: "Hvornår har I åbent?",
      tenant: "bypilar",
      trigger: "chat",
      autoRoute: false,
    });

    expect(res.run.status).toBe("blocked");
    expect(res.run.status).not.toBe("completed");
    expect(res.run.simulated).toBe(true);
    expect(res.run.providerOutcome).toBe("not_configured");
    expect(res.run.error).toBe("provider_not_configured");
    expect(res.reply).toContain(SIMULATED_PREFIX);
  });

  it("does not claim approval is pending for simulated work", async () => {
    const { runAgent } = await import("@/lib/agents/runtime");
    const res = await runAgent({
      agentId: "aria",
      message: "Book en tid",
      tenant: "bypilar",
      trigger: "chat",
      autoRoute: false,
    });
    expect(res.run.requiresApproval).toBe(false);
  });

  it("labels the reply as non-executing", async () => {
    const { runAgent, SIMULATED_PREFIX } = await import("@/lib/agents/runtime");
    const res = await runAgent({
      agentId: "aria",
      message: "hej",
      tenant: "bypilar",
      trigger: "chat",
      autoRoute: false,
    });
    expect(SIMULATED_PREFIX).toMatch(/simulated/i);
    expect(SIMULATED_PREFIX).toMatch(/non-executing/i);
    expect(SIMULATED_PREFIX).toMatch(/not a real LLM result/i);
    expect(res.reply.startsWith(SIMULATED_PREFIX)).toBe(true);
  });
});

describe("agent runtime · provider reached but failing", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
    vi.resetModules();
  });

  it("fails the run when the provider call errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch failed");
      }),
    );
    const { runAgent } = await import("@/lib/agents/runtime");
    const res = await runAgent({
      agentId: "aria",
      message: "hej",
      tenant: "bypilar",
      trigger: "chat",
      autoRoute: false,
    });

    expect(res.run.status).toBe("failed");
    expect(res.run.status).not.toBe("completed");
    expect(res.run.simulated).toBe(true);
    expect(res.run.providerOutcome).toBe("unavailable");
  });

  it("fails the run on an HTTP error from the provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "OpenAI HTTP 503" } }), {
          status: 503,
        }),
      ),
    );
    const { runAgent } = await import("@/lib/agents/runtime");
    const res = await runAgent({
      agentId: "aria",
      message: "hej",
      tenant: "bypilar",
      trigger: "chat",
      autoRoute: false,
    });

    expect(["failed", "blocked"]).toContain(res.run.status);
    expect(res.run.simulated).toBe(true);
    expect(res.run.status).not.toBe("completed");
  });
});

describe("agent runtime · genuine provider success", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
    vi.resetModules();
  });

  it("still completes and is not marked simulated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { role: "assistant", content: "Vi har åbent 9-16." } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const { runAgent, SIMULATED_PREFIX } = await import("@/lib/agents/runtime");
    const res = await runAgent({
      agentId: "aria",
      message: "Hvornår har I åbent?",
      tenant: "bypilar",
      trigger: "chat",
      autoRoute: false,
    });

    expect(res.run.status).toBe("completed");
    expect(res.run.simulated).toBe(false);
    expect(res.run.providerOutcome).toBe("ok");
    expect(res.reply).not.toContain(SIMULATED_PREFIX);
  });
});
