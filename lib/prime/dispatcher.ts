// Mission dispatcher — lease + controlled concurrency for Execution Control.
// Wired into /api/agents/tick. Failures are per-workstream (never kill the worker).
// SAFETY: NO_AUTO_MERGE / NO_AUTO_DEPLOY / suggestion_only / no journal-sign autonomy.

import { randomBytes } from "node:crypto";
import { auditLog } from "@/lib/audit";
import { appendAgentLedger } from "@/lib/agents/ledger";
import { runAgent } from "@/lib/agents/runtime";
import {
  recordBudget,
  recordReworkLoop,
  reserveBudget,
  estimateTokensFromMessages,
} from "@/lib/prime/budget-guard";
import { appendEvidence, ensureEvidence } from "@/lib/prime/evidence";
import { detectPathConflict } from "@/lib/prime/mission-policy";
import {
  getMission,
  getWorkstream,
  listMissions,
  listWorkstreams,
  updateMissionRun,
  updateWorkstream,
} from "@/lib/prime/mission-store";
import {
  EXECUTION_CONTROL_INVARIANTS,
  type Mission,
  type MissionRole,
  type Workstream,
} from "@/lib/prime/mission-types";
import { roleMay } from "@/lib/prime/roles";
import { createWorktreeForTask } from "@/lib/swarm/worktree-manager";

const LEASE_MS = 5 * 60_000;
const DEFAULT_MAX_PARALLEL = EXECUTION_CONTROL_INVARIANTS.MAX_PARALLEL_WORKSTREAMS;

type DispatcherRoot = {
  tickInFlight: boolean;
  lastTickAt: string | null;
  lastResult: MissionTickResult | null;
};

const DKEY = "__praxisos_mission_dispatcher_v1__";

function getRoot(): DispatcherRoot {
  const g = globalThis as typeof globalThis & { [DKEY]?: DispatcherRoot };
  if (!g[DKEY]) {
    g[DKEY] = { tickInFlight: false, lastTickAt: null, lastResult: null };
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
};

export type MissionTickResult = {
  ok: boolean;
  skipped?: string;
  claimed: number;
  completed: number;
  failed: number;
  blocked: number;
  results: WorkstreamTickResult[];
  at: string;
};

function nid(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

function leaseExpired(ws: Workstream, now = Date.now()): boolean {
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

/**
 * Eligible: mission running, workstream queued (or expired lease), role may run.
 * Builders with overlapping scopes are left queued/blocked separately.
 */
export function listClaimableWorkstreams(opts?: {
  tenantSlug?: string;
  now?: number;
}): Workstream[] {
  const now = opts?.now ?? Date.now();
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
      if (w.status === "queued" && (!w.leaseId || leaseExpired(w, now))) return true;
      // retry failed if under rework budget
      if (
        w.status === "failed" &&
        w.reworkLoops < m.budgets.maxReworkLoops &&
        (!w.leaseId || leaseExpired(w, now))
      ) {
        return true;
      }
      return false;
    });
    // Prefer scout → builder → verifier → reviewer order
    const order: MissionRole[] = ["scout", "builder", "verifier", "reviewer", "release_steward"];
    queued.sort(
      (a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.createdAt.localeCompare(b.createdAt),
    );
    out.push(...queued.slice(0, Math.max(0, slots)));
  }
  return out;
}

/**
 * Atomic-ish lease: only one tick can claim a workstream (process-local + expiry).
 * Returns null if already leased by another owner.
 */
export function tryLeaseWorkstream(input: {
  workstreamId: string;
  owner: string;
  ttlMs?: number;
}): Workstream | null {
  const ws = getWorkstream(input.workstreamId);
  if (!ws) return null;
  const now = Date.now();
  if (ws.leaseId && !leaseExpired(ws, now) && ws.leaseOwner !== input.owner) {
    return null;
  }
  const claimable =
    ws.status === "queued" ||
    ws.status === "failed" ||
    (ws.status === "running" && ws.leaseOwner === input.owner);
  if (!claimable) return null;

  const m = getMission(ws.missionId);
  if (!m || m.status !== "running") return null;

  // Builder path overlap → block instead of lease
  if (ws.role === "builder" && ws.changedFiles.length) {
    const conflict = detectPathConflict({
      missionId: ws.missionId,
      workstreamId: ws.id,
      proposedFiles: ws.changedFiles,
    });
    if (!conflict.ok) {
      updateWorkstream(ws.id, {
        status: "blocked",
        blockedReason: conflict.reason,
        leaseId: undefined,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
      });
      return getWorkstream(ws.id) ?? null;
    }
  }

  const leaseId = nid("lease");
  const expires = new Date(now + (input.ttlMs ?? LEASE_MS)).toISOString();
  updateWorkstream(ws.id, {
    status: "running",
    leaseId,
    leaseOwner: input.owner,
    leaseExpiresAt: expires,
    attemptCount: ws.attemptCount + 1,
    blockedReason: undefined,
    lastError: undefined,
  });
  auditLog("prime.workstream_leased", {
    tenant_id: ws.tenantSlug,
    target_ref: `workstream/${ws.id}`,
    leaseId,
    owner: input.owner,
    role: ws.role,
  });
  return getWorkstream(ws.id) ?? null;
}

export function releaseLease(workstreamId: string): void {
  const ws = getWorkstream(workstreamId);
  if (!ws) return;
  updateWorkstream(ws.id, {
    leaseId: undefined,
    leaseOwner: undefined,
    leaseExpiresAt: undefined,
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
          releaseLease(ws.id);
          return {
            workstreamId: ws.id,
            missionId: ws.missionId,
            role: ws.role,
            status: "blocked",
            error: conflict.reason,
            leased: true,
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
    for (const ws of claimable) {
      if (leased.length >= maxParallel) break;
      const got = tryLeaseWorkstream({ workstreamId: ws.id, owner });
      if (!got) continue;
      if (got.status === "blocked") continue;
      leased.push(got);
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
