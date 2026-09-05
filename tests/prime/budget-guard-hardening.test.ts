import { describe, it, expect, beforeEach } from "vitest";
import {
  assertParallelWorkstreamBudget,
  assertRuntimeBudget,
  assertToolCallBudget,
  estimateTokensFromMessages,
  extractProviderUsage,
  isFiniteNonNegative,
  raiseMissionBudget,
  recordBudget,
  reserveBudget,
  sanitizeMissionBudgets,
} from "@/lib/prime/budget-guard";
import {
  approveMission,
  createWorkstream,
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
    title: "Budget guard harden",
    goal: "Prove finite budget hard-stops",
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

describe("BudgetGuard hardening", () => {
  beforeEach(() => {
    resetMissionStoreForTests();
  });

  it("rejects recordBudget without an active reservation", () => {
    const m = bootMission();
    const recorded = recordBudget({
      missionId: m.id,
      runId: "mrun_does_not_exist",
      usage: {
        promptTokens: 10,
        completionTokens: 10,
        totalTokens: 20,
        estimated: false,
        reservedTokens: 0,
      },
    });
    expect(recorded.ok).toBe(false);
    expect(recorded.code).toBe("run_not_found");
    expect(recorded.limit).toBe("reservation_required");
  });

  it("rejects negative, NaN, and Infinity estimatedTokens on reserve", () => {
    const m = bootMission();
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = reserveBudget({
        missionId: m.id,
        role: "builder",
        estimatedTokens: bad,
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe("invalid_budget");
      expect(r.limit).toBe("invalid_budget");
    }
    expect(isFiniteNonNegative(Number.NaN)).toBe(false);
    expect(isFiniteNonNegative(Number.POSITIVE_INFINITY)).toBe(false);
    expect(sanitizeMissionBudgets({
      ...m.budgets,
      maxTotalTokens: Number.POSITIVE_INFINITY,
    })).toBeNull();
  });

  it("rejects non-finite budgets patched onto a mission (fail closed)", () => {
    const m = bootMission();
    updateMission(m.id, {
      budgets: { ...m.budgets, maxTotalTokens: Number.NaN as unknown as number },
    });
    const r = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 100,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("invalid_budget");
  });

  it("maxTotalTokens stops a new reservation (limit=budget_exhausted)", () => {
    const m = bootMission({ maxTotalTokens: 100, maxTokensPerRun: 80 });
    const r1 = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 70,
    });
    expect(r1.ok).toBe(true);
    recordBudget({
      missionId: m.id,
      runId: r1.run!.id,
      usage: {
        promptTokens: 40,
        completionTokens: 40,
        totalTokens: 80,
        estimated: false,
        reservedTokens: 70,
      },
    });
    const r2 = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 70,
    });
    expect(r2.ok).toBe(false);
    expect(r2.code).toBe("budget_exhausted");
    expect(r2.limit).toBe("budget_exhausted");
    expect(r2.exhausted).toContain("maxTotalTokens");
    expect(getMission(m.id)?.status).toBe("budget_exhausted");
  });

  it("maxTokensPerRun stops oversized reservation (limit=token_limit_reached)", () => {
    const m = bootMission({ maxTokensPerRun: 50, maxTotalTokens: 10_000 });
    const r = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 200,
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("budget_exhausted");
    expect(r.limit).toBe("token_limit_reached");
    expect(r.exhausted).toContain("maxTokensPerRun");
  });

  it("tool-call limit allows exact max and stops after the boundary", () => {
    const m = bootMission({ maxToolCallsPerRun: 3 });
    expect(
      assertToolCallBudget({ missionId: m.id, toolCallsThisRun: 3 }).ok,
    ).toBe(true);
    const over = assertToolCallBudget({ missionId: m.id, toolCallsThisRun: 4 });
    expect(over.ok).toBe(false);
    expect(over.code).toBe("tool_call_limit_reached");
    expect(over.limit).toBe("tool_call_limit_reached");
    expect(getMission(m.id)?.status).toBe("budget_exhausted");
  });

  it("runtime limit stops at exact maxRuntimeMinutes boundary", () => {
    const m = bootMission({ maxRuntimeMinutes: 10 });
    const ok = assertRuntimeBudget({
      missionId: m.id,
      runtimeMinutesDelta: 9,
    });
    expect(ok.ok).toBe(true);
    const stop = assertRuntimeBudget({
      missionId: m.id,
      runtimeMinutesDelta: 1,
    });
    expect(stop.ok).toBe(false);
    expect(stop.code).toBe("runtime_limit_reached");
    expect(stop.limit).toBe("runtime_limit_reached");
    expect(getMission(m.id)?.status).toBe("budget_exhausted");
    // Further reserve must not continue after runtime exhaustion
    const reserved = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 100,
    });
    expect(reserved.ok).toBe(false);
    expect(reserved.code).toBe("budget_exhausted");
  });

  it("unknown / zero / Infinity provider usage never becomes 0", () => {
    expect(extractProviderUsage({})).toBeNull();
    expect(extractProviderUsage({ usage: { total_tokens: 0 } })).toBeNull();
    expect(
      extractProviderUsage({ usage: { total_tokens: Number.POSITIVE_INFINITY } }),
    ).toBeNull();
    expect(
      extractProviderUsage({ usage: { total_tokens: Number.NaN } }),
    ).toBeNull();

    const est = estimateTokensFromMessages({
      messages: [{ content: "x" }],
      completion: "",
    });
    expect(est).toBeGreaterThanOrEqual(64);

    const m = bootMission();
    const reserved = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: est,
    });
    expect(reserved.ok).toBe(true);
    const recorded = recordBudget({
      missionId: m.id,
      runId: reserved.run!.id,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimated: true,
        reservedTokens: reserved.reservation ?? 64,
      },
    });
    expect(recorded.ok).toBe(true);
    expect(getMission(m.id)!.usage.totalTokens).toBeGreaterThan(0);
  });

  it("budget-stop cannot auto-restart the same run via recordBudget", () => {
    const m = bootMission({ maxTotalTokens: 200, maxTokensPerRun: 150 });
    const reserved = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 100,
    });
    expect(reserved.ok).toBe(true);
    const first = recordBudget({
      missionId: m.id,
      runId: reserved.run!.id,
      usage: {
        promptTokens: 50,
        completionTokens: 50,
        totalTokens: 100,
        estimated: false,
        reservedTokens: 100,
      },
    });
    expect(first.ok).toBe(true);
    expect(getMissionRun(reserved.run!.id)?.status).toBe("completed");

    const again = recordBudget({
      missionId: m.id,
      runId: reserved.run!.id,
      usage: {
        promptTokens: 50,
        completionTokens: 50,
        totalTokens: 100,
        estimated: false,
        reservedTokens: 100,
      },
    });
    expect(again.ok).toBe(false);
    expect(again.code).toBe("run_already_finished");
    expect(again.limit).toBe("run_already_finished");
  });

  it("mission cannot spend more than maxTotalTokens across runs", () => {
    const m = bootMission({ maxTotalTokens: 150, maxTokensPerRun: 100 });
    const r1 = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 90,
    });
    expect(r1.ok).toBe(true);
    recordBudget({
      missionId: m.id,
      runId: r1.run!.id,
      usage: {
        promptTokens: 50,
        completionTokens: 40,
        totalTokens: 90,
        estimated: false,
        reservedTokens: 90,
      },
    });
    expect(getMission(m.id)!.usage.totalTokens).toBe(90);

    const r2 = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 90,
    });
    expect(r2.ok).toBe(false);
    expect(r2.exhausted).toContain("maxTotalTokens");
    expect(getMission(m.id)!.usage.totalTokens).toBe(90);
  });

  it("parallel workstream concurrency limit is enforceable", () => {
    const m = bootMission({ maxParallelWorkstreams: 1 });
    const ws = createWorkstream({
      missionId: m.id,
      title: "Only one",
      role: "builder",
    });
    expect("error" in ws).toBe(false);
    const blocked = assertParallelWorkstreamBudget({
      missionId: m.id,
      additional: 1,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.code).toBe("concurrency_limit_reached");
    expect(blocked.limit).toBe("concurrency_limit_reached");
  });

  it("owner raise still works; Infinity patch rejected", () => {
    const m = bootMission({ maxTotalTokens: 1000 });
    const ok = raiseMissionBudget({
      missionId: m.id,
      actor: "acc_pilar",
      actorRole: "owner",
      patch: { maxTotalTokens: 2000 },
    });
    expect(ok.ok).toBe(true);
    expect(getMission(m.id)!.budgets.maxTotalTokens).toBe(2000);

    const bad = raiseMissionBudget({
      missionId: m.id,
      actor: "acc_pilar",
      actorRole: "owner",
      patch: { maxTotalTokens: Number.POSITIVE_INFINITY },
    });
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe("invalid_budget");
  });
});
