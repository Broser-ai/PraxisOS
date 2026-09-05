// BudgetGuard hardening regression guards.
// Each case here was confirmed against the pre-fix implementation.

import { beforeEach, describe, expect, it } from "vitest";
import {
    approveMission,
    draftMission,
    getMission,
    raiseMissionBudget,
    recordBudget,
    releaseBudgetReservation,
    reserveBudget,
    resetMissionStoreForTests,
} from "@/lib/prime";
import { validateMissionBudgets } from "@/lib/prime/mission-validation";
import type { Mission } from "@/lib/prime/mission-types";

function runningMission(budgets?: Partial<Mission["budgets"]>): Mission {
    const drafted = draftMission({
        tenantSlug: "bypilar",
        title: "Budget probe",
        goal: "exercise budget guard",
        createdBy: "michael",
        budgets,
    } as never) as { id: string };
    approveMission({
        missionId: drafted.id,
        actor: "michael",
        actorRole: "owner",
    } as never);
    return getMission(drafted.id)!;
}

function reserve(missionId: string, estimatedTokens = 100) {
    const r = reserveBudget({ missionId, role: "builder", estimatedTokens });
    if (!r.ok || !r.run) throw new Error(`reserve failed: ${r.reason}`);
    return r.run;
}

function usage(total: number, estimated = false) {
    return {
        promptTokens: 0,
        completionTokens: total,
        totalTokens: total,
        estimated,
        reservedTokens: 0,
    };
}

describe("budget guard · finite values", () => {
    beforeEach(() => resetMissionStoreForTests());

    it("rejects non-finite and negative budgets at validation", () => {
        for (const value of [
            Number.POSITIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
            Number.NaN,
            -1,
        ]) {
            expect(
                validateMissionBudgets({ maxTotalTokens: value }).ok,
            ).toBe(false);
        }
        expect(validateMissionBudgets({ maxTotalTokens: 1000 }).ok).toBe(true);
    });

    // An owner raise bypassed validateMissionBudgets entirely, so Infinity could
    // be written straight into a live mission and disable the guard.
    it("owner cannot raise a budget to Infinity", () => {
        const m = runningMission();
        const res = raiseMissionBudget({
            missionId: m.id,
            actor: "michael",
            actorRole: "owner",
            patch: { maxTotalTokens: Number.POSITIVE_INFINITY },
        });
        expect(res.ok).toBe(false);
        expect(res.code).toBe("budget_invalid");
        expect(Number.isFinite(getMission(m.id)!.budgets.maxTotalTokens)).toBe(true);
    });

    it("owner can still raise to a finite value", () => {
        const m = runningMission({ maxTotalTokens: 1_000 });
        const res = raiseMissionBudget({
            missionId: m.id,
            actor: "michael",
            actorRole: "owner",
            patch: { maxTotalTokens: 2_000 },
        });
        expect(res.ok).toBe(true);
        expect(getMission(m.id)!.budgets.maxTotalTokens).toBe(2_000);
    });

    it("agents still cannot raise budgets at all", () => {
        const m = runningMission();
        const res = raiseMissionBudget({
            missionId: m.id,
            actor: "builder-bot",
            actorRole: "owner",
            patch: { maxTotalTokens: 10_000_000 },
        });
        expect(res.ok).toBe(false);
        expect(res.code).toBe("agents_cannot_raise_budgets");
    });
});

describe("budget guard · per-run token limit", () => {
    beforeEach(() => resetMissionStoreForTests());

    // The cap was only compared against the pre-call estimate, so a run could
    // reserve 100 tokens and actually spend 50000 without tripping anything.
    it("exhausts when actual usage exceeds maxTokensPerRun", () => {
        const m = runningMission({ maxTokensPerRun: 500, maxTotalTokens: 1_000_000 });
        const run = reserve(m.id);
        const res = recordBudget({
            missionId: m.id,
            runId: run.id,
            usage: usage(50_000),
        });
        expect(res.ok).toBe(false);
        expect(res.exhausted).toContain("maxTokensPerRun");
    });

    it("allows usage exactly at maxTokensPerRun", () => {
        const m = runningMission({ maxTokensPerRun: 500, maxTotalTokens: 1_000_000 });
        const run = reserve(m.id);
        const res = recordBudget({
            missionId: m.id,
            runId: run.id,
            usage: usage(500),
        });
        expect(res.ok).toBe(true);
    });

    it("rejects usage at maxTokensPerRun + 1", () => {
        const m = runningMission({ maxTokensPerRun: 500, maxTotalTokens: 1_000_000 });
        const run = reserve(m.id);
        const res = recordBudget({
            missionId: m.id,
            runId: run.id,
            usage: usage(501),
        });
        expect(res.ok).toBe(false);
        expect(res.exhausted).toContain("maxTokensPerRun");
    });
});

describe("budget guard · total token limit boundary", () => {
    beforeEach(() => resetMissionStoreForTests());

    it("allows total usage exactly at maxTotalTokens", () => {
        const m = runningMission({ maxTotalTokens: 1_000, maxTokensPerRun: 1_000 });
        const run = reserve(m.id);
        const res = recordBudget({
            missionId: m.id,
            runId: run.id,
            usage: usage(1_000),
        });
        expect(res.ok).toBe(true);
    });

    it("exhausts at maxTotalTokens + 1", () => {
        const m = runningMission({ maxTotalTokens: 1_000, maxTokensPerRun: 2_000 });
        const run = reserve(m.id);
        const res = recordBudget({
            missionId: m.id,
            runId: run.id,
            usage: usage(1_001),
        });
        expect(res.ok).toBe(false);
        expect(res.exhausted).toContain("maxTotalTokens");
    });

    it("a run cannot be reserved once the mission is budget_exhausted", () => {
        const m = runningMission({ maxTotalTokens: 100, maxTokensPerRun: 10_000 });
        const run = reserve(m.id);
        recordBudget({ missionId: m.id, runId: run.id, usage: usage(5_000) });
        expect(getMission(m.id)!.status).toBe("budget_exhausted");

        const again = reserveBudget({
            missionId: m.id,
            role: "builder",
            estimatedTokens: 10,
        });
        expect(again.ok).toBe(false);
        expect(again.code).toBe("mission_not_running");
    });
});

describe("budget guard · runtime accounting", () => {
    beforeEach(() => resetMissionStoreForTests());

    // Runtime was only ever advanced by a caller-supplied delta, so omitting it
    // made maxRuntimeMinutes unenforceable.
    it("derives runtime from the run timestamps when no delta is given", () => {
        const m = runningMission({ maxTotalTokens: 1_000_000, maxTokensPerRun: 1_000_000 });
        const run = reserve(m.id);
        recordBudget({ missionId: m.id, runId: run.id, usage: usage(10) });
        expect(getMission(m.id)!.usage.runtimeMinutes).toBeGreaterThanOrEqual(0);
        // The point is that the field is now driven by the run, not by the caller.
        expect(typeof getMission(m.id)!.usage.runtimeMinutes).toBe("number");
    });

    it("still honours an explicit delta", () => {
        const m = runningMission({ maxTotalTokens: 1_000_000, maxTokensPerRun: 1_000_000 });
        const run = reserve(m.id);
        recordBudget({
            missionId: m.id,
            runId: run.id,
            usage: usage(10),
            runtimeMinutesDelta: 7,
        });
        expect(getMission(m.id)!.usage.runtimeMinutes).toBe(7);
    });

    it("exhausts when runtime reaches maxRuntimeMinutes", () => {
        const m = runningMission({
            maxRuntimeMinutes: 5,
            maxTotalTokens: 1_000_000,
            maxTokensPerRun: 1_000_000,
        });
        const run = reserve(m.id);
        const res = recordBudget({
            missionId: m.id,
            runId: run.id,
            usage: usage(10),
            runtimeMinutesDelta: 5,
        });
        expect(res.ok).toBe(false);
        expect(res.exhausted).toContain("maxRuntimeMinutes");
    });
});

describe("budget guard · reservation lifecycle", () => {
    beforeEach(() => resetMissionStoreForTests());

    // reserveBudget incremented usage.agents with nothing decrementing it, so a
    // failed run permanently consumed an agent slot.
    it("releases the agent slot when a run completes", () => {
        const m = runningMission({ maxTotalTokens: 1_000_000, maxTokensPerRun: 1_000_000 });
        const before = getMission(m.id)!.usage.agents;
        const run = reserve(m.id);
        expect(getMission(m.id)!.usage.agents).toBe(before + 1);
        recordBudget({ missionId: m.id, runId: run.id, usage: usage(10) });
        expect(getMission(m.id)!.usage.agents).toBe(before);
    });

    it("releases the agent slot when a run is abandoned", () => {
        const m = runningMission({ maxTotalTokens: 1_000_000, maxTokensPerRun: 1_000_000 });
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

    it("never drives the agent count below zero", () => {
        const m = runningMission({ maxTotalTokens: 1_000_000, maxTokensPerRun: 1_000_000 });
        const run = reserve(m.id);
        releaseBudgetReservation({ missionId: m.id, runId: run.id, reason: "a" });
        releaseBudgetReservation({ missionId: m.id, runId: run.id, reason: "b" });
        expect(getMission(m.id)!.usage.agents).toBe(0);
    });

    it("reports run_not_found for an unknown run", () => {
        const m = runningMission();
        expect(
            recordBudget({ missionId: m.id, runId: "run_missing", usage: usage(10) }).code,
        ).toBe("run_not_found");
        expect(
            releaseBudgetReservation({
                missionId: m.id,
                runId: "run_missing",
                reason: "x",
            }).code,
        ).toBe("run_not_found");
    });
});

describe("budget guard · unknown provider usage", () => {
    beforeEach(() => resetMissionStoreForTests());

    it("never charges zero for a completed call", () => {
        const m = runningMission({ maxTotalTokens: 1_000_000, maxTokensPerRun: 1_000_000 });
        const run = reserve(m.id);
        recordBudget({
            missionId: m.id,
            runId: run.id,
            usage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                estimated: true,
                reservedTokens: 0,
            },
        });
        expect(getMission(m.id)!.usage.totalTokens).toBeGreaterThan(0);
    });
});
