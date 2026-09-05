import { describe, it, expect, beforeEach } from "vitest";
import {
  recordBudget,
  releaseAgentSlot,
  reserveBudget,
  sanitizeMissionBudgets,
} from "@/lib/prime/budget-guard";
import {
  approveMission,
  draftMission,
  getMission,
  getMissionRun,
  resetMissionStoreForTests,
  startMission,
  updateMission,
} from "@/lib/prime";

function bootMission(budgets?: Record<string, number>) {
  const draft = draftMission({
    tenantSlug: "bypilar",
    title: "Budget guard slot accounting",
    goal: "Prove agent slots release exactly once",
    createdBy: "acc_pilar",
    riskLevel: "green",
    budgets,
  });
  const approved = approveMission({
    missionId: draft.id,
    actor: "acc_pilar",
    actorRole: "owner",
  });
  if ("error" in approved) throw new Error(approved.error);
  const started = startMission({ missionId: draft.id, actor: "acc_pilar" });
  if ("error" in started) throw new Error(started.error);
  return started;
}

function reserveOne(missionId: string) {
  const reserved = reserveBudget({
    missionId,
    role: "builder",
    estimatedTokens: 80,
  });
  expect(reserved.ok).toBe(true);
  expect(reserved.run).toBeDefined();
  return reserved.run!;
}

function recordedUsage(totalTokens: number) {
  return {
    promptTokens: Math.floor(totalTokens / 2),
    completionTokens: Math.ceil(totalTokens / 2),
    totalTokens,
    estimated: false,
    reservedTokens: 80,
  };
}

describe("BudgetGuard agent-slot accounting", () => {
  beforeEach(() => {
    resetMissionStoreForTests();
  });

  it("counts the reserved slot down when the run completes", () => {
    const m = bootMission({ maxAgents: 2 });
    const run = reserveOne(m.id);
    expect(getMission(m.id)!.usage.agents).toBe(1);

    const recorded = recordBudget({
      missionId: m.id,
      runId: run.id,
      usage: recordedUsage(40),
    });
    expect(recorded.ok).toBe(true);
    expect(getMissionRun(run.id)?.status).toBe("completed");
    expect(getMission(m.id)!.usage.agents).toBe(0);
  });

  it("counts the reserved slot down when the run fails", () => {
    const m = bootMission({ maxAgents: 2 });
    const run = reserveOne(m.id);
    const released = releaseAgentSlot({
      missionId: m.id,
      runId: run.id,
      reason: "failed",
    });
    expect(released.ok).toBe(true);
    expect(getMissionRun(run.id)?.status).toBe("failed");
    expect(getMission(m.id)!.usage.agents).toBe(0);
  });

  it("counts the reserved slot down when the run is blocked", () => {
    const m = bootMission({ maxAgents: 2 });
    const run = reserveOne(m.id);
    const released = releaseAgentSlot({
      missionId: m.id,
      runId: run.id,
      reason: "blocked",
    });
    expect(released.ok).toBe(true);
    expect(getMission(m.id)!.usage.agents).toBe(0);
  });

  it("counts the reserved slot down on timeout", () => {
    const m = bootMission({ maxAgents: 2 });
    const run = reserveOne(m.id);
    const released = releaseAgentSlot({
      missionId: m.id,
      runId: run.id,
      reason: "timeout",
    });
    expect(released.ok).toBe(true);
    expect(getMission(m.id)!.usage.agents).toBe(0);
  });

  it("counts the reserved slot down on cancellation", () => {
    const m = bootMission({ maxAgents: 2 });
    const run = reserveOne(m.id);
    const released = releaseAgentSlot({
      missionId: m.id,
      runId: run.id,
      reason: "cancelled",
    });
    expect(released.ok).toBe(true);
    expect(getMission(m.id)!.usage.agents).toBe(0);
  });

  it("counts the reserved slot down on budget stop", () => {
    const m = bootMission({
      maxAgents: 2,
      maxTotalTokens: 80,
      maxTokensPerRun: 200,
    });
    const reserved = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 64,
    });
    expect(reserved.ok).toBe(true);
    const run = reserved.run!;
    expect(getMission(m.id)!.usage.agents).toBe(1);

    const stopped = recordBudget({
      missionId: m.id,
      runId: run.id,
      usage: recordedUsage(90),
    });
    expect(stopped.ok).toBe(false);
    expect(stopped.code).toBe("budget_exhausted");
    expect(getMission(m.id)?.status).toBe("budget_exhausted");
    expect(getMissionRun(run.id)?.status).toBe("budget_exhausted");
    expect(getMission(m.id)!.usage.agents).toBe(0);
  });

  it("does not decrement the same run twice", () => {
    const m = bootMission({ maxAgents: 3 });
    const run = reserveOne(m.id);
    expect(getMission(m.id)!.usage.agents).toBe(1);

    const first = releaseAgentSlot({
      missionId: m.id,
      runId: run.id,
      reason: "failed",
    });
    expect(first.ok).toBe(true);
    expect(getMission(m.id)!.usage.agents).toBe(0);

    const second = releaseAgentSlot({
      missionId: m.id,
      runId: run.id,
      reason: "failed",
    });
    expect(second.ok).toBe(true);
    expect(getMission(m.id)!.usage.agents).toBe(0);

    const afterComplete = recordBudget({
      missionId: m.id,
      runId: run.id,
      usage: recordedUsage(20),
    });
    expect(afterComplete.ok).toBe(false);
    expect(afterComplete.code).toBe("run_already_finished");
    expect(getMission(m.id)!.usage.agents).toBe(0);
  });

  it("never lets the agent count go negative", () => {
    const m = bootMission({ maxAgents: 1 });
    updateMission(m.id, {
      usage: { ...getMission(m.id)!.usage, agents: 0 },
    });
    const phantom = releaseAgentSlot({
      missionId: m.id,
      runId: "mrun_never_reserved",
      reason: "failed",
    });
    expect(phantom.ok).toBe(false);
    expect(getMission(m.id)!.usage.agents).toBe(0);

    const run = reserveOne(m.id);
    releaseAgentSlot({ missionId: m.id, runId: run.id, reason: "timeout" });
    releaseAgentSlot({ missionId: m.id, runId: run.id, reason: "cancelled" });
    releaseAgentSlot({ missionId: m.id, runId: run.id, reason: "completed" });
    expect(getMission(m.id)!.usage.agents).toBe(0);
    expect(getMission(m.id)!.usage.agents).toBeGreaterThanOrEqual(0);
  });

  it("allows a released slot to be reused by a later reservation", () => {
    const m = bootMission({ maxAgents: 1 });
    const first = reserveOne(m.id);
    expect(getMission(m.id)!.usage.agents).toBe(1);

    const secondWhileHeld = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 80,
    });
    expect(secondWhileHeld.ok).toBe(false);
    expect(secondWhileHeld.exhausted).toContain("maxAgents");
    expect(getMission(m.id)?.status).toBe("running");

    const released = releaseAgentSlot({
      missionId: m.id,
      runId: first.id,
      reason: "completed",
    });
    expect(released.ok).toBe(true);
    expect(getMission(m.id)!.usage.agents).toBe(0);

    const reused = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 80,
    });
    expect(reused.ok).toBe(true);
    expect(getMission(m.id)!.usage.agents).toBe(1);
  });

  it("rejects NaN, Infinity, null, and negative budgets", () => {
    const m = bootMission();
    expect(sanitizeMissionBudgets(null)).toBeNull();
    expect(
      sanitizeMissionBudgets({
        ...m.budgets,
        maxAgents: Number.NaN,
      }),
    ).toBeNull();
    expect(
      sanitizeMissionBudgets({
        ...m.budgets,
        maxTotalTokens: Number.POSITIVE_INFINITY,
      }),
    ).toBeNull();
    expect(
      sanitizeMissionBudgets({
        ...m.budgets,
        maxTokensPerRun: -1,
      }),
    ).toBeNull();

    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -8]) {
      const reserved = reserveBudget({
        missionId: m.id,
        role: "builder",
        estimatedTokens: bad,
      });
      expect(reserved.ok).toBe(false);
      expect(reserved.code).toBe("invalid_budget");
    }

    updateMission(m.id, {
      budgets: { ...m.budgets, maxAgents: Number.NaN as unknown as number },
    });
    const afterNaN = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 80,
    });
    expect(afterNaN.ok).toBe(false);
    expect(afterNaN.code).toBe("invalid_budget");
  });

  it("does not allow a retry after a hard budget stop", () => {
    const m = bootMission({
      maxAgents: 2,
      maxTotalTokens: 80,
      maxTokensPerRun: 200,
    });
    const reserved = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 64,
    });
    expect(reserved.ok).toBe(true);
    const run = reserved.run!;
    const stopped = recordBudget({
      missionId: m.id,
      runId: run.id,
      usage: recordedUsage(90),
    });
    expect(stopped.ok).toBe(false);
    expect(stopped.code).toBe("budget_exhausted");
    expect(getMission(m.id)?.status).toBe("budget_exhausted");

    const retrySame = recordBudget({
      missionId: m.id,
      runId: run.id,
      usage: recordedUsage(10),
    });
    expect(retrySame.ok).toBe(false);
    expect(retrySame.code).toBe("run_already_finished");

    const retryNew = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 80,
    });
    expect(retryNew.ok).toBe(false);
    expect(retryNew.code).toBe("budget_exhausted");
    expect(getMission(m.id)!.usage.agents).toBe(0);
  });
});
