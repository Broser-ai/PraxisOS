// INV-15 max-transitions test
// Kontrakt: docs/harness/EPIC-1-Orchestration.md §3.6
//
// Beviser at:
//   a) Graph terminerer efter MAX_STEPS også når LLM aldrig returnerer FINISH
//   b) Med maxSteps=3 override er stepCount i final state ≤ 3
//   c) Alle 9 workers kan invokes uden at trigger uendelig loop
//   d) Adversarial: LLM der returnerer forskellige next-agent hvert kald
//      terminerer stadig ved MAX_STEPS

import { describe, it, expect } from "vitest";
import {
  buildOrchestrator,
  MAX_STEPS,
  type LLMCaller,
} from "@/lib/orchestrator";
import { WORKER_IDS } from "@/lib/agents";

// Stub der ALDRIG returnerer FINISH — router altid til aria
const neverFinishStub: LLMCaller = async (input) => {
  if (input.jsonSchema) {
    return {
      content: '{"next":"aria","reason":"never-finish"}',
      json: { next: "aria", reason: "never-finish" },
      usage: { prompt: 1, completion: 1 },
    };
  }
  return { content: "keep going", usage: { prompt: 1, completion: 1 } };
};

// Adversarial: LLM der router til en ny agent hvert kald
function makeCycleStub(): LLMCaller {
  let idx = 0;
  return async (input) => {
    if (input.jsonSchema) {
      const next = WORKER_IDS[idx % WORKER_IDS.length];
      idx++;
      return {
        content: `{"next":"${next}","reason":"cycle"}`,
        json: { next, reason: "cycle" },
        usage: { prompt: 1, completion: 1 },
      };
    }
    return { content: "worker output", usage: { prompt: 1, completion: 1 } };
  };
}

describe("INV-15 · max node-transitions", () => {
  it("(a) default MAX_STEPS = 12", () => {
    expect(MAX_STEPS).toBe(12);
  });

  it("(b) LLM der aldrig svarer FINISH terminerer stadig — stepCount ≤ MAX_STEPS", async () => {
    const orch = buildOrchestrator({ llmCall: neverFinishStub });
    const result = await orch.invoke({
      tenantId: "test-tenant-11111111-1111-1111-1111-111111111111",
      actorRole: "practitioner",
      origin: "api",
      messages: [{ role: "user", content: "loop me" }],
    });
    // Graph skal terminere (ikke uendelig loop)
    expect(["done", "aborted"]).toContain(result.status);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.length).toBeLessThanOrEqual(MAX_STEPS);
    const lastStepIndex = result.steps[result.steps.length - 1].stepIndex;
    expect(lastStepIndex).toBeLessThanOrEqual(MAX_STEPS);
  });

  it("(c) maxSteps override virker — orchestrator med maxSteps=3 stopper ved 3", async () => {
    const orch = buildOrchestrator({ llmCall: neverFinishStub, maxSteps: 3 });
    const result = await orch.invoke({
      tenantId: "test-tenant-22222222-2222-2222-2222-222222222222",
      actorRole: "practitioner",
      origin: "api",
      messages: [{ role: "user", content: "short loop" }],
    });
    expect(["done", "aborted"]).toContain(result.status);
    // Skal ikke løbe mere end 3 steps
    expect(result.steps.length).toBeLessThanOrEqual(3);
  });

  it("(d) adversarial cycle-stub der router forskelligt hvert kald terminerer også", async () => {
    const orch = buildOrchestrator({ llmCall: makeCycleStub() });
    const result = await orch.invoke({
      tenantId: "test-tenant-33333333-3333-3333-3333-333333333333",
      actorRole: "owner",
      origin: "api",
      messages: [{ role: "user", content: "cycle through workers" }],
    });
    expect(["done", "aborted"]).toContain(result.status);
    expect(result.steps.length).toBeLessThanOrEqual(MAX_STEPS);
  });

  it("(e) LLM der returnerer FINISH straks — stepCount er lille", async () => {
    const finishStub: LLMCaller = async (input) => {
      if (input.jsonSchema) {
        return {
          content: '{"next":"FINISH","reason":"done"}',
          json: { next: "FINISH", reason: "done" },
          usage: { prompt: 1, completion: 1 },
        };
      }
      return { content: "ok", usage: { prompt: 1, completion: 1 } };
    };
    const orch = buildOrchestrator({ llmCall: finishStub });
    const result = await orch.invoke({
      tenantId: "test-tenant-44444444-4444-4444-4444-444444444444",
      actorRole: "practitioner",
      origin: "api",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.status).toBe("done");
    // Kun supervisor-step + END
    expect(result.steps.length).toBeLessThanOrEqual(2);
  });
});
