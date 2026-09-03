import { describe, it, expect, beforeEach } from "vitest";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import {
  EXECUTION_CONTROL_INVARIANTS,
  approveMission,
  assertToolCallBudget,
  claimWorkstreamFiles,
  createPrimeMockRepo,
  draftMission,
  estimateTokensFromMessages,
  evaluateMissionPolicy,
  extractProviderUsage,
  getMission,
  getWorkstream,
  listClaimableWorkstreams,
  listWorkstreams,
  markApprovedForMerge,
  markReadyForReview,
  markWorkstreamDone,
  appendEvidence,
  ownerRaiseBudget,
  raiseMissionBudget,
  recordBudget,
  releaseLease,
  reserveBudget,
  resetMissionStoreForTests,
  roleMay,
  runPool,
  seedMissionFixture,
  spawnDefaultFlow,
  spawnWorkstream,
  startMission,
  tickMissions,
  tryLeaseWorkstream,
  updateMission,
  updateWorkstream,
  validateDefinitionOfDone,
  __setDispatcherInFlightForTests,
} from "@/lib/prime";
import { SWARM_INVARIANTS } from "@/lib/swarm/types";
import { CLINICAL_POLICY } from "@/lib/swarm/clinical-policy";
import { PRIME_INVARIANTS } from "@/lib/prime/types";

function bootMission(budgets?: Record<string, number>) {
  const draft = draftMission({
    tenantSlug: "bypilar",
    title: "Exec control test",
    goal: "Prove BudgetGuard + DoD",
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

describe("Prime Execution Control", () => {
  beforeEach(() => {
    resetMissionStoreForTests();
    _clearMemorySink();
  });

  it("1. hard-stops on maxTotalTokens → budget_exhausted", () => {
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
    expect(getMission(m.id)?.status).toBe("budget_exhausted");
  });

  it("2. hard-stops on maxTokensPerRun", () => {
    const m = bootMission({ maxTokensPerRun: 50, maxTotalTokens: 10_000 });
    const r = reserveBudget({
      missionId: m.id,
      role: "builder",
      estimatedTokens: 200,
    });
    expect(r.ok).toBe(false);
    expect(r.exhausted).toContain("maxTokensPerRun");
  });

  it("3. hard-stops on maxToolCallsPerRun", () => {
    const m = bootMission({ maxToolCallsPerRun: 3 });
    const r = assertToolCallBudget({ missionId: m.id, toolCallsThisRun: 4 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("budget_exhausted");
  });

  it("4. missing provider usage → estimated, never assume 0", () => {
    expect(extractProviderUsage({})).toBeNull();
    expect(extractProviderUsage({ usage: { total_tokens: 0 } })).toBeNull();
    const est = estimateTokensFromMessages({
      messages: [{ content: "hello world ".repeat(20) }],
      completion: "ok",
    });
    expect(est).toBeGreaterThan(0);
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
        totalTokens: 0, // provider omitted → still charge
        estimated: true,
        reservedTokens: reserved.reservation ?? 64,
      },
    });
    expect(recorded.ok).toBe(true);
    expect(getMission(m.id)!.usage.totalTokens).toBeGreaterThan(0);
    expect(getMission(m.id)!.usage.estimatedTokens).toBeGreaterThan(0);
  });

  it("5. agents cannot raise budgets", () => {
    const m = bootMission();
    const denied = raiseMissionBudget({
      missionId: m.id,
      actor: "agent-builder",
      actorRole: "agent",
      patch: { maxTotalTokens: 999_999 },
    });
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("agents_cannot_raise_budgets");
  });

  it("6. owner-only budget bump + audit", () => {
    const m = bootMission({ maxTotalTokens: 1000 });
    const bumped = ownerRaiseBudget({
      missionId: m.id,
      actor: "acc_pilar",
      actorRole: "owner",
      patch: { maxTotalTokens: 5000 },
    });
    expect("error" in bumped).toBe(false);
    expect(getMission(m.id)!.budgets.maxTotalTokens).toBe(5000);
    const audit = _readMemorySink().filter((e) => e.event === "prime.budget_raised");
    expect(audit.length).toBeGreaterThanOrEqual(1);
    expect(getMission(m.id)!.humanDecisions[0]?.kind).toBe("raise_budget");
  });

  it("7. policy blocks merge/deploy without human approval", () => {
    const m = bootMission();
    const merge = evaluateMissionPolicy({
      missionId: m.id,
      action: "merge",
      humanApproved: false,
    });
    expect(merge.ok).toBe(false);
    if (!merge.ok) {
      expect(merge.requiresHuman).toBe(true);
    }

    const deploy = evaluateMissionPolicy({
      missionId: m.id,
      action: "deploy",
    });
    expect(deploy.ok).toBe(false);
    if (!deploy.ok) {
      expect(deploy.code).toBe("human_required_deploy");
    }
  });

  it("8. policy blocks clinical/MDR/pathology/patient self-approve", () => {
    const m = bootMission();
    for (const action of [
      "clinical_policy",
      "mdr_claim",
      "pathology_claim",
      "patient_claim",
      "journal_sign",
    ] as const) {
      const v = evaluateMissionPolicy({ missionId: m.id, action });
      expect(v.ok).toBe(false);
    }
  });

  it("9. DoD rejects empty shell / missing acceptance evidence", () => {
    const m = bootMission();
    const ws = spawnWorkstream({
      missionId: m.id,
      title: "Empty builder",
      role: "builder",
      acceptanceCriteria: [],
    });
    if ("error" in ws) throw new Error(ws.error);
    const dod = validateDefinitionOfDone(ws.id);
    expect(dod.ok).toBe(false);
    if (!dod.ok) {
      expect(dod.reasons.some((r) => r.includes("empty") || r.includes("acceptance"))).toBe(
        true,
      );
    }
    const ready = markReadyForReview(ws.id);
    expect("error" in ready).toBe(true);
  });

  it("10. path conflict → blocked, not overwrite", () => {
    const m = bootMission();
    const a = spawnWorkstream({
      missionId: m.id,
      title: "A",
      role: "builder",
      proposedFiles: ["lib/prime/budget-guard.ts"],
      acceptanceCriteria: [{ text: "A ok" }],
    });
    if ("error" in a) throw new Error(a.error);
    expect(a.status).not.toBe("blocked");

    const b = spawnWorkstream({
      missionId: m.id,
      title: "B",
      role: "builder",
      proposedFiles: ["lib/prime/budget-guard.ts"],
      acceptanceCriteria: [{ text: "B ok" }],
    });
    if ("error" in b) throw new Error(b.error);
    expect(b.status).toBe("blocked");
    expect(b.blockedReason).toMatch(/path conflict/i);

    // claim path also blocks
    const c = spawnWorkstream({
      missionId: m.id,
      title: "C",
      role: "builder",
      acceptanceCriteria: [{ text: "C" }],
    });
    if ("error" in c) throw new Error(c.error);
    const claimed = claimWorkstreamFiles({
      workstreamId: c.id,
      files: ["lib/prime/budget-guard.ts"],
    });
    if ("error" in claimed) throw new Error(claimed.error);
    expect(claimed.status).toBe("blocked");
  });

  it("11. cannot mark done without evidence + DoD pass", () => {
    const m = bootMission();
    const ws = spawnWorkstream({
      missionId: m.id,
      title: "Needs evidence",
      role: "builder",
      acceptanceCriteria: [{ text: "BudgetGuard tests green" }],
      proposedFiles: ["lib/prime/budget-guard.ts"],
    });
    if ("error" in ws) throw new Error(ws.error);

    const without = markWorkstreamDone(ws.id);
    expect(without.ok).toBe(false);

    appendEvidence({
      workstreamId: ws.id,
      files: ["lib/prime/budget-guard.ts", "tests/prime/execution-control.test.ts"],
      commits: ["abc123"],
      commands: [
        {
          command: "npm test -- tests/prime/execution-control.test.ts",
          exitCode: 0,
          at: new Date().toISOString(),
        },
        {
          command: "npm run typecheck",
          exitCode: 0,
          at: new Date().toISOString(),
        },
      ],
      checks: [
        { kind: "tests", status: "pass" },
        { kind: "typecheck", status: "pass" },
        { kind: "lint", status: "pass" },
        { kind: "build", status: "not_required" },
        { kind: "security", status: "pass" },
        { kind: "tenant", status: "pass" },
        { kind: "clinical", status: "not_applicable" },
      ],
      acceptance: [{ criterionId: "ac_1", status: "pass" }],
      limitations: ["mock DB only"],
      rollback: "revert mission-store commits",
      humanDecisions: ["ui verified or disabled: n/a for lib-only"],
    });

    const done = markWorkstreamDone(ws.id);
    expect(done.ok).toBe(true);
  });

  it("12. invariants remain locked (NO_AUTO_*, clinical, training)", () => {
    expect(SWARM_INVARIANTS.NO_AUTO_MERGE).toBe(true);
    expect(SWARM_INVARIANTS.NO_AUTO_DEPLOY).toBe(true);
    expect(CLINICAL_POLICY.clinical_status).toBe("suggestion_only");
    expect(CLINICAL_POLICY.NO_AUTO_JOURNAL_SIGN).toBe(true);
    expect(PRIME_INVARIANTS.NO_MODEL_TRAINING).toBe(true);
    expect(PRIME_INVARIANTS.PATHOLOGY_SHADOW_UNTIL_GATES).toBe(true);
    expect(EXECUTION_CONTROL_INVARIANTS.MANUAL_MERGE_ONLY).toBe(true);
    expect(EXECUTION_CONTROL_INVARIANTS.AGENTS_CANNOT_RAISE_BUDGETS).toBe(true);
    expect(EXECUTION_CONTROL_INVARIANTS.MAX_PARALLEL_WORKSTREAMS).toBe(4);
  });

  it("13. orchestration: scout→builder→verifier+reviewer; approved_for_merge is manual-only", () => {
    const m = bootMission();
    const flow = spawnDefaultFlow({
      missionId: m.id,
      title: "Flow",
      acceptanceCriteria: [{ text: "Flow acceptance" }],
    });
    if ("error" in flow) throw new Error(flow.error);
    expect(flow.map((w) => w.role)).toEqual([
      "scout",
      "builder",
      "verifier",
      "reviewer",
    ]);

    // Force a builder to ready_for_review with full evidence
    const builder = flow.find((w) => w.role === "builder")!;
    appendEvidence({
      workstreamId: builder.id,
      files: ["lib/prime/orchestrator.ts"],
      commits: ["def456"],
      commands: [
        { command: "npm test", exitCode: 0, at: new Date().toISOString() },
        { command: "npm run typecheck", exitCode: 0, at: new Date().toISOString() },
      ],
      checks: [
        { kind: "tests", status: "pass" },
        { kind: "typecheck", status: "pass" },
        { kind: "lint", status: "pass" },
        { kind: "build", status: "not_required" },
        { kind: "security", status: "pass" },
        { kind: "tenant", status: "pass" },
        { kind: "clinical", status: "not_applicable" },
      ],
      acceptance: [{ criterionId: "ac_1", status: "pass" }],
      limitations: [],
      rollback: "git revert",
      humanDecisions: ["ui verified or disabled: n/a"],
    });
    const ready = markReadyForReview(builder.id);
    expect("error" in ready).toBe(false);

    const mergeMark = markApprovedForMerge({
      workstreamId: builder.id,
      actor: "acc_pilar",
      actorRole: "owner",
    });
    expect("error" in mergeMark).toBe(false);
    if (!("error" in mergeMark)) {
      expect(mergeMark.status).toBe("approved_for_merge");
    }
    // Still cannot auto-merge
    const merge = evaluateMissionPolicy({
      missionId: m.id,
      workstreamId: builder.id,
      action: "merge",
      humanApproved: false,
    });
    expect(merge.ok).toBe(false);
  });

  it("14. max parallel workstreams respects MAX_WORKTREES (4)", () => {
    const m = bootMission();
    for (let i = 0; i < 4; i++) {
      const ws = spawnWorkstream({
        missionId: m.id,
        title: `WS ${i}`,
        role: "builder",
        acceptanceCriteria: [{ text: `c${i}` }],
      });
      expect("error" in ws).toBe(false);
    }
    const overflow = spawnWorkstream({
      missionId: m.id,
      title: "overflow",
      role: "builder",
      acceptanceCriteria: [{ text: "nope" }],
    });
    expect("error" in overflow).toBe(true);
    if ("error" in overflow) {
      expect(overflow.error).toMatch(/max_parallel/);
    }
  });

  it("15. migrations require yellow/red + human approval", () => {
    const m = bootMission(); // green
    const blocked = evaluateMissionPolicy({
      missionId: m.id,
      action: "migration",
      humanApproved: true,
    });
    expect(blocked.ok).toBe(false);

    updateMission(m.id, { riskLevel: "yellow" });
    const ok = evaluateMissionPolicy({
      missionId: m.id,
      action: "migration",
      humanApproved: true,
    });
    expect(ok.ok).toBe(true);
  });

  it("16. dispatcher lease: second claim blocked while lease held", () => {
    const m = bootMission();
    const ws = spawnWorkstream({
      missionId: m.id,
      title: "Lease me",
      role: "scout",
      acceptanceCriteria: [{ text: "scout plan" }],
    });
    if ("error" in ws) throw new Error(ws.error);
    const a = tryLeaseWorkstream({ workstreamId: ws.id, owner: "tick_a" });
    expect(a?.leaseId).toBeTruthy();
    expect(a?.status).toBe("running");
    const b = tryLeaseWorkstream({ workstreamId: ws.id, owner: "tick_b" });
    expect(b).toBeNull();
    releaseLease(ws.id);
    const c = tryLeaseWorkstream({ workstreamId: ws.id, owner: "tick_b" });
    // status was running then released still running — only queued/failed claimable
    // re-queue for re-lease test
    updateWorkstream(ws.id, { status: "queued" });
    const d = tryLeaseWorkstream({ workstreamId: ws.id, owner: "tick_b" });
    expect(d?.leaseOwner).toBe("tick_b");
  });

  it("17. dispatcher tick mutex + controlled pool concurrency", async () => {
    __setDispatcherInFlightForTests(true);
    const blocked = await tickMissions({ tenantSlug: "bypilar" });
    expect(blocked.ok).toBe(false);
    expect(blocked.skipped).toBe("dispatcher_tick_in_flight");
    __setDispatcherInFlightForTests(false);

    const order: number[] = [];
    const results = await runPool([1, 2, 3, 4, 5], 2, async (n) => {
      order.push(n);
      await new Promise((r) => setTimeout(r, 5));
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(order).toHaveLength(5);
  });

  it("18. tickMissions executes scout AgentRun; failure isolated", async () => {
    const m = bootMission();
    const ws = spawnWorkstream({
      missionId: m.id,
      title: "Scout run",
      role: "scout",
      acceptanceCriteria: [{ text: "plan ok" }],
    });
    if ("error" in ws) throw new Error(ws.error);

    const tick = await tickMissions({
      tenantSlug: "bypilar",
      maxParallel: 2,
      owner: "test_tick",
    });
    expect(tick.ok).toBe(true);
    expect(tick.claimed).toBeGreaterThanOrEqual(1);
    const after = getWorkstream(ws.id)!;
    expect(["done", "failed", "awaiting_verification", "ready_for_review"]).toContain(
      after.status,
    );
    expect(after.attemptCount).toBeGreaterThanOrEqual(1);
  });

  it("19. overlapping builder scopes → blocked (not overwrite)", () => {
    const m = bootMission();
    const a = spawnWorkstream({
      missionId: m.id,
      title: "Builder A",
      role: "builder",
      proposedFiles: ["lib/journal.ts"],
      acceptanceCriteria: [{ text: "A" }],
    });
    if ("error" in a) throw new Error(a.error);
    const b = spawnWorkstream({
      missionId: m.id,
      title: "Builder B",
      role: "builder",
      proposedFiles: ["lib/journal.ts"],
      acceptanceCriteria: [{ text: "B" }],
    });
    if ("error" in b) throw new Error(b.error);
    expect(b.status).toBe("blocked");

    // lease path also refuses overwrite
    updateWorkstream(b.id, { status: "queued", blockedReason: undefined });
    const leased = tryLeaseWorkstream({ workstreamId: b.id, owner: "t" });
    expect(leased?.status).toBe("blocked");
  });

  it("20. seed yellow journal-auth mission as draft only (no auto-approve)", () => {
    const seeded = seedMissionFixture({
      fixtureId: "secure-journal-route-authorization",
      tenantSlug: "bypilar",
      createdBy: "acc_pilar",
    });
    expect("error" in seeded).toBe(false);
    if ("error" in seeded) throw new Error(seeded.error);
    expect(seeded.status).toBe("draft");
    expect(seeded.riskLevel).toBe("yellow");
    expect(seeded.platformScope).toContain("auth_journal");
    expect(seeded.fixtureId).toBe("secure-journal-route-authorization");

    // Dispatcher must not claim draft missions
    const claimable = listClaimableWorkstreams({ tenantSlug: "bypilar" });
    expect(claimable.every((w) => w.missionId !== seeded.id)).toBe(true);

    const again = seedMissionFixture({
      fixtureId: "secure-journal-route-authorization",
      tenantSlug: "bypilar",
    });
    expect("error" in again).toBe(true);
    if ("error" in again) expect(again.error).toBe("already_seeded");
  });

  it("21. start seeded mission spawns scout→builder→verifier→reviewer queued", () => {
    const seeded = seedMissionFixture({
      fixtureId: "secure-journal-route-authorization",
      createdBy: "acc_pilar",
    });
    if ("error" in seeded) throw new Error(seeded.error);
    const approved = approveMission({
      missionId: seeded.id,
      actor: "acc_pilar",
      actorRole: "owner",
    });
    if ("error" in approved) throw new Error(approved.error);
    const started = startMission({ missionId: seeded.id, actor: "acc_pilar" });
    if ("error" in started) throw new Error(started.error);
    const streams = listWorkstreams({ missionId: seeded.id });
    expect(streams.map((w) => w.role)).toEqual([
      "reviewer",
      "verifier",
      "builder",
      "scout",
    ]);
    expect(streams.every((w) => w.status === "queued")).toBe(true);
  });

  it("22. mission budgets include reservedTokens + maxParallelWorkstreams", () => {
    const m = bootMission();
    expect(m.budgets.reservedTokens).toBeDefined();
    expect(m.budgets.maxParallelWorkstreams).toBe(4);
    expect(createPrimeMockRepo().missions).toEqual([]);
  });

  it("23. role capability: scout cannot mark_approved_for_merge", () => {
    expect(roleMay("scout", "mark_approved_for_merge")).toBe(false);
    expect(roleMay("builder", "merge")).toBe(false);
    expect(roleMay("builder", "write_path")).toBe(true);
    expect(roleMay("release_steward", "mark_approved_for_merge")).toBe(true);
  });
});
