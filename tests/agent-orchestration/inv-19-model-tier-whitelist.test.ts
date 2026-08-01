// INV-19 model-tier whitelist test
// Kontrakt: lib/agents.ts:341 (isAllowedModelForAgent) + lib/orchestrator.ts:24,306
//
// Beviser at:
//   a) Happy-path — hver agent's egen tier-model bestås af whitelisten
//      (dvs. isAllowedModelForAgent(agentId, MODEL_BY_TIER[tier]) === true
//      for samtlige agenter, på tværs af alle tre tiers: smart/clinical/fast)
//   b) Failure-mode — en model fra en ANDEN tier (eller en fri-tekst streng)
//      afvises for en given agent, uanset hvilken tier agenten selv har.
//      Dette er den invariant orchestrator.ts:305-307 læner sig på for at
//      kaste `INV-19 violation` før en worker-node kalder LLM'en.

import { describe, it, expect } from "vitest";
import {
  type AgentId,
  AGENT_MODEL_TIER,
  MODEL_BY_TIER,
  isAllowedModelForAgent,
} from "@/lib/agents";

const ALL_AGENT_IDS = Object.keys(AGENT_MODEL_TIER) as AgentId[];

describe("INV-19 · agent model-tier whitelist", () => {
  it("(a) happy-path — hver agents egen tier-model er tilladt", () => {
    // Forudsætning for testens meningsfuldhed: hver tier peger på sin EGEN
    // model-streng. Hvis to tiers nogensinde deler model-ID, bliver
    // failure-mode-testen nedenfor falsk-negativ uden at isAllowedModelForAgent
    // reelt er i stykker — så vi låser forudsætningen fast her.
    const modelIds = Object.values(MODEL_BY_TIER);
    expect(new Set(modelIds).size).toBe(modelIds.length);

    for (const agentId of ALL_AGENT_IDS) {
      const tier = AGENT_MODEL_TIER[agentId];
      const ownModel = MODEL_BY_TIER[tier];
      expect(isAllowedModelForAgent(agentId, ownModel)).toBe(true);
    }
  });

  it("(b) failure-mode — model uden for agentens whitelist afvises", () => {
    // Konkret cross-tier eksempel: "aria" er "fast" tier og må IKKE
    // godkendes til at køre "smart"-tier modellen (eller omvendt).
    expect(AGENT_MODEL_TIER.aria).toBe("fast");
    expect(isAllowedModelForAgent("aria", MODEL_BY_TIER.smart)).toBe(false);
    expect(isAllowedModelForAgent("frej", MODEL_BY_TIER.fast)).toBe(false);

    // Generaliseret: for enhver agent er enhver model fra en FREMMED tier
    // (inkl. en helt opdigtet model-streng) et whitelist-brud.
    const bogusModel = "gpt-not-on-any-whitelist";
    for (const agentId of ALL_AGENT_IDS) {
      const ownTier = AGENT_MODEL_TIER[agentId];
      for (const tier of Object.keys(MODEL_BY_TIER) as (keyof typeof MODEL_BY_TIER)[]) {
        if (tier === ownTier) continue;
        expect(isAllowedModelForAgent(agentId, MODEL_BY_TIER[tier])).toBe(false);
      }
      expect(isAllowedModelForAgent(agentId, bogusModel)).toBe(false);
    }
  });
});
