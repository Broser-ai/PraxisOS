// INV-16 token-loft test
// Kontrakt: lib/orchestrator.ts:23 + docs/harness/EPIC-1-Orchestration.md §3.6

import { describe, it, expect } from "vitest";
import {
  buildOrchestrator,
  DEFAULT_TOKEN_LIMIT,
  type LLMCaller,
} from "@/lib/orchestrator";

describe("INV-16 · token-loft", () => {
  it("(a) DEFAULT_TOKEN_LIMIT = 100_000", () => {
    expect(DEFAULT_TOKEN_LIMIT).toBe(100_000);
  });

  it("(b) happy-path: usage under loftet → status done, tokenUsage akkumuleret korrekt", async () => {
    const finishStub: LLMCaller = async (input) => {
      if (input.jsonSchema) {
        return {
          content: '{"next":"FINISH","reason":"done"}',
          json: { next: "FINISH", reason: "done" },
          usage: { prompt: 5, completion: 5 },
        };
      }
      return { content: "ok", usage: { prompt: 0, completion: 0 } };
    };

    const orch = buildOrchestrator({ llmCall: finishStub });
    const result = await orch.invoke({
      tenantId: "test-tenant-inv16-happy",
      actorRole: "practitioner",
      tenantMdrStatus: "ce_marked",
      tenantSlug: "test",
      origin: "api",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.status).toBe("done");
    expect(result.error).toBeUndefined();
    expect(result.tokenUsage.prompt + result.tokenUsage.completion).toBe(10);
  });

  it("(c) failure-mode: enkelt kald over custom tokenLimit → aborted + TOKEN_LIMIT_EXCEEDED", async () => {
    const overBudgetStub: LLMCaller = async (input) => {
      if (input.jsonSchema) {
        return {
          content: '{"next":"FINISH","reason":"done"}',
          json: { next: "FINISH", reason: "done" },
          usage: { prompt: 20, completion: 0 },
        };
      }
      return { content: "ok", usage: { prompt: 0, completion: 0 } };
    };

    const orch = buildOrchestrator({ llmCall: overBudgetStub });
    const result = await orch.invoke({
      tenantId: "test-tenant-inv16-overbudget",
      actorRole: "practitioner",
      tenantMdrStatus: "ce_marked",
      tenantSlug: "test",
      origin: "api",
      messages: [{ role: "user", content: "expensive request" }],
      tokenLimit: 10,
    });

    expect(result.status).toBe("aborted");
    expect(result.error?.code).toBe("TOKEN_LIMIT_EXCEEDED");
    expect(result.tokenUsage.prompt + result.tokenUsage.completion).toBe(20);
  });

  it("(d) failure-mode akkumuleret: loft håndhæves på summen af flere steps", async () => {
    let call = 0;
    const accumulatingStub: LLMCaller = async (input) => {
      call++;
      if (input.jsonSchema) {
        const next = call === 1 ? "aria" : "FINISH";
        return {
          content: `{"next":"${next}","reason":"step-${call}"}`,
          json: { next, reason: `step-${call}` },
          usage: { prompt: 10, completion: 0 },
        };
      }
      return { content: "worker output", usage: { prompt: 10, completion: 0 } };
    };

    const orch = buildOrchestrator({ llmCall: accumulatingStub });
    const result = await orch.invoke({
      tenantId: "test-tenant-inv16-accum",
      actorRole: "practitioner",
      tenantMdrStatus: "ce_marked",
      tenantSlug: "test",
      origin: "api",
      messages: [{ role: "user", content: "multi-step request" }],
      tokenLimit: 25,
    });

    expect(result.status).toBe("aborted");
    expect(result.error?.code).toBe("TOKEN_LIMIT_EXCEEDED");
    expect(result.tokenUsage.prompt + result.tokenUsage.completion).toBe(30);
  });
});
