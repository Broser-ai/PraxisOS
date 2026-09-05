/**
 * Agent runtime · provider failure truthfulness
 * Confirms missing/failing AI provider never looks like a finished successful run.
 * No external provider calls — fetch is always stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAgent } from "@/lib/agents/runtime";
import { chatCompletions, isLlmConfigured } from "@/lib/agents/llm";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;
const ORIGINAL_BASE = process.env.OPENAI_BASE_URL;
const ORIGINAL_TIMEOUT = process.env.OPENAI_TIMEOUT_MS;

function clearSecretsCache() {
  const g = globalThis as typeof globalThis & { __praxisSecretsCache?: unknown };
  g.__praxisSecretsCache = {};
}

function unsetProvider() {
  delete process.env.OPENAI_API_KEY;
  clearSecretsCache();
}

function setFakeProviderKey() {
  process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
  process.env.OPENAI_BASE_URL = "http://127.0.0.1:9"; // never hit real OpenAI
  clearSecretsCache();
}

function mockChatJson(body: unknown, init?: { status?: number }) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("agent runtime · provider failure truthfulness", () => {
  beforeEach(() => {
    unsetProvider();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
    if (ORIGINAL_BASE === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = ORIGINAL_BASE;
    if (ORIGINAL_TIMEOUT === undefined) delete process.env.OPENAI_TIMEOUT_MS;
    else process.env.OPENAI_TIMEOUT_MS = ORIGINAL_TIMEOUT;
    clearSecretsCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("missing provider config → blocked/failed, never success/FINISH", async () => {
    expect(isLlmConfigured()).toBe(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await runAgent({
      message: "book en tid",
      agentId: "aria",
      tenant: "bypilar",
      autoRoute: false,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.run.status).toBe("blocked");
    expect(result.run.errorCode).toBe("provider_unavailable");
    expect(result.run.status).not.toBe("completed");
    expect(result.reply).toMatch(/Ingen FINISH\/success/);
    expect(result.run.toolCalls).toEqual([]);
    expect(result.run.simulated).not.toBe(true);
  });

  it("provider timeout → provider_timeout, not completed", async () => {
    setFakeProviderKey();
    process.env.OPENAI_TIMEOUT_MS = "50";
    const timeoutErr = new Error("The operation was aborted due to timeout");
    timeoutErr.name = "TimeoutError";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw timeoutErr;
      }),
    );

    const result = await runAgent({
      message: "hej",
      agentId: "aria",
      tenant: "bypilar",
      autoRoute: false,
    });

    expect(result.run.status).toBe("failed");
    expect(result.run.errorCode).toBe("provider_timeout");
    expect(result.run.status).not.toBe("completed");
    expect(result.run.notRealLlmResult).toBe(true);
    expect(result.reply).toMatch(/provider_timeout/);
  });

  it("provider throw → provider_error, not completed", async () => {
    setFakeProviderKey();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED simulated");
      }),
    );

    const result = await runAgent({
      message: "hej",
      agentId: "aria",
      tenant: "bypilar",
      autoRoute: false,
    });

    expect(result.run.status).toBe("failed");
    expect(result.run.errorCode).toBe("provider_error");
    expect(result.run.error).toMatch(/ECONNREFUSED/);
    expect(result.run.status).not.toBe("completed");
  });

  it("simulated fallback is marked simulated + non_executing + not_real_llm_result and claims no work", async () => {
    expect(isLlmConfigured()).toBe(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await runAgent({
      message: "book en tid i morgen",
      agentId: "aria",
      tenant: "bypilar",
      autoRoute: false,
      allowSimulatedFallback: true,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.mode).toBe("simulated");
    expect(result.run.mode).toBe("simulated");
    expect(result.run.simulated).toBe(true);
    expect(result.run.nonExecuting).toBe(true);
    expect(result.run.notRealLlmResult).toBe(true);
    expect(result.run.toolCalls).toEqual([]);
    expect(result.run.errorCode).toBe("provider_unavailable");
    const lower = result.reply.toLowerCase();
    expect(lower).toMatch(/simulated/);
    expect(lower).toMatch(/non_executing/);
    expect(lower).toMatch(/not_real_llm_result/);
    expect(lower).toMatch(/ingen tool-kald/);
    // Must not claim booking/tool/model/code work was done
    expect(lower).not.toMatch(/jeg har reserveret/);
    expect(lower).not.toMatch(/soap-udkast klar/);
    expect(result.reply).not.toMatch(/\bFINISH\b/);
  });

  it("real provider success path still works (stubbed fetch, no external calls)", async () => {
    setFakeProviderKey();
    const fetchMock = mockChatJson({
      id: "chatcmpl-test",
      model: "gpt-4o-mini",
      choices: [
        {
          message: {
            role: "assistant",
            content: "Hej — jeg er Aria (live stub).",
            tool_calls: undefined,
          },
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runAgent({
      message: "hej aria",
      agentId: "aria",
      tenant: "bypilar",
      autoRoute: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit?];
    const calledUrl = String(firstCall?.[0] ?? "");
    expect(calledUrl).toContain("127.0.0.1:9");
    expect(calledUrl).not.toContain("api.openai.com");
    expect(result.mode).toBe("llm");
    expect(result.run.status).toBe("completed");
    expect(result.run.errorCode).toBeUndefined();
    expect(result.run.notRealLlmResult).toBe(false);
    expect(result.reply).toContain("Aria");
  });
});

describe("chatCompletions · machine-readable provider codes", () => {
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
    if (ORIGINAL_BASE === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = ORIGINAL_BASE;
    clearSecretsCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("missing key → provider_unavailable", async () => {
    unsetProvider();
    const res = await chatCompletions({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("provider_unavailable");
    }
  });

  it("HTTP 500 → provider_error", async () => {
    setFakeProviderKey();
    vi.stubGlobal(
      "fetch",
      mockChatJson({ error: { message: "boom" } }, { status: 500 }),
    );
    const res = await chatCompletions({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("provider_error");
      expect(res.statusCode).toBe(500);
    }
  });

  it("HTTP 503 → provider_unavailable", async () => {
    setFakeProviderKey();
    vi.stubGlobal(
      "fetch",
      mockChatJson({ error: { message: "unavailable" } }, { status: 503 }),
    );
    const res = await chatCompletions({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("provider_unavailable");
    }
  });
});
