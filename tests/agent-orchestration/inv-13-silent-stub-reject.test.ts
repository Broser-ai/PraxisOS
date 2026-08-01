// INV-13 · silent-stub reject i klinisk tier
// Kontrakt: lib/orchestrator.ts:21 (invariant-erklæring) + lib/orchestrator.ts:469-482
//   (invoke() try/catch — ethvert throw fra graph-eksekvering konverteres til
//   et struktureret { status: "error", error: { code, message } } svar, ALDRIG
//   et tavst fallback/stub-svar der udgiver sig for at være en succesfuld run)
//
// Beviser at:
//   a) Happy-path — en klinisk-tier agent (niels/atlas) der svarer normalt,
//      returnerer status "done" med agentens EGET (ikke-tomt, ikke-stub) indhold.
//   b) Failure-mode — når den underliggende LLM-kalder for en klinisk-tier
//      worker fejler (kaster en exception), MÅ orchestratoren IKKE tavst
//      fortsætte og syntetisere et stub-svar der ligner en succesfuld run.
//      Fejlen skal bubble op som et struktureret error-resultat: status
//      "error", tomt output (ingen fabrikeret assistant-besked), nulstillet
//      tokenUsage, og error.message der uændret bærer den oprindelige fejltekst.

import { describe, it, expect } from "vitest";
import { buildOrchestrator, type LLMCaller } from "@/lib/orchestrator";
import { AGENT_MODEL_TIER, AGENT_DEPLOYMENT_STATUS, type AgentId } from "@/lib/agents";

const clinicalAgents = (Object.keys(AGENT_MODEL_TIER) as AgentId[]).filter(
  (id) => AGENT_MODEL_TIER[id] === "clinical" && AGENT_DEPLOYMENT_STATUS[id] !== "deprecated",
);

function makeHappyStub(targetAgent: AgentId, realContent: string) {
  let supervisorCalls = 0;
  const llmCall: LLMCaller = async (input) => {
    if (input.jsonSchema) {
      supervisorCalls += 1;
      if (supervisorCalls === 1) {
        return {
          content: JSON.stringify({ next: targetAgent, reason: "inv-13-happy" }),
          json: { next: targetAgent, reason: "inv-13-happy" },
          usage: { prompt: 1, completion: 1 },
        };
      }
      return {
        content: '{"next":"FINISH","reason":"inv-13-happy-done"}',
        json: { next: "FINISH", reason: "inv-13-happy-done" },
        usage: { prompt: 1, completion: 1 },
      };
    }
    return { content: realContent, usage: { prompt: 3, completion: 5 } };
  };
  return llmCall;
}

function makeFailingStub(targetAgent: AgentId, failureMessage: string) {
  const llmCall: LLMCaller = async (input) => {
    if (input.jsonSchema) {
      return {
        content: JSON.stringify({ next: targetAgent, reason: "inv-13-failure" }),
        json: { next: targetAgent, reason: "inv-13-failure" },
        usage: { prompt: 1, completion: 1 },
      };
    }
    // Simulerer en LLM-provider-fejl for den kliniske worker. En naiv
    // implementering kunne fristes til at fange denne og returnere et
    // stille stub-svar ("noget gik galt, prøv igen") for at holde runnet
    // "grønt". INV-13 forbyder præcis dette — fejlen skal bubble op rå.
    throw new Error(failureMessage);
  };
  return llmCall;
}

describe("INV-13 · silent-stub reject i klinisk tier", () => {
  it("(setup) klinisk tier er ikke tom og indeholder niels + atlas", () => {
    expect(clinicalAgents.length).toBeGreaterThan(0);
    expect(clinicalAgents).toEqual(expect.arrayContaining(["niels", "atlas"]));
  });

  it.each(clinicalAgents)(
    "(a) happy-path: klinisk agent '%s' returnerer sit eget indhold ved succes",
    async (agentId) => {
      const realContent = `${agentId}-ægte-klinisk-svar-${Date.now()}`;
      const orch = buildOrchestrator({ llmCall: makeHappyStub(agentId, realContent) });
      const result = await orch.invoke({
        tenantId: `test-tenant-inv13-happy-${agentId}`,
        actorRole: "owner",
        tenantMdrStatus: "ce_marked",
        origin: "api",
        messages: [{ role: "user", content: "inv-13 happy path check" }],
      });

      expect(result.status).toBe("done");
      expect(result.error).toBeUndefined();
      expect(result.finalAgent).toBe(agentId);
      const workerMsg = result.output.find((m) => m.from === agentId);
      expect(workerMsg?.content).toBe(realContent);
    },
  );

  it.each(clinicalAgents)(
    "(b) failure-mode: LLM-fejl for klinisk agent '%s' bubbler op som struktureret error — intet stille stub-svar",
    async (agentId) => {
      const failureMessage = `upstream LLM provider unavailable for ${agentId} (simuleret INV-13-scenarie)`;
      const orch = buildOrchestrator({ llmCall: makeFailingStub(agentId, failureMessage) });
      const result = await orch.invoke({
        tenantId: `test-tenant-inv13-fail-${agentId}`,
        actorRole: "owner",
        tenantMdrStatus: "ce_marked",
        origin: "api",
        messages: [{ role: "user", content: "inv-13 failure path check" }],
      });

      // Kernebevis: run må IKKE stille falde tilbage til "done" med et
      // fabrikeret/stub assistant-svar der camouflerer den reelle fejl.
      expect(result.status).toBe("error");
      expect(result.status).not.toBe("done");
      expect(result.finalAgent).toBeNull();
      expect(result.output).toEqual([]);
      expect(result.tokenUsage).toEqual({ prompt: 0, completion: 0 });

      // Fejlen skal være struktureret OG bære den oprindelige fejltekst
      // uændret — ikke omskrevet til en generisk stille "noget gik galt".
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("RUNTIME_ERROR");
      expect(result.error?.message).toBe(failureMessage);

      // Ingen besked i output-arrayet må indeholde stub-lignende erstatningstekst.
      const serialized = JSON.stringify(result.output);
      expect(serialized).not.toMatch(/stub|fallback|placeholder/i);
    },
  );

  it("(c) regression-lås: niels + atlas forbliver klinisk-tier agenter", () => {
    expect(AGENT_MODEL_TIER.niels).toBe("clinical");
    expect(AGENT_MODEL_TIER.atlas).toBe("clinical");
  });
});
