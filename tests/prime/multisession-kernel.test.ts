/**
 * Controlled multi-session dispatch kernel tests.
 * Memory/JSON only — NOT Postgres-durable.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  EXECUTION_CONTROL_INVARIANTS,
  __resetDispatcherCheckpointsForTests,
  applyMissionFanIn,
  approveMission,
  claimWorkstreamLease,
  draftMission,
  evaluateMissionFanIn,
  executeLeasedWorkstream,
  explainClaimSkip,
  getMission,
  getWorkstream,
  listClaimableWorkstreams,
  listDispatchCheckpoints,
  missionCompletedIsNotMergeDeploy,
  reclaimExpiredLeases,
  resetMissionStoreForTests,
  resumeDispatcherAfterRestart,
  spawnWorkstream,
  startMission,
  tickMissions,
  tryLeaseWorkstream,
  updateMission,
  updateWorkstream,
} from "@/lib/prime";
import { SWARM_INVARIANTS } from "@/lib/swarm/types";

function bootMission(budgets?: Record<string, number>) {
  const draft = draftMission({
    tenantSlug: "bypilar",
    title: "Multisession kernel",
    goal: "Prove lease/fan-out/fan-in/checkpoint",
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

describe("Prime multi-session dispatch kernel", () => {
  let prevDataDir: string | undefined;
  let tmpData: string | null = null;

  beforeEach(() => {
    prevDataDir = process.env.PRAXIS_DATA_DIR;
    tmpData = mkdtempSync(join(tmpdir(), "prime-ms-"));
    process.env.PRAXIS_DATA_DIR = tmpData;
    resetMissionStoreForTests();
    __resetDispatcherCheckpointsForTests();
  });

  afterEach(() => {
    if (prevDataDir === undefined) delete process.env.PRAXIS_DATA_DIR;
    else process.env.PRAXIS_DATA_DIR = prevDataDir;
    if (tmpData) {
      try {
        rmSync(tmpData, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it("double-claim: second worker blocked while lease held", () => {
    const m = bootMission();
    const ws = spawnWorkstream({
      missionId: m.id,
      title: "Lease me",
      role: "scout",
      acceptanceCriteria: [{ text: "plan" }],
    });
    if ("error" in ws) throw new Error(ws.error);

    const a = claimWorkstreamLease({ workstreamId: ws.id, owner: "worker_a" });
    expect(a.ok).toBe(true);
    if (!a.ok) throw new Error("claim failed");
    expect(a.workstream.leaseId).toBeTruthy();
    expect(a.workstream.claimedAt).toBeTruthy();
    expect(a.workstream.leaseExpiresAt).toBeTruthy();
    expect(a.workstream.leaseOwner).toBe("worker_a");

    const b = claimWorkstreamLease({ workstreamId: ws.id, owner: "worker_b" });
    expect(b.ok).toBe(false);
    if (b.ok) throw new Error("should not claim");
    expect(b.limit.code).toBe("lease_held");

    expect(tryLeaseWorkstream({ workstreamId: ws.id, owner: "worker_b" })).toBeNull();
  });

  it("lease expiry → controlled reclaim, then other owner may claim", () => {
    const m = bootMission();
    const ws = spawnWorkstream({
      missionId: m.id,
      title: "Expire me",
      role: "scout",
      acceptanceCriteria: [{ text: "plan" }],
    });
    if ("error" in ws) throw new Error(ws.error);

    const past = Date.now() - 60_000;
    const claimed = claimWorkstreamLease({
      workstreamId: ws.id,
      owner: "worker_a",
      ttlMs: 1,
      now: past,
    });
    expect(claimed.ok).toBe(true);

    const reclaimed = reclaimExpiredLeases({ now: Date.now() });
    expect(reclaimed.some((w) => w.id === ws.id)).toBe(true);
    const after = getWorkstream(ws.id)!;
    expect(after.status).toBe("queued");
    expect(after.leaseId).toBeUndefined();
    expect(after.claimedAt).toBeUndefined();

    const expiryCp = listDispatchCheckpoints({
      workstreamId: ws.id,
      kind: "lease_expiry",
    });
    expect(expiryCp.length).toBeGreaterThanOrEqual(1);
    expect(expiryCp[0]?.durability).toBe("memory_json");

    const b = claimWorkstreamLease({ workstreamId: ws.id, owner: "worker_b" });
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.workstream.leaseOwner).toBe("worker_b");
  });

  it("fan-out: deps unsatisfied → machine-readable skip (no spin)", () => {
    const m = bootMission({ maxParallelWorkstreams: 4 });
    const scout = spawnWorkstream({
      missionId: m.id,
      title: "Scout",
      role: "scout",
      acceptanceCriteria: [{ text: "s" }],
    });
    if ("error" in scout) throw new Error(scout.error);
    const builder = spawnWorkstream({
      missionId: m.id,
      title: "Builder",
      role: "builder",
      acceptanceCriteria: [{ text: "b" }],
    });
    if ("error" in builder) throw new Error(builder.error);

    updateWorkstream(builder.id, { dependsOnWorkstreamIds: [scout.id] });

    const skip = explainClaimSkip(builder.id);
    expect(skip?.code).toBe("dependency_unsatisfied");
    expect(skip?.waitingOn).toContain(scout.id);

    const claimable = listClaimableWorkstreams({ tenantSlug: "bypilar" });
    expect(claimable.some((w) => w.id === builder.id)).toBe(false);
    expect(claimable.some((w) => w.id === scout.id)).toBe(true);

    const denied = claimWorkstreamLease({
      workstreamId: builder.id,
      owner: "t",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.limit.code).toBe("dependency_unsatisfied");

    updateWorkstream(scout.id, { status: "done" });
    const ok = claimWorkstreamLease({ workstreamId: builder.id, owner: "t" });
    expect(ok.ok).toBe(true);
  });

  it("fan-out: maxParallelWorkstreams → machine-readable limit", () => {
    const m = bootMission({ maxParallelWorkstreams: 1 });
    const a = spawnWorkstream({
      missionId: m.id,
      title: "A",
      role: "scout",
      acceptanceCriteria: [{ text: "a" }],
    });
    if ("error" in a) throw new Error(a.error);
    // Spawn may refuse second while first still queued (parallelCount includes queued).
    // Force second via create path: temporarily mark first done for spawn, then revert.
    updateWorkstream(a.id, { status: "done" });
    const b = spawnWorkstream({
      missionId: m.id,
      title: "B",
      role: "scout",
      acceptanceCriteria: [{ text: "b" }],
    });
    if ("error" in b) throw new Error(b.error);
    updateWorkstream(a.id, { status: "queued" });
    updateWorkstream(b.id, { status: "queued" });

    const first = claimWorkstreamLease({ workstreamId: a.id, owner: "w1" });
    expect(first.ok).toBe(true);

    const second = claimWorkstreamLease({ workstreamId: b.id, owner: "w2" });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.limit.code).toBe("max_parallel_workstreams");
      expect(second.limit.limit).toBe(1);
    }
  });

  it("fan-out: builder file-scope overlap → blocked", () => {
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

    updateWorkstream(b.id, { status: "queued", blockedReason: undefined });
    const leased = tryLeaseWorkstream({ workstreamId: b.id, owner: "t" });
    expect(leased?.status).toBe("blocked");
    const blocks = listDispatchCheckpoints({
      workstreamId: b.id,
      kind: "block",
    });
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it("fan-in: ready_for_review only when workstreams + verifier/reviewer ok", () => {
    const m = bootMission();
    const roles = ["scout", "builder", "verifier", "reviewer"] as const;
    const ids: string[] = [];
    for (const role of roles) {
      const ws = spawnWorkstream({
        missionId: m.id,
        title: role,
        role,
        acceptanceCriteria: [{ text: `${role} ac` }],
      });
      if ("error" in ws) throw new Error(ws.error);
      ids.push(ws.id);
    }

    // Reset to incomplete
    for (const id of ids) updateWorkstream(id, { status: "queued" });
    expect(evaluateMissionFanIn(m.id).ok).toBe(false);
    expect(evaluateMissionFanIn(m.id).code).toBe("workstreams_incomplete");

    for (const id of ids) updateWorkstream(id, { status: "ready_for_review" });
    // Remove verifier
    updateWorkstream(ids[2]!, { status: "cancelled" });
    expect(evaluateMissionFanIn(m.id).code).toBe("verifier_required");

    updateWorkstream(ids[2]!, { status: "ready_for_review" });
    updateWorkstream(ids[3]!, { status: "cancelled" });
    expect(evaluateMissionFanIn(m.id).code).toBe("reviewer_required");

    updateWorkstream(ids[3]!, { status: "ready_for_review" });
    const ready = evaluateMissionFanIn(m.id);
    expect(ready.ok).toBe(true);
    if (ready.ok) {
      expect(ready.code).toBe("ready_for_review");
      expect(ready.completedMeansMerge).toBe(false);
      expect(ready.completedMeansDeploy).toBe(false);
      expect(ready.NO_AUTO_MERGE).toBe(true);
      expect(ready.NO_AUTO_DEPLOY).toBe(true);
    }

    const applied = applyMissionFanIn(m.id);
    expect(applied.ok).toBe(true);
    // Must not auto-complete as merge/deploy
    expect(getMission(m.id)?.status).not.toBe("completed");
    expect(missionCompletedIsNotMergeDeploy()).toBe(true);
  });

  it("fan-in: failed/blocked blocks mission (pause)", () => {
    const m = bootMission();
    const ws = spawnWorkstream({
      missionId: m.id,
      title: "Failer",
      role: "builder",
      acceptanceCriteria: [{ text: "x" }],
    });
    if ("error" in ws) throw new Error(ws.error);
    updateWorkstream(ws.id, { status: "failed", lastError: "boom" });

    const v = applyMissionFanIn(m.id);
    expect(v.ok).toBe(false);
    expect(v.code).toBe("mission_blocked_failed");
    expect(getMission(m.id)?.status).toBe("paused");

    updateMission(m.id, { status: "running" });
    updateWorkstream(ws.id, { status: "blocked", blockedReason: "path" });
    const v2 = applyMissionFanIn(m.id);
    expect(v2.code).toBe("mission_blocked_blocked");
    expect(getMission(m.id)?.status).toBe("paused");
  });

  it("checkpoint claim/start/completion + JSON lease resume after simulated restart", async () => {
    const m = bootMission();
    const ws = spawnWorkstream({
      missionId: m.id,
      title: "CP",
      role: "scout",
      acceptanceCriteria: [{ text: "c" }],
    });
    if ("error" in ws) throw new Error(ws.error);

    const claim = claimWorkstreamLease({ workstreamId: ws.id, owner: "w1" });
    expect(claim.ok).toBe(true);
    if (!claim.ok) throw new Error("claim");
    const leaseId = claim.workstream.leaseId;
    expect(leaseId).toBeTruthy();

    const claims = listDispatchCheckpoints({ kind: "claim", workstreamId: ws.id });
    expect(claims.length).toBeGreaterThanOrEqual(1);
    expect(claims[0]?.durability).toBe("memory_json");
    expect(claims[0]?.durability).not.toBe("postgres");

    const executed = await executeLeasedWorkstream(ws.id);
    expect(["done", "failed", "awaiting_verification", "ready_for_review"]).toContain(
      executed.status,
    );
    const starts = listDispatchCheckpoints({ kind: "start", workstreamId: ws.id });
    const completions = listDispatchCheckpoints({
      kind: "completion",
      workstreamId: ws.id,
    });
    expect(starts.length).toBeGreaterThanOrEqual(1);
    expect(completions.length).toBeGreaterThanOrEqual(1);
    expect(starts[0]?.durability).toBe("memory_json");
    expect(completions[0]?.durability).toBe("memory_json");

    const storePath = join(tmpData!, "mission-store.json");
    const cpPath = join(tmpData!, "dispatch-checkpoints.json");
    expect(existsSync(storePath)).toBe(true);
    expect(existsSync(cpPath)).toBe(true);
    const storeJson = JSON.parse(readFileSync(storePath, "utf8")) as {
      workstreams: Array<{ id: string; leaseId?: string }>;
    };
    const cpJson = JSON.parse(readFileSync(cpPath, "utf8")) as {
      durability: string;
      checkpoints: Array<{ kind: string; workstreamId: string }>;
    };
    expect(cpJson.durability).toBe("memory_json");
    expect(cpJson.checkpoints.some((c) => c.kind === "claim")).toBe(true);
    expect(cpJson.checkpoints.some((c) => c.kind === "start")).toBe(true);
    expect(cpJson.checkpoints.some((c) => c.kind === "completion")).toBe(true);
    expect(storeJson.workstreams.some((w) => w.id === ws.id)).toBe(true);

    const resumed = resumeDispatcherAfterRestart();
    expect(resumed.durability).toBe("memory_json");
    expect(resumed.checkpoints).toBeGreaterThanOrEqual(3);
    expect(resumed.workstreams).toBeGreaterThanOrEqual(1);

    const afterRestart = listDispatchCheckpoints({ workstreamId: ws.id });
    expect(afterRestart.some((c) => c.kind === "claim")).toBe(true);
    expect(afterRestart.some((c) => c.kind === "start")).toBe(true);
    expect(afterRestart.some((c) => c.kind === "completion")).toBe(true);
    expect(getWorkstream(ws.id)?.id).toBe(ws.id);
  });

  it("JSON lease fields survive memory drop; second owner still blocked", () => {
    const m = bootMission();
    const ws = spawnWorkstream({
      missionId: m.id,
      title: "Durable lease",
      role: "scout",
      acceptanceCriteria: [{ text: "lease" }],
    });
    if ("error" in ws) throw new Error(ws.error);

    const a = claimWorkstreamLease({ workstreamId: ws.id, owner: "worker_a" });
    expect(a.ok).toBe(true);
    if (!a.ok) throw new Error("claim");
    const leaseId = a.workstream.leaseId;
    const claimedAt = a.workstream.claimedAt;
    const expires = a.workstream.leaseExpiresAt;

    const storePath = join(tmpData!, "mission-store.json");
    const raw = JSON.parse(readFileSync(storePath, "utf8")) as {
      workstreams: Array<{
        id: string;
        leaseId?: string;
        leaseOwner?: string;
        claimedAt?: string;
        leaseExpiresAt?: string;
      }>;
    };
    const persisted = raw.workstreams.find((w) => w.id === ws.id);
    expect(persisted?.leaseId).toBe(leaseId);
    expect(persisted?.leaseOwner).toBe("worker_a");
    expect(persisted?.claimedAt).toBe(claimedAt);
    expect(persisted?.leaseExpiresAt).toBe(expires);

    const resumed = resumeDispatcherAfterRestart();
    expect(resumed.durability).toBe("memory_json");
    expect(resumed.leasesHeld).toBeGreaterThanOrEqual(1);
    expect(resumed.reclaimed).toBe(0);

    const after = getWorkstream(ws.id)!;
    expect(after.leaseId).toBe(leaseId);
    expect(after.leaseOwner).toBe("worker_a");
    expect(after.claimedAt).toBe(claimedAt);
    expect(after.status).toBe("running");

    const b = claimWorkstreamLease({ workstreamId: ws.id, owner: "worker_b" });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.limit.code).toBe("lease_held");
  });

  it("resume reclaims expired JSON leases so another owner may claim", () => {
    const m = bootMission();
    const ws = spawnWorkstream({
      missionId: m.id,
      title: "Expire across restart",
      role: "scout",
      acceptanceCriteria: [{ text: "e" }],
    });
    if ("error" in ws) throw new Error(ws.error);

    const past = Date.now() - 60_000;
    const claimed = claimWorkstreamLease({
      workstreamId: ws.id,
      owner: "worker_a",
      ttlMs: 1,
      now: past,
    });
    expect(claimed.ok).toBe(true);

    const resumed = resumeDispatcherAfterRestart({ now: Date.now() });
    expect(resumed.reclaimed).toBeGreaterThanOrEqual(1);
    expect(resumed.durability).toBe("memory_json");

    const after = getWorkstream(ws.id)!;
    expect(after.status).toBe("queued");
    expect(after.leaseId).toBeUndefined();
    expect(after.claimedAt).toBeUndefined();

    const b = claimWorkstreamLease({ workstreamId: ws.id, owner: "worker_b" });
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.workstream.leaseOwner).toBe("worker_b");
  });

  it("fan-out tick: maxParallel=1 claims one workstream, not both", async () => {
    const m = bootMission({ maxParallelWorkstreams: 4 });
    const first = spawnWorkstream({
      missionId: m.id,
      title: "Tick A",
      role: "scout",
      acceptanceCriteria: [{ text: "a" }],
    });
    if ("error" in first) throw new Error(first.error);
    const second = spawnWorkstream({
      missionId: m.id,
      title: "Tick B",
      role: "scout",
      acceptanceCriteria: [{ text: "b" }],
    });
    if ("error" in second) throw new Error(second.error);

    const tick = await tickMissions({
      tenantSlug: "bypilar",
      maxParallel: 1,
      owner: "tick_fanout",
    });
    expect(tick.ok).toBe(true);
    expect(tick.claimed).toBe(1);
    expect(tick.limits?.some((l) => l.code === "max_parallel_workstreams")).toBe(
      true,
    );

    const a = getWorkstream(first.id)!;
    const b = getWorkstream(second.id)!;
    const runningOrDone = [a, b].filter((w) => w.status !== "queued");
    const stillQueued = [a, b].filter((w) => w.status === "queued");
    expect(runningOrDone.length).toBe(1);
    expect(stillQueued.length).toBe(1);
  });

  it("no infinite retry: rework_limit_reached is machine-readable", () => {
    const m = bootMission({ maxReworkLoops: 1 });
    const ws = spawnWorkstream({
      missionId: m.id,
      title: "Retry",
      role: "scout",
      acceptanceCriteria: [{ text: "r" }],
    });
    if ("error" in ws) throw new Error(ws.error);
    updateWorkstream(ws.id, { status: "failed", reworkLoops: 1 });

    const skip = explainClaimSkip(ws.id);
    expect(skip?.code).toBe("rework_limit_reached");

    const claim = claimWorkstreamLease({ workstreamId: ws.id, owner: "w" });
    expect(claim.ok).toBe(false);
    if (!claim.ok) expect(claim.limit.code).toBe("rework_limit_reached");

    const claimable = listClaimableWorkstreams({ tenantSlug: "bypilar" });
    expect(claimable.every((w) => w.id !== ws.id)).toBe(true);
  });

  it("NO_AUTO_MERGE / NO_AUTO_DEPLOY remain locked true", () => {
    expect(SWARM_INVARIANTS.NO_AUTO_MERGE).toBe(true);
    expect(SWARM_INVARIANTS.NO_AUTO_DEPLOY).toBe(true);
    expect(EXECUTION_CONTROL_INVARIANTS.NO_AUTO_MERGE).toBe(true);
    expect(EXECUTION_CONTROL_INVARIANTS.NO_AUTO_DEPLOY).toBe(true);
    expect(EXECUTION_CONTROL_INVARIANTS.MANUAL_MERGE_ONLY).toBe(true);
    expect(missionCompletedIsNotMergeDeploy()).toBe(true);
  });
});
