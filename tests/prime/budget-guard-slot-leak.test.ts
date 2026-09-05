// Regression guard for the agent-slot leak in BudgetGuard.
// reserveBudget claims a slot in usage.agents; nothing returned it, so a
// mission eventually failed closed on maxAgents even when idle.

import { beforeEach, describe, expect, it } from "vitest";
import {
  approveMission,
  draftMission,
  getMission,
  recordBudget,
  releaseBudgetReservation,
  reserveBudget,
  resetMissionStoreForTests,
} from "@/lib/prime";
import type { Mission } from "@/lib/prime/mission-types";

function runningMission(budgets?: Partial<Mission["budgets"]>): Mission {
  const drafted = draftMission({
    tenantSlug: "bypilar",
    title: "Slot leak",
    goal: "exercise reservation lifecycle",
    createdBy: "michael",
    budgets: { maxTotalTokens: 1_000_000, maxTokensPerRun: 1_000_000, ...budgets },
  } as never) as { id: string };
  approveMission({
    missionId: drafted.id,
    actor: "michael",
    actorRole: "owner",
  } as never);
  return getMission(drafted.id)!;
}

function reserve(missionId: string) {
  const r = reserveBudget({ missionId, role: "builder", estimatedTokens: 100 });
  if (!r.ok || !r.run) throw new Error(`reserve failed: ${r.reason}`);
  return r.run;
}

const completedUsage = {
  promptTokens: 0,
  completionTokens: 10,
  totalTokens: 10,
  estimated: false,
  reservedTokens: 0,
};

describe("budget guard · reservation lifecycle", () => {
  beforeEach(() => resetMissionStoreForTests());

  it("claims a slot on reserve", () => {
    const m = runningMission();
    const before = getMission(m.id)!.usage.agents;
    reserve(m.id);
    expect(getMission(m.id)!.usage.agents).toBe(before + 1);
  });

  it("returns the slot when the run completes", () => {
    const m = runningMission();
    const before = getMission(m.id)!.usage.agents;
    const run = reserve(m.id);
    recordBudget({ missionId: m.id, runId: run.id, usage: completedUsage });
    expect(getMission(m.id)!.usage.agents).toBe(before);
  });

  it("returns the slot when the run is abandoned", () => {
    const m = runningMission();
    const before = getMission(m.id)!.usage.agents;
    const run = reserve(m.id);
    const res = releaseBudgetReservation({
      missionId: m.id,
      runId: run.id,
      reason: "provider_error",
    });
    expect(res.ok).toBe(true);
    expect(getMission(m.id)!.usage.agents).toBe(before);
  });

  it("does not exhaust maxAgents across sequential runs", () => {
    const m = runningMission({ maxAgents: 2 });
    for (let i = 0; i < 5; i += 1) {
      const run = reserve(m.id);
      const res = recordBudget({
        missionId: m.id,
        runId: run.id,
        usage: completedUsage,
      });
      expect(res.ok).toBe(true);
    }
    expect(getMission(m.id)!.status).not.toBe("budget_exhausted");
  });

  it("never drives the agent count below zero", () => {
    const m = runningMission();
    const run = reserve(m.id);
    releaseBudgetReservation({ missionId: m.id, runId: run.id, reason: "a" });
    releaseBudgetReservation({ missionId: m.id, runId: run.id, reason: "b" });
    expect(getMission(m.id)!.usage.agents).toBe(0);
  });

  it("reports run_not_found for an unknown run", () => {
    const m = runningMission();
    expect(
      releaseBudgetReservation({
        missionId: m.id,
        runId: "run_missing",
        reason: "x",
      }).code,
    ).toBe("run_not_found");
  });
});
