// The opt-in simulated fallback must not report success.
//
// finishSimulated() marked the run "completed" and relied on separate
// truthfulness fields to signal that no model ran. Any consumer filtering on
// status === "completed" would count it as finished work.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  vi.restoreAllMocks();
  vi.resetModules();
});

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  vi.resetModules();
});

async function run(allowSimulatedFallback: boolean) {
  const { runAgent } = await import("@/lib/agents/runtime");
  return runAgent({
    agentId: "aria",
    message: "hej",
    tenant: "bypilar",
    trigger: "chat",
    autoRoute: false,
    allowSimulatedFallback,
  } as never);
}

describe("simulated fallback · never reports success", () => {
  it("opt-in simulated run is not completed", async () => {
    const res = await run(true);
    expect(res.run.status).not.toBe("completed");
    expect(res.run.status).toBe("blocked");
  });

  it("opt-in simulated run keeps its truthfulness markers", async () => {
    const res = await run(true);
    const r = res.run as unknown as Record<string, unknown>;
    expect(r.simulated).toBe(true);
    expect(r.nonExecuting).toBe(true);
    expect(r.notRealLlmResult).toBe(true);
    expect(res.mode).toBe("simulated");
  });

  it("default path without opt-in is still blocked", async () => {
    const res = await run(false);
    expect(res.run.status).not.toBe("completed");
  });

  it("no fallback path reports a success-like status", async () => {
    for (const allow of [true, false]) {
      const res = await run(allow);
      expect(["completed", "awaiting_approval"]).not.toContain(res.run.status);
    }
  });
});
