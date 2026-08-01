// INV-12 compliance-determinism test · Sprint 6 blocker B12
// Kontrakt: lib/agents.ts:327 (AGENT_COMPLIANCE_MODE) + lib/orchestrator.ts:20,309
//   "INV-12 determinisme → compliance-mode agenter kører temp=0"

import { describe, it, expect } from "vitest";
import { buildOrchestrator, type LLMCaller } from "@/lib/orchestrator";
import {
  AGENT_COMPLIANCE_MODE,
  AGENT_DEPLOYMENT_STATUS,
  type AgentId,
} from "@/lib/agents";

function makeCaptureStub(targetAgent: AgentId) {
  const captured: { temperature?: number; workerCalls: number } = { workerCalls: 0 };
  let supervisorCalls = 0;

  const llmCall: LLMCaller = async (input) => {
    if (input.jsonSchema) {
      supervisorCalls += 1;
      if (supervisorCalls === 1) {
        return {
          content: JSON.stringify({ next: targetAgent, reason: "inv-12-test" }),
          json: { next: targetAgent, reason: "inv-12-test" },
          usage: { prompt: 1, completion: 1 },
        };
      }
      return {
        content: '{"next":"FINISH","reason":"inv-12-test-done"}',
        json: { next: "FINISH", reason: "inv-12-test-done" },
        usage: { prompt: 1, completion: 1 },
      };
    }
    captured.temperature = input.temperature;
    captured.workerCalls += 1;
    return { content: "worker svar", usage: { prompt: 1, completion: 1 } };
  };

  return { llmCall, captured };
}

const DISPATCHABLE: AgentId[] = (Object.keys(AGENT_DEPLOYMENT_STATUS) as AgentId[]).filter(
  (id) => AGENT_DEPLOYMENT_STATUS[id] !== "deprecated",
);

const complianceAgents = DISPATCHABLE.filter((id) => AGENT_COMPLIANCE_MODE[id]);
const nonComplianceAgents = DISPATCHABLE.filter((id) => !AGENT_COMPLIANCE_MODE[id]);

describe("INV-12 · compliance-mode determinisme (temperature=0)", () => {
  it("(setup) begge grupper — compliance og non-compliance — er ikke-tomme", () => {
    expect(complianceAgents.length).toBeGreaterThan(0);
    expect(nonComplianceAgents.length).toBeGreaterThan(0);
  });

  it.each(complianceAgents)(
    "(a) happy-path: compliance-mode agent '%s' kaldes med temperature===0",
    async (agentId) => {
      const { llmCall, captured } = makeCaptureStub(agentId);
      const orch = buildOrchestrator({ llmCall });
      const result = await orch.invoke({
        tenantId: `test-tenant-inv12-${agentId}`,
        actorRole: "owner",
        tenantMdrStatus: "ce_marked",
        origin: "api",
        messages: [{ role: "user", content: "compliance determinism check" }],
      });

      expect(result.status).toBe("done");
      expect(captured.workerCalls).toBe(1);
      expect(captured.temperature).toBe(0);
    },
  );

  it.each(nonComplianceAgents)(
    "(b) failure-mode: non-compliance agent '%s' kaldes IKKE med temperature=0",
    async (agentId) => {
      const { llmCall, captured } = makeCaptureStub(agentId);
      const orch = buildOrchestrator({ llmCall });
      const result = await orch.invoke({
        tenantId: `test-tenant-inv12-${agentId}`,
        actorRole: "owner",
        tenantMdrStatus: "ce_marked",
        origin: "api",
        messages: [{ role: "user", content: "compliance determinism check" }],
      });

      expect(result.status).toBe("done");
      expect(captured.workerCalls).toBe(1);
      expect(captured.temperature).not.toBe(0);
      expect(captured.temperature).toBe(0.4);
    },
  );

  it("(c) regression-lås: klinisk/compliance-kritiske agenter forbliver determinisk-flaggede", () => {
    expect(AGENT_COMPLIANCE_MODE.niels).toBe(true);
    expect(AGENT_COMPLIANCE_MODE.sigrid).toBe(true);
    expect(AGENT_COMPLIANCE_MODE.frej).toBe(true);
    expect(AGENT_COMPLIANCE_MODE.atlas).toBe(true);
    expect(AGENT_COMPLIANCE_MODE.aria).toBe(false);
  });
});
