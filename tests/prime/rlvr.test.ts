import { beforeEach, describe, expect, it } from "vitest";
import {
  PRIME_INVARIANTS,
  adjudicatePolicyProposal,
  assertPrimeIntentAllowed,
  listQuizItems,
  meanReward,
  pathologyShadowStatus,
  resetPrimeLedgerForTests,
  resetPrimePolicyForTests,
  runPrimeCycle,
  scoreQuizAnswer,
  getQuizItem,
} from "@/lib/prime";
import {
  enqueueSwarmTask,
  executeSwarmTask,
  resetSwarmMemoryForTests,
  SWARM_AGENT_ROLES,
  SWARM_INVARIANTS,
} from "@/lib/swarm";

describe("Prime RLVR", () => {
  beforeEach(() => {
    resetPrimeLedgerForTests();
    resetPrimePolicyForTests();
    resetSwarmMemoryForTests();
  });

  it("locks safety invariants", () => {
    expect(PRIME_INVARIANTS.NO_MODEL_TRAINING).toBe(true);
    expect(PRIME_INVARIANTS.NO_AUTONOMOUS_CLINICAL).toBe(true);
    expect(PRIME_INVARIANTS.PATHOLOGY_SHADOW_UNTIL_GATES).toBe(true);
    expect(PRIME_INVARIANTS.HUMAN_ADJUDICATION_REQUIRED).toBe(true);
    expect(pathologyShadowStatus().used_for_routing).toBe(false);
    expect(SWARM_INVARIANTS.NO_AUTO_MERGE).toBe(true);
  });

  it("scores verifiable quiz rewards exactly", () => {
    const item = getQuizItem("q_anat_02");
    expect(item).toBeTruthy();
    const ok = scoreQuizAnswer(item!, "Calcaneus");
    expect(ok.correct).toBe(true);
    expect(ok.reward).toBe(1);
    const miss = scoreQuizAnswer(item!, "talus");
    expect(miss.reward).toBe(0);
    expect(meanReward([ok, miss])).toBe(0.5);
  });

  it("ships a class_0 quiz pack (≥20)", () => {
    expect(listQuizItems().length).toBeGreaterThanOrEqual(20);
  });

  it("rejects clinical autonomy briefs", () => {
    const gate = assertPrimeIntentAllowed("Please diagnose the ulcer and treat");
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.code).toBe("prime_clinical_intent_forbidden");
    }
  });

  it("runs a cycle and requires human policy adjudication", () => {
    const result = runPrimeCycle({
      tenantSlug: "bypilar",
      brief: "RLVR anatomy probe · class_0 education",
      attempts: [
        { itemId: "q_anat_02", answer: "calcaneus" },
        { itemId: "q_comp_01", answer: "no_auto_merge" },
      ],
      proposePolicy: true,
    });
    expect(result.ok).toBe(true);
    expect(result.meanReward).toBe(1);
    expect(result.proposals.length).toBe(1);
    expect(result.proposals[0].status).toBe("awaiting_human");
    expect(result.proposals[0].clinicalImpact).toBe("none");

    const rejected = adjudicatePolicyProposal({
      proposalId: result.proposals[0].id,
      approve: true,
      adjudicator: "Dr. Broser",
      approveToken: "wrong",
    });
    expect("error" in rejected).toBe(true);

    const approved = adjudicatePolicyProposal({
      proposalId: result.proposals[0].id,
      approve: true,
      adjudicator: "Dr. Broser",
      approveToken: "I-APPROVE-PRIME",
    });
    expect("error" in approved).toBe(false);
    if (!("error" in approved)) {
      expect(approved.status).toBe("approved");
    }
  });

  it("routes rl_eval swarm tasks to PRIME_RL and awaits human", async () => {
    expect(SWARM_AGENT_ROLES.PRIME_RL).toMatch(/RLVR/);
    const task = enqueueSwarmTask({
      type: "rl_eval",
      title: "Prime quiz probe",
      brief: "Run verifiable-reward quiz sample for e-learning",
      tenantSlug: "bypilar",
    });
    expect(task.assignedTo).toBe("PRIME_RL");
    const done = await executeSwarmTask(task.id);
    expect(done.assignedTo).toBe("PRIME_RL");
    expect(done.status).toBe("awaiting_human");
    expect(done.resultSummary).toContain("Prime RLVR");
  });
});
