// Mission dispatcher — multi-session kernel: lease + fan-out + checkpoints.
// Wired into /api/agents/tick. Failures are per-workstream (never kill the worker).
// SAFETY: NO_AUTO_MERGE / NO_AUTO_DEPLOY / suggestion_only / no journal-sign autonomy.
//
// CONFLICT NOTE (budget-guard PR `cursor/budget-guard-hardening-2c11`):
// That PR hardens lib/prime/budget-guard.ts (+ small getMissionRun helper on
// mission-store). This kernel deliberately does NOT modify budget-guard.ts.
// Checkpoint / lease / fan-out live here; fan-in lives in definition-of-done.ts.
// Persistence = process memory + optional PRAXIS_DATA_DIR JSON — NOT Postgres.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { auditLog } from "@/lib/audit";
import { appendAgentLedger } from "@/lib/agents/ledger";
import { runAgent } from "@/lib/agents/runtime";
import {
  recordBudget,
  recordReworkLoop,
  reserveBudget,
  estimateTokensFromMessages,
} from "@/lib/prime/budget-guard";
import { applyMissionFanIn } from "@/lib/prime/definition-of-done";
import { appendEvidence, ensureEvidence } from "@/lib/prime/evidence";
import { detectPathConflict } from "@/lib/prime/mission-policy";
import {
  getMission,
  getWorkstream,
  listMissions,
  listWorkstreams,
  resumeMissionStoreAfterRestart,
  updateMissionRun,
  updateWorkstream,
} from "@/lib/prime/mission-store";
import {
  EXECUTION_CONTROL_INVARIANTS,
  type DispatchLimit,
  type Mission,
  type MissionRole,
  type Workstream,
  type WorkstreamStatus,
} from "@/lib/prime/mission-types";
import { roleMay } from "@/lib/prime/roles";
import { createWorktreeForTask } from "@/lib/swarm/worktree-manager";

const LEASE_MS = 5 * 60_000;
const DEFAULT_MAX_PARALLEL = EXECUTION_CONTROL_INVARIANTS.MAX_PARALLEL_WORKSTREAMS;

/** Dependency satisfied for fan-out (predecessor finished enough to unblock). */
const DEP_SATISFIED: ReadonlySet<WorkstreamStatus> = new Set([
  "done",
  "awaiting_verification",
  "ready_for_review",
  "approved_for_merge",
]);

export type DispatchCheckpointKind =
  | "claim"
  | "start"
  | "completion"
  | "block"
  | "lease_expiry";

export type DispatchCheckpoint = {
  id: string;
  kind: DispatchCheckpointKind;
  at: string;
  missionId: string;
  workstreamId: string;
  leaseId?: string;
  owner?: string;
  status?: string;
  detail?: string;
  /** Explicit durability label — memory/JSON mirror only. */
  durability: "memory_json";
};

type DispatcherRoot = {
  tickInFlight: boolean;
  lastTickAt: string | null;
  lastResult: MissionTickResult | null;
  checkpoints: DispatchCheckpoint[];
};

const DKEY = "__praxisos_mission_dispatcher_v1__";

function getRoot(): DispatcherRoot {
  const g = globalThis as typeof globalThis & { [DKEY]?: DispatcherRoot };
  if (!g[DKEY]) {
    g[DKEY] = {
      tickInFlight: false,
      lastTickAt: null,
      lastResult: null,
      checkpoints: [],
    };
    hydrateCheckpoints(g[DKEY]);
  }
  return g[DKEY];
}

export type WorkstreamTickResult = {
  workstreamId: string;
  missionId: string;
  role: MissionRole;
  status: string;
  agentRunId?: string;
  error?: string;
  leased: boolean;
  limit?: DispatchLimit;
};

export type MissionTickResult = {
  ok: boolean;
  skipped?: string;
  claimed: number;
  completed: number;
  failed: number;
  blocked: number;
  results: WorkstreamTickResult[];
  limits?: DispatchLimit[];
  at: string;
};

export type LeaseClaimResult =
  | { ok: true; workstream: Workstream }
  | { ok: false; limit: DispatchLimit; workstream?: Workstream };

function nid(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

function dataDir(): string | null {
  const dir = process.env.PRAXIS_DATA_DIR?.trim();
  return dir || null;
}

function checkpointPath(): string | null {
  const dir = dataDir();
  return dir ? join(dir, "dispatch-checkpoints.json") : null;
}

function hydrateCheckpoints(root: DispatcherRoot): void {
  const path = checkpointPath();
  if (!path || !existsSync(path)) return;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      checkpoints?: DispatchCheckpoint[];
    };
    if (Array.isArray(raw.checkpoints)) {
      root.checkpoints = raw.checkpoints.slice(0, 500).map((c) => ({
        ...c,
        durability: "memory_json" as const,
      }));
    }
  } catch {
    // ignore corrupt mirror — memory/JSON only, not Postgres
  }
}

function persistCheckpoints(): void {
  const path = checkpointPath();
  if (!path) return;
  try {
    const dir = dataDir()!;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      path,
      JSON.stringify(
        {
          durability: "memory_json",
          note: "NOT Postgres-durable — resume via memory/JSON hydrate only",
          checkpoints: getRoot().checkpoints.slice(0, 400),
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {
    // ignore
  }
}

export function recordDispatchCheckpoint(
  input: Omit<DispatchCheckpoint, "id" | "at" | "durability"> & {
    at?: string;
  },
): DispatchCheckpoint {
  const cp: DispatchCheckpoint = {
    id: nid("cp"),
    at: input.at ?? new Date().toISOString(),
    kind: input.kind,
    missionId: input.missionId,
    workstreamId: input.workstreamId,
    leaseId: input.leaseId,
    owner: input.owner,
    status: input.status,
    detail: input.detail,
    durability: "memory_json",
  };
  const root = getRoot();
  root.checkpoints.unshift(cp);
  if (root.checkpoints.length > 500) root.checkpoints.length = 500;
  persistCheckpoints();
  return cp;
}

export function listDispatchCheckpoints(opts?: {
  missionId?: string;
  workstreamId?: string;
  kind?: DispatchCheckpointKind;
  limit?: number;
}): DispatchCheckpoint[] {
  const limit = Math.min(200, opts?.limit ?? 80);
  return getRoot()
    .checkpoints.filter((c) => {
      if (opts?.missionId && c.missionId !== opts.missionId) return false;
      if (opts?.workstreamId && c.workstreamId !== opts.workstreamId) return false;
      if (opts?.kind && c.kind !== opts.kind) return false;
      return true;
    })
    .slice(0, limit);
}

/**
 * Simulate process restart: drop in-memory mission store + dispatcher root,
 * rehydrate leases/workstreams and checkpoints from PRAXIS_DATA_DIR JSON
 * (memory/JSON — not Postgres), then reclaim expired leases.
 */
export function resumeDispatcherAfterRestart(opts?: { now?: number }): {
  checkpoints: number;
  workstreams: number;
  leasesHeld: number;
  reclaimed: number;
  durability: "memory_json";
} {
  const now = opts?.now ?? Date.now();
  const storeResume = resumeMissionStoreAfterRestart();
  const g = globalThis as typeof globalThis & { [DKEY]?: DispatcherRoot };
  delete g[DKEY];
  const root = getRoot();
  const reclaimed = reclaimExpiredLeases({ now });
  const leasesHeld = listWorkstreams().filter(
    (w) => Boolean(w.leaseId) && !leaseExpired(w, now),
  ).length;
  return {
    checkpoints: root.checkpoints.length,
    workstreams: storeResume.workstreams,
    leasesHeld,
    reclaimed: reclaimed.length,
    durability: "memory_json",
  };
}

/** Test helper — clear checkpoints without touching mission-store. */
export function __resetDispatcherCheckpointsForTests(): void {
  const root = getRoot();
  root.checkpoints = [];
  root.lastTickAt = null;
  root.lastResult = null;
  root.tickInFlight = false;
  persistCheckpoints();
}

export function leaseExpired(ws: Workstream, now = Date.now()): boolean {
  if (!ws.leaseExpiresAt) return true;
  return Date.parse(ws.leaseExpiresAt) <= now;
}

function missionCap(m: Mission): number {
  return Math.max(
    1,
    Math.min(
      DEFAULT_MAX_PARALLEL,
      m.budgets.maxParallelWorkstreams ?? DEFAULT_MAX_PARALLEL,
    ),
  );
}

function runningOrLeasedCount(missionId: string, now = Date.now()): number {
  return listWorkstreams({ missionId }).filter((w) => {
    if (w.status === "running") return true;
    if (
      w.leaseId &&
      !leaseExpired(w, now) &&
      ["queued", "awaiting_verification"].includes(w.status)
    ) {
      return true;
    }
    return false;
  }).length;
}

export function dependenciesSatisfied(
  ws: Workstream,
): { ok: true } | { ok: false; waitingOn: string[] } {
  const deps = ws.dependsOnWorkstreamIds ?? [];
  if (!deps.length) return { ok: true };
  const waitingOn: string[] = [];
  for (const id of deps) {
    const dep = getWorkstream(id);
    if (!dep || !DEP_SATISFIED.has(dep.status)) waitingOn.push(id);
  }
  return waitingOn.length ? { ok: false, waitingOn } : { ok: true };
}

/**
 * Controlled reclaim: expired leases on running workstreams return to queued
 * so another worker may claim. Records lease_expiry checkpoint (memory/JSON).
 */
export function reclaimExpiredLeases(opts?: {
  tenantSlug?: string;
  now?: number;
}): Workstream[] {
  const now = opts?.now ?? Date.now();
  const reclaimed: Workstream[] = [];
  const missions = listMissions({
    tenantSlug: opts?.tenantSlug,
    status: "running",
    limit: 50,
  });
  for (const m of missions) {
    for (const w of listWorkstreams({ missionId: m.id })) {
      if (!w.leaseId || !leaseExpired(w, now)) continue;
      if (w.status !== "running" && w.status !== "queued") continue;
      const prevLease = w.leaseId;
      updateWorkstream(w.id, {
        status: "queued",
        leaseId: undefined,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        claimedAt: undefined,
      });
      recordDispatchCheckpoint({
        kind: "lease_expiry",
        missionId: m.id,
        workstreamId: w.id,
        leaseId: prevLease,
        owner: w.leaseOwner,
        status: "queued",
        detail: "lease_expired_reclaim",
      });
      const after = getWorkstream(w.id);
      if (after) reclaimed.push(after);
    }
  }
  return reclaimed;
}

/**
 * Eligible: mission running, workstream queued (or expired lease), deps ok,
 * under maxParallel — machine-readable skip, no spin.
 */
export function listClaimableWorkstreams(opts?: {
  tenantSlug?: string;
  now?: number;
}): Workstream[] {
  const now = opts?.now ?? Date.now();
  reclaimExpiredLeases({ tenantSlug: opts?.tenantSlug, now });
  const missions = listMissions({
    tenantSlug: opts?.tenantSlug,
    status: "running",
    limit: 50,
  });
  const out: Workstream[] = [];
  for (const m of missions) {
    const slots = missionCap(m) - runningOrLeasedCount(m.id, now);
    if (slots <= 0) continue;
    const queued = listWorkstreams({ missionId: m.id }).filter((w) => {
      if (w.status === "queued" && (!w.leaseId || leaseExpired(w, now))) {
        return dependenciesSatisfied(w).ok;
      }
      // retry failed if under rework budget — finite, no infinite retry
      if (
        w.status === "failed" &&
        w.reworkLoops < m.budgets.maxReworkLoops &&
        (!w.leaseId || leaseExpired(w, now))
      ) {
        return dependenciesSatisfied(w).ok;
      }
      return false;
    });
    const order: MissionRole[] = [
      "scout",
      "builder",
      "verifier",
      "reviewer",
      "release_steward",
    ];
    queued.sort(
      (a, b) =>
        order.indexOf(a.role) - order.indexOf(b.role) ||
        a.createdAt.localeCompare(b.createdAt),
    );
    out.push(...queued.slice(0, Math.max(0, slots)));
  }
  return out;
}

/**
 * Why a workstream is not claimable right now (machine-readable; no spin).
 */
export function explainClaimSkip(
  workstreamId: string,
  opts?: { now?: number; owner?: string },
): DispatchLimit | null {
  const ws = getWorkstream(workstreamId);
  if (!ws) {
    return {
      code: "workstream_not_claimable",
      reason: "workstream_not_found",
    };
  }
  const now = opts?.now ?? Date.now();
  const m = getMission(ws.missionId);
  if (!m || m.status !== "running") {
    return { code: "mission_not_running", reason: "mission_not_running" };
  }
  if (ws.leaseId && !leaseExpired(ws, now) && ws.leaseOwner !== opts?.owner) {
    return {
      code: "lease_held",
      reason: "lease_held_by_other",
      leaseOwner: ws.leaseOwner,
    };
  }
  const deps = dependenciesSatisfied(ws);
  if (!deps.ok) {
    return {
      code: "dependency_unsatisfied",
      reason: "depends_on_incomplete",
      waitingOn: deps.waitingOn,
    };
  }
  if (
    ws.status === "failed" &&
    ws.reworkLoops >= m.budgets.maxReworkLoops
  ) {
    return {
      code: "rework_limit_reached",
      reason: "max_rework_loops",
      limit: m.budgets.maxReworkLoops,
    };
  }
  const active = runningOrLeasedCount(m.id, now);
  const limit = missionCap(m);
  if (active >= limit && ws.status !== "running") {
    return {
      code: "max_parallel_workstreams",
      reason: "max_parallel_workstreams",
      limit,
      active,
    };
  }
  if (ws.status !== "queued" && ws.status !== "failed") {
    if (!(ws.status === "running" && ws.leaseOwner === opts?.owner)) {
      return {
        code: "workstream_not_claimable",
        reason: `status_${ws.status}`,
      };
    }
  }
  return null;
}

/**
 * Atomic-ish lease: only one tick can claim a workstream (process-local + expiry).
 * Returns null if already leased by another owner (legacy API).
 */
export function tryLeaseWorkstream(input: {
  workstreamId: string;
  owner: string;
  ttlMs?: number;
  now?: number;
}): Workstream | null {
  const result = claimWorkstreamLease(input);
  if (!result.ok) {
    if (result.workstream?.status === "blocked") return result.workstream;
    return null;
  }
  return result.workstream;
}

/**
 * Single-worker claim with leaseId / claimedAt / leaseExpiresAt.
 * Controlled reclaim when prior lease expired. Machine-readable limit on deny.
 */
export function claimWorkstreamLease(input: {
  workstreamId: string;
  owner: string;
  ttlMs?: number;
  now?: number;
}): LeaseClaimResult {
  const ws = getWorkstream(input.workstreamId);
  if (!ws) {
    return {
      ok: false,
      limit: {
        code: "workstream_not_claimable",
        reason: "workstream_not_found",
      },
    };
  }
  const now = input.now ?? Date.now();

  // Controlled reclaim of expired lease before re-claim
  if (ws.leaseId && leaseExpired(ws, now)) {
    recordDispatchCheckpoint({
      kind: "lease_expiry",
      missionId: ws.missionId,
      workstreamId: ws.id,
      leaseId: ws.leaseId,
      owner: ws.leaseOwner,
      status: ws.status,
      detail: "expired_before_claim",
    });
    updateWorkstream(ws.id, {
      status: ws.status === "running" ? "queued" : ws.status,
      leaseId: undefined,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      claimedAt: undefined,
    });
  }

  const fresh = getWorkstream(ws.id)!;
  if (
    fresh.leaseId &&
    !leaseExpired(fresh, now) &&
    fresh.leaseOwner !== input.owner
  ) {
    return {
      ok: false,
      limit: {
        code: "lease_held",
        reason: "no_double_claim",
        leaseOwner: fresh.leaseOwner,
      },
    };
  }

  const m = getMission(fresh.missionId);
  if (!m || m.status !== "running") {
    return {
      ok: false,
      limit: { code: "mission_not_running", reason: "mission_not_running" },
    };
  }

  const deps = dependenciesSatisfied(fresh);
  if (!deps.ok) {
    return {
      ok: false,
      limit: {
        code: "dependency_unsatisfied",
        reason: "depends_on_incomplete",
        waitingOn: deps.waitingOn,
      },
    };
  }

  if (
    fresh.status === "failed" &&
    fresh.reworkLoops >= m.budgets.maxReworkLoops
  ) {
    return {
      ok: false,
      limit: {
        code: "rework_limit_reached",
        reason: "max_rework_loops",
        limit: m.budgets.maxReworkLoops,
      },
    };
  }

  const claimable =
    fresh.status === "queued" ||
    fresh.status === "failed" ||
    (fresh.status === "running" && fresh.leaseOwner === input.owner);
  if (!claimable) {
    return {
      ok: false,
      limit: {
        code: "workstream_not_claimable",
        reason: `status_${fresh.status}`,
      },
    };
  }

  // Parallel cap — machine-readable, no spin
  const active = runningOrLeasedCount(m.id, now);
  const cap = missionCap(m);
  if (
    fresh.status !== "running" &&
    active >= cap
  ) {
    return {
      ok: false,
      limit: {
        code: "max_parallel_workstreams",
        reason: "max_parallel_workstreams",
        limit: cap,
        active,
      },
    };
  }

  // Builder path overlap → block instead of lease
  if (fresh.role === "builder" && fresh.changedFiles.length) {
    const conflict = detectPathConflict({
      missionId: fresh.missionId,
      workstreamId: fresh.id,
      proposedFiles: fresh.changedFiles,
    });
    if (!conflict.ok) {
      updateWorkstream(fresh.id, {
        status: "blocked",
        blockedReason: conflict.reason,
        leaseId: undefined,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        claimedAt: undefined,
      });
      recordDispatchCheckpoint({
        kind: "block",
        missionId: fresh.missionId,
        workstreamId: fresh.id,
        status: "blocked",
        detail: conflict.reason,
      });
      return {
        ok: false,
        limit: {
          code: "path_conflict",
          reason: conflict.reason,
          conflictingWorkstreamId: conflict.conflictingWorkstreamId,
        },
        workstream: getWorkstream(fresh.id),
      };
    }
  }

  const leaseId = nid("lease");
  const claimedAt = new Date(now).toISOString();
  const expires = new Date(now + (input.ttlMs ?? LEASE_MS)).toISOString();
  updateWorkstream(fresh.id, {
    status: "running",
    leaseId,
    leaseOwner: input.owner,
    leaseExpiresAt: expires,
    claimedAt,
    attemptCount: fresh.attemptCount + 1,
    blockedReason: undefined,
    lastError: undefined,
  });
  recordDispatchCheckpoint({
    kind: "claim",
    missionId: fresh.missionId,
    workstreamId: fresh.id,
    leaseId,
    owner: input.owner,
    status: "running",
    detail: `claimedAt=${claimedAt}`,
  });
  auditLog("prime.workstream_leased", {
    tenant_id: fresh.tenantSlug,
    target_ref: `workstream/${fresh.id}`,
    leaseId,
    owner: input.owner,
    role: fresh.role,
    claimedAt,
  });
  return { ok: true, workstream: getWorkstream(fresh.id)! };
}

export function releaseLease(workstreamId: string): void {
  const ws = getWorkstream(workstreamId);
  if (!ws) return;
  updateWorkstream(ws.id, {
    leaseId: undefined,
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
    claimedAt: undefined,
  });
}

function rolePrompt(ws: Workstream, mission: Mission): string {
  const ac = ws.acceptanceCriteria.map((c) => `- ${c.text}`).join("\n") || "(none)";
  const base = [
    `Mission: ${mission.title}`,
    `Goal: ${mission.goal}`,
    `Risk: ${mission.riskLevel}`,
    `Platform scope: ${mission.platformScope.join(", ")}`,
    `Workstream role: ${ws.role}`,
    `Allowed paths: ${ws.allowedPaths.join(", ")}`,
    `Forbidden paths: ${ws.forbiddenPaths.join(", ")}`,
    `Acceptance criteria:\n${ac}`,
    "",
    "HARD LOCKS: NO_AUTO_MERGE, NO_AUTO_DEPLOY, suggestion_only clinical,",
    "NO_MODEL_TRAINING, PATHOLOGY_SHADOW, no SMS/patient/journal-sign autonomy.",
  ].join("\n");

  switch (ws.role) {
    case "scout":
      return `${base}\n\nScout: research and propose a safe implementation plan. Do not write production code. Do not merge/deploy.`;
    case "builder":
      return `${base}\n\nBuilder: propose additive changes only within allowedPaths. Do not merge, deploy, touch secrets, sign journals, or send SMS.`;
    case "verifier":
      return `${base}\n\nVerifier: list verification commands (tests/typecheck) and expected evidence. Do not merge.`;
    case "reviewer":
      return `${base}\n\nReviewer: review policy/DoD readiness. Flag clinical/auth risks. Never self-approve clinical or merge.`;
    default:
      return `${base}\n\nRespond with a short status only.`;
  }
}

/** Map mission role → clinic agent persona (prompt name, not OS process). */
function personaForRole(role: MissionRole): string {
  switch (role) {
    case "scout":
      return "frej";
    case "builder":
      return "atlas";
    case "verifier":
      return "frej";
    case "reviewer":
      return "frej";
    default:
      return "aria";
  }
}

async function runRoleAgent(ws: Workstream, mission: Mission): Promise<{
  agentRunId: string;
  reply: string;
  mode: string;
}> {
  if (ws.role === "builder" && !roleMay("builder", "write_path")) {
    throw new Error("role_cannot_write_path");
  }

  const result = await runAgent({
    agentId: personaForRole(ws.role),
    message: rolePrompt(ws, mission),
    tenant: mission.tenantSlug,
    trigger: "workflow",
    workflowId: "wf_prime_mission",
    autoRoute: false,
    maxToolRounds: 2,
    missionId: mission.id,
    workstreamId: ws.id,
    missionRole: ws.role,
  });

  // Heuristic path never hits chatCompletions BudgetGuard — soft-record estimate.
  if (result.mode === "heuristic") {
    const estimate = estimateTokensFromMessages({
      messages: [{ content: rolePrompt(ws, mission) }],
      completion: result.reply,
      toolCallCount: result.run.toolCalls.length,
    });
    const reserved = reserveBudget({
      missionId: mission.id,
      workstreamId: ws.id,
      role: ws.role,
      estimatedTokens: estimate,
      toolCallsSoFar: result.run.toolCalls.length,
    });
    if (reserved.ok && reserved.run) {
      recordBudget({
        missionId: mission.id,
        runId: reserved.run.id,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: estimate,
          estimated: true,
          reservedTokens: reserved.reservation ?? estimate,
        },
        toolCallCount: result.run.toolCalls.length,
      });
      updateMissionRun(reserved.run.id, { agentRunId: result.run.id });
    } else if (!reserved.ok && reserved.code === "budget_exhausted") {
      updateWorkstream(ws.id, {
        status: "budget_exhausted",
        lastError: reserved.reason,
      });
      throw new Error("budget_exhausted");
    }
  }

  return {
    agentRunId: result.run.id,
    reply: result.reply,
    mode: result.mode,
  };
}

async function attachBuilderWorktree(ws: Workstream): Promise<Workstream> {
  const wt = await createWorktreeForTask({
    taskId: ws.id,
    title: `${ws.missionId}-${ws.title}`,
  });
  if ("error" in wt) {
    // Plan-only path: do not fail the whole tick; mark awaiting_human with reason
    updateWorkstream(ws.id, {
      lastError: `worktree_${wt.error}`,
    });
    return getWorkstream(ws.id)!;
  }
  updateWorkstream(ws.id, {
    branchName: wt.branchName,
    worktreePath: wt.path,
  });
  appendEvidence({
    workstreamId: ws.id,
    files: ws.changedFiles,
    commands: [
      {
        command: `git worktree add ${wt.path}`,
        exitCode: 0,
        at: new Date().toISOString(),
        summary: `branch ${wt.branchName}`,
      },
    ],
  });
  return getWorkstream(ws.id)!;
}

/**
 * Execute one leased workstream. Errors are returned, never thrown to caller pool.
 */
export async function executeLeasedWorkstream(
  workstreamId: string,
): Promise<WorkstreamTickResult> {
  const ws = getWorkstream(workstreamId);
  if (!ws) {
    return {
      workstreamId,
      missionId: "",
      role: "scout",
      status: "failed",
      error: "workstream_not_found",
      leased: false,
    };
  }
  const mission = getMission(ws.missionId);
  if (!mission) {
    releaseLease(ws.id);
    updateWorkstream(ws.id, { status: "failed", lastError: "mission_not_found" });
    return {
      workstreamId: ws.id,
      missionId: ws.missionId,
      role: ws.role,
      status: "failed",
      error: "mission_not_found",
      leased: true,
    };
  }

  try {
    recordDispatchCheckpoint({
      kind: "start",
      missionId: ws.missionId,
      workstreamId: ws.id,
      leaseId: ws.leaseId,
      owner: ws.leaseOwner,
      status: "running",
    });
    ensureEvidence(ws.id);

    if (ws.role === "builder") {
      // Overlap check on allowedPaths claim
      if (ws.allowedPaths.length) {
        const conflict = detectPathConflict({
          missionId: ws.missionId,
          workstreamId: ws.id,
          proposedFiles: ws.changedFiles.length
            ? ws.changedFiles
            : ws.allowedPaths.map((p) => `${p.replace(/\/$/, "")}/SCOPE_CLAIM`),
        });
        // Only block on real changedFiles overlap; SCOPE_CLAIM is soft
        if (!conflict.ok && ws.changedFiles.length) {
          updateWorkstream(ws.id, {
            status: "blocked",
            blockedReason: conflict.reason,
          });
          recordDispatchCheckpoint({
            kind: "block",
            missionId: ws.missionId,
            workstreamId: ws.id,
            status: "blocked",
            detail: conflict.reason,
          });
          releaseLease(ws.id);
          applyMissionFanIn(ws.missionId);
          return {
            workstreamId: ws.id,
            missionId: ws.missionId,
            role: ws.role,
            status: "blocked",
            error: conflict.reason,
            leased: true,
            limit: {
              code: "path_conflict",
              reason: conflict.reason,
              conflictingWorkstreamId: conflict.conflictingWorkstreamId,
            },
          };
        }
      }
      await attachBuilderWorktree(ws);
    }

    const ran = await runRoleAgent(ws, mission);
    const ids = [...ws.agentRunIds, ran.agentRunId];
    updateWorkstream(ws.id, { agentRunIds: ids });

    // Role completion transitions (suggestion-only; no merge)
    let nextStatus: Workstream["status"] = "awaiting_verification";
    if (ws.role === "scout") nextStatus = "done";
    if (ws.role === "builder") nextStatus = "awaiting_verification";
    if (ws.role === "verifier" || ws.role === "reviewer") nextStatus = "ready_for_review";

    appendEvidence({
      workstreamId: ws.id,
      humanDecisions: [`dispatcher executed ${ws.role} mode=${ran.mode}`],
      limitations: [
        "Dispatcher creates AgentRuns + optional worktree; human still gates merge/deploy.",
      ],
      rollback: "cancel mission / discard worktree — NO_AUTO_MERGE",
    });

    updateWorkstream(ws.id, { status: nextStatus });
    releaseLease(ws.id);
    recordDispatchCheckpoint({
      kind: "completion",
      missionId: ws.missionId,
      workstreamId: ws.id,
      status: nextStatus,
      detail: `agentRunId=${ran.agentRunId}`,
    });

    // Fan-in attempt after each completion (ready only when all gates pass)
    applyMissionFanIn(ws.missionId);

    appendAgentLedger({
      tenantSlug: ws.tenantSlug,
      agent: "PRIME_COMMANDER",
      workflow: "prime_execution",
      event: "workstream_tick",
      payload: {
        workstreamId: ws.id,
        role: ws.role,
        status: nextStatus,
        agentRunId: ran.agentRunId,
      },
    });

    return {
      workstreamId: ws.id,
      missionId: ws.missionId,
      role: ws.role,
      status: nextStatus,
      agentRunId: ran.agentRunId,
      leased: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const rework = recordReworkLoop(ws.missionId);
    updateWorkstream(ws.id, {
      status: "failed",
      lastError: message,
      reworkLoops: ws.reworkLoops + 1,
    });
    releaseLease(ws.id);
    recordDispatchCheckpoint({
      kind: "completion",
      missionId: ws.missionId,
      workstreamId: ws.id,
      status: "failed",
      detail: message,
    });
    applyMissionFanIn(ws.missionId);
    auditLog("prime.workstream_failed", {
      tenant_id: ws.tenantSlug,
      target_ref: `workstream/${ws.id}`,
      error: message,
      reworkOk: rework.ok,
    });
    return {
      workstreamId: ws.id,
      missionId: ws.missionId,
      role: ws.role,
      status: "failed",
      error: message,
      leased: true,
    };
  }
}

/**
 * Controlled concurrency pool — NOT unbounded Promise.all over all work.
 * Spawns at most `concurrency` workers that pull from a shared index.
 */
export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length || 1)) },
    async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= items.length) break;
        try {
          results[idx] = await fn(items[idx]!);
        } catch (err) {
          // Per-item isolation — pool continues
          results[idx] = {
            error: err instanceof Error ? err.message : String(err),
          } as R;
        }
      }
    },
  );
  if (items.length === 0) return [];
  await Promise.all(workers);
  return results;
}

/**
 * Mission dispatcher tick — claim up to maxParallel workstreams and execute.
 * Mutex prevents two overlapping dispatcher ticks in the same process.
 */
export async function tickMissions(opts?: {
  tenantSlug?: string;
  owner?: string;
  maxParallel?: number;
}): Promise<MissionTickResult> {
  const root = getRoot();
  const at = new Date().toISOString();
  if (root.tickInFlight) {
    return {
      ok: false,
      skipped: "dispatcher_tick_in_flight",
      claimed: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      limits: [
        {
          code: "dispatcher_tick_in_flight",
          reason: "dispatcher_tick_in_flight",
        },
      ],
      results: [],
      at,
    };
  }
  root.tickInFlight = true;
  const owner = opts?.owner ?? `tick_${nid("own")}`;
  const maxParallel = Math.max(
    1,
    Math.min(DEFAULT_MAX_PARALLEL, opts?.maxParallel ?? DEFAULT_MAX_PARALLEL),
  );

  try {
    const claimable = listClaimableWorkstreams({ tenantSlug: opts?.tenantSlug });
    const leased: Workstream[] = [];
    const limits: DispatchLimit[] = [];
    for (const ws of claimable) {
      if (leased.length >= maxParallel) {
        limits.push({
          code: "max_parallel_workstreams",
          reason: "tick_max_parallel",
          limit: maxParallel,
          active: leased.length,
        });
        break;
      }
      const got = claimWorkstreamLease({ workstreamId: ws.id, owner });
      if (!got.ok) {
        limits.push(got.limit);
        continue;
      }
      leased.push(got.workstream);
    }

    const results = await runPool(leased, maxParallel, (ws) =>
      executeLeasedWorkstream(ws.id),
    );

    const summary: MissionTickResult = {
      ok: true,
      claimed: leased.length,
      completed: results.filter((r) =>
        ["done", "awaiting_verification", "ready_for_review"].includes(r.status),
      ).length,
      failed: results.filter((r) => r.status === "failed").length,
      blocked: results.filter((r) => r.status === "blocked").length,
      results,
      limits: limits.length ? limits : undefined,
      at,
    };
    root.lastTickAt = at;
    root.lastResult = summary;
    auditLog("prime.mission_tick", {
      tenant_id: opts?.tenantSlug ?? "bypilar",
      claimed: summary.claimed,
      completed: summary.completed,
      failed: summary.failed,
    });
    return summary;
  } finally {
    root.tickInFlight = false;
  }
}

export function getDispatcherState() {
  const root = getRoot();
  return {
    tickInFlight: root.tickInFlight,
    lastTickAt: root.lastTickAt,
    lastResult: root.lastResult,
    checkpointCount: root.checkpoints.length,
    durability: "memory_json" as const,
    maxParallelDefault: DEFAULT_MAX_PARALLEL,
    invariants: {
      NO_AUTO_MERGE: EXECUTION_CONTROL_INVARIANTS.NO_AUTO_MERGE,
      NO_AUTO_DEPLOY: EXECUTION_CONTROL_INVARIANTS.NO_AUTO_DEPLOY,
      MANUAL_MERGE_ONLY: EXECUTION_CONTROL_INVARIANTS.MANUAL_MERGE_ONLY,
    },
  };
}

/** Test helper */
export function __setDispatcherInFlightForTests(value: boolean): void {
  getRoot().tickInFlight = value;
}
