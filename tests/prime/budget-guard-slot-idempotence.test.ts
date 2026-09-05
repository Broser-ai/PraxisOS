// Slot release must be idempotent per run.
//
// #55 closed the leak but each finalisation decremented unconditionally, so
// finalising the same run twice freed a concurrent run's slot.

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

function mission(budgets?: Partial<Mission["budgets"]>): Mission {
  const drafted = draftMission({
    tenantSlug: "bypilar",
    title: "Slot idempotence",
    goal: "verify slot accounting",
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

const usage = (t: number) => ({
  promptTokens: 0,
  completionTokens: t,
  totalTokens: t,
  estimated: false,
  reservedTokens: 0,
});

const agents = (id: string) => getMission(id)!.usage.agents;

describe("budget guard · slot release is idempotent", () => {
  beforeEach(() => resetMissionStoreForTests());

  it("releasing the same run twice frees only its own slot", () => {
    const m = mission();
    const first = reserve(m.id);
    reserve(m.id);
    expect(agents(m.id)).toBe(2);

    releaseBudgetReservation({ missionId: m.id, runId: first.id, reason: "one" });
    releaseBudgetReservation({ missionId: m.id, runId: first.id, reason: "again" });

    expect(agents(m.id)).toBe(1);
  });

  it("record then release on the same run frees only one slot", () => {
    const m = mission();
    const first = reserve(m.id);
    reserve(m.id);

    recordBudget({ missionId: m.id, runId: first.id, usage: usage(10) });
    releaseBudgetReservation({ missionId: m.id, runId: first.id, reason: "late" });

    expect(agents(m.id)).toBe(1);
  });

  it("recording the same run twice frees only one slot", () => {
    const m = mission();
    const first = reserve(m.id);
    reserve(m.id);

    recordBudget({ missionId: m.id, runId: first.id, usage: usage(10) });
    recordBudget({ missionId: m.id, runId: first.id, usage: usage(10) });

    expect(agents(m.id)).toBe(1);
  });

  it("two concurrent runs each release their own slot", () => {
    const m = mission();
    const a = reserve(m.id);
    const b = reserve(m.id);
    expect(agents(m.id)).toBe(2);

    recordBudget({ missionId: m.id, runId: a.id, usage: usage(10) });
    expect(agents(m.id)).toBe(1);
    recordBudget({ missionId: m.id, runId: b.id, usage: usage(10) });
    expect(agents(m.id)).toBe(0);
  });

  it("a budget stop still returns the slot exactly once", () => {
    const m = mission({ maxTotalTokens: 100 });
    const a = reserve(m.id);
    reserve(m.id);

    recordBudget({ missionId: m.id, runId: a.id, usage: usage(5_000) });
    releaseBudgetReservation({ missionId: m.id, runId: a.id, reason: "after_stop" });

    expect(agents(m.id)).toBe(1);
  });

  it("count never goes negative", () => {
    const m = mission();
    const a = reserve(m.id);
    for (let i = 0; i < 5; i += 1) {
      releaseBudgetReservation({ missionId: m.id, runId: a.id, reason: `r${i}` });
    }
    expect(agents(m.id)).toBe(0);
  });
});
