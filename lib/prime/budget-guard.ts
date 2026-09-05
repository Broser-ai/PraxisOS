// BudgetGuard — hard-stop for mission-scoped LLM / agent runs.
// Agents cannot raise budgets; missing provider usage → estimate (never 0).

import { auditLog } from "@/lib/audit";
import {
  getMission,
  getMissionRun,
  updateMission,
  updateMissionRun,
  createMissionRun,
} from "@/lib/prime/mission-store";
import type {
  Mission,
  MissionAgentRun,
  MissionRole,
  TokenUsageRecord,
} from "@/lib/prime/mission-types";
import { EXECUTION_CONTROL_INVARIANTS } from "@/lib/prime/mission-types";
import { validateMissionBudgets } from "@/lib/prime/mission-validation";

export type BudgetStatusReport = {
  ok: boolean;
  code?:
  | "budget_exhausted"
  | "mission_not_found"
  | "mission_not_running"
  | "agents_cannot_raise_budgets"
  | "owner_required"
  | "budget_invalid"
  | "run_not_found";
  reason?: string;
  exhausted?: Array<keyof Mission["budgets"]>;
  usage?: Mission["usage"];
  budgets?: Mission["budgets"];
};

/** Conservative estimate when provider omits usage — never returns 0 for non-empty work. */
export function estimateTokensFromMessages(input: {
  messages?: { content?: string | null }[];
  completion?: string | null;
  toolCallCount?: number;
}): number {
  const msgChars = (input.messages ?? []).reduce(
    (n, m) => n + (typeof m.content === "string" ? m.content.length : 0),
    0,
  );
  const outChars = typeof input.completion === "string" ? input.completion.length : 0;
  const base = Math.ceil((msgChars + outChars) / 4);
  const toolOverhead = (input.toolCallCount ?? 0) * 120;
  const estimated = base + toolOverhead + 64; // floor overhead so empty call ≠ 0
  return Math.max(64, estimated);
}

export function extractProviderUsage(raw: unknown): TokenUsageRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const usage = (raw as { usage?: Record<string, unknown> }).usage;
  if (!usage || typeof usage !== "object") return null;
  const prompt = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const completion = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const total = Number(usage.total_tokens ?? prompt + completion);
  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    promptTokens: Number.isFinite(prompt) ? prompt : 0,
    completionTokens: Number.isFinite(completion) ? completion : 0,
    totalTokens: total,
    estimated: false,
    reservedTokens: 0,
  };
}

function checkExhausted(m: Mission, pending: {
  reserveTokens?: number;
  toolCalls?: number;
  changedFilesDelta?: number;
  reworkDelta?: number;
  agentsDelta?: number;
}): Array<keyof Mission["budgets"]> {
  const exhausted: Array<keyof Mission["budgets"]> = [];
  const u = m.usage;
  const b = m.budgets;
  if (u.totalTokens + (pending.reserveTokens ?? 0) > b.maxTotalTokens) {
    exhausted.push("maxTotalTokens");
  }
  if ((pending.reserveTokens ?? 0) > b.maxTokensPerRun) {
    exhausted.push("maxTokensPerRun");
  }
  if ((pending.toolCalls ?? 0) > b.maxToolCallsPerRun) {
    exhausted.push("maxToolCallsPerRun");
  }
  if (u.runtimeMinutes >= b.maxRuntimeMinutes) {
    exhausted.push("maxRuntimeMinutes");
  }
  if (u.agents + (pending.agentsDelta ?? 0) > b.maxAgents) {
    exhausted.push("maxAgents");
  }
  if (u.changedFiles + (pending.changedFilesDelta ?? 0) > b.maxChangedFiles) {
    exhausted.push("maxChangedFiles");
  }
  if (u.reworkLoops + (pending.reworkDelta ?? 0) > b.maxReworkLoops) {
    exhausted.push("maxReworkLoops");
  }
  return exhausted;
}

function markBudgetExhausted(m: Mission, exhausted: Array<keyof Mission["budgets"]>): void {
  updateMission(m.id, { status: "budget_exhausted" });
  auditLog("prime.budget_exhausted", {
    tenant_id: m.tenantSlug,
    target_ref: `mission/${m.id}`,
    exhausted,
    usage: m.usage,
  });
}

/**
 * Reserve tokens before an LLM call. Fails closed on exhaustion.
 */
export function reserveBudget(input: {
  missionId: string;
  workstreamId?: string;
  role: MissionRole;
  estimatedTokens: number;
  toolCallsSoFar?: number;
}): BudgetStatusReport & { run?: MissionAgentRun; reservation?: number } {
  const m = getMission(input.missionId);
  if (!m) return { ok: false, code: "mission_not_found", reason: "mission_not_found" };
  if (m.status !== "running" && m.status !== "approved") {
    return {
      ok: false,
      code: "mission_not_running",
      reason: `mission_status_${m.status}`,
      usage: m.usage,
      budgets: m.budgets,
    };
  }

  const reservation = Math.max(64, Math.ceil(input.estimatedTokens));
  const exhausted = checkExhausted(m, {
    reserveTokens: reservation,
    toolCalls: input.toolCallsSoFar ?? 0,
    agentsDelta: 1,
  });
  if (exhausted.length) {
    markBudgetExhausted(m, exhausted);
    return {
      ok: false,
      code: "budget_exhausted",
      reason: `exhausted:${exhausted.join(",")}`,
      exhausted,
      usage: m.usage,
      budgets: m.budgets,
    };
  }

  // Soft-hold: count agent slot; tokens recorded after call
  updateMission(m.id, {
    usage: {
      ...m.usage,
      agents: m.usage.agents + 1,
    },
    status: "running",
  });

  const run = createMissionRun({
    missionId: m.id,
    workstreamId: input.workstreamId,
    role: input.role,
    status: "running",
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimated: true,
      reservedTokens: reservation,
    },
    toolCallCount: input.toolCallsSoFar ?? 0,
    startedAt: new Date().toISOString(),
  });

  return { ok: true, run, reservation, usage: m.usage, budgets: m.budgets };
}

/**
 * Record actual (or estimated) usage after an LLM call.
 */
export function recordBudget(input: {
  missionId: string;
  runId: string;
  usage: TokenUsageRecord;
  toolCallCount?: number;
  runtimeMinutesDelta?: number;
}): BudgetStatusReport {
  const m = getMission(input.missionId);
  if (!m) return { ok: false, code: "mission_not_found", reason: "mission_not_found" };

  const tokens = Math.max(
    input.usage.estimated ? Math.max(64, input.usage.totalTokens) : input.usage.totalTokens,
    input.usage.reservedTokens > 0 && input.usage.estimated
      ? Math.min(input.usage.reservedTokens, Math.max(64, input.usage.totalTokens))
      : input.usage.totalTokens,
  );

  // Never assume 0 for a completed call
  const charged = tokens > 0 ? tokens : Math.max(64, input.usage.reservedTokens || 64);

  const run = getMissionRun(input.runId);
  if (!run) {
    return { ok: false, code: "run_not_found", reason: "run_not_found" };
  }

  // Runtime is derived from the run's own timestamps when the caller omits a
  // delta, otherwise maxRuntimeMinutes is unenforceable by simply not passing one.
  const elapsedMinutes = (() => {
    if (input.runtimeMinutesDelta !== undefined) return input.runtimeMinutesDelta;
    const started = Date.parse(run.startedAt ?? "");
    if (!Number.isFinite(started)) return 0;
    return Math.max(0, (Date.now() - started) / 60_000);
  })();

  const nextUsage = {
    ...m.usage,
    totalTokens: m.usage.totalTokens + charged,
    estimatedTokens: m.usage.estimatedTokens + (input.usage.estimated ? charged : 0),
    recordedTokens: m.usage.recordedTokens + (input.usage.estimated ? 0 : charged),
    toolCalls: m.usage.toolCalls + (input.toolCallCount ?? 0),
    runtimeMinutes: m.usage.runtimeMinutes + elapsedMinutes,
    // Release the slot reserved by reserveBudget; otherwise a mission leaks an
    // agent slot per run and eventually blocks on maxAgents forever.
    agents: Math.max(0, m.usage.agents - 1),
  };

  updateMission(m.id, { usage: nextUsage });
  updateMissionRun(input.runId, {
    status: "completed",
    tokenUsage: { ...input.usage, totalTokens: charged },
    toolCallCount: input.toolCallCount ?? 0,
    finishedAt: new Date().toISOString(),
  });

  const refreshed = getMission(input.missionId)!;

  // The per-run cap is checked at reserve time against an estimate; enforce it
  // again against what the run actually consumed.
  const perRunExceeded = charged > refreshed.budgets.maxTokensPerRun;
  const exhausted = checkExhausted(refreshed, {});
  if (perRunExceeded) exhausted.push("maxTokensPerRun");

  if (exhausted.length) {
    markBudgetExhausted(refreshed, exhausted);
    return {
      ok: false,
      code: "budget_exhausted",
      reason: `exhausted:${exhausted.join(",")}`,
      exhausted,
      usage: refreshed.usage,
      budgets: refreshed.budgets,
    };
  }
  return { ok: true, usage: refreshed.usage, budgets: refreshed.budgets };
}

/**
 * Release a reservation without recording usage — for runs that never completed
 * (provider error, crash, cancelled lease). Without this the agent slot leaks.
 */
export function releaseBudgetReservation(input: {
  missionId: string;
  runId: string;
  reason: string;
}): BudgetStatusReport {
  const m = getMission(input.missionId);
  if (!m) return { ok: false, code: "mission_not_found", reason: "mission_not_found" };
  const run = getMissionRun(input.runId);
  if (!run) return { ok: false, code: "run_not_found", reason: "run_not_found" };

  updateMission(m.id, {
    usage: { ...m.usage, agents: Math.max(0, m.usage.agents - 1) },
  });
  updateMissionRun(input.runId, {
    status: "failed",
    finishedAt: new Date().toISOString(),
  });
  auditLog("prime.budget_reservation_released", {
    tenant_id: m.tenantSlug,
    target_ref: `mission/${m.id}`,
    run_id: input.runId,
    reason: input.reason,
  });
  const refreshed = getMission(m.id)!;
  return { ok: true, usage: refreshed.usage, budgets: refreshed.budgets };
}

export function assertToolCallBudget(input: {
  missionId: string;
  toolCallsThisRun: number;
}): BudgetStatusReport {
  const m = getMission(input.missionId);
  if (!m) return { ok: false, code: "mission_not_found", reason: "mission_not_found" };
  if (input.toolCallsThisRun > m.budgets.maxToolCallsPerRun) {
    markBudgetExhausted(m, ["maxToolCallsPerRun"]);
    return {
      ok: false,
      code: "budget_exhausted",
      reason: "exhausted:maxToolCallsPerRun",
      exhausted: ["maxToolCallsPerRun"],
      usage: m.usage,
      budgets: m.budgets,
    };
  }
  return { ok: true, usage: m.usage, budgets: m.budgets };
}

export function recordChangedFiles(missionId: string, count: number): BudgetStatusReport {
  const m = getMission(missionId);
  if (!m) return { ok: false, code: "mission_not_found", reason: "mission_not_found" };
  const next = { ...m.usage, changedFiles: m.usage.changedFiles + count };
  updateMission(m.id, { usage: next });
  const refreshed = getMission(m.id)!;
  const exhausted = checkExhausted(refreshed, {});
  if (exhausted.includes("maxChangedFiles")) {
    markBudgetExhausted(refreshed, ["maxChangedFiles"]);
    return {
      ok: false,
      code: "budget_exhausted",
      reason: "exhausted:maxChangedFiles",
      exhausted: ["maxChangedFiles"],
      usage: refreshed.usage,
      budgets: refreshed.budgets,
    };
  }
  return { ok: true, usage: refreshed.usage, budgets: refreshed.budgets };
}

export function recordReworkLoop(missionId: string): BudgetStatusReport {
  const m = getMission(missionId);
  if (!m) return { ok: false, code: "mission_not_found", reason: "mission_not_found" };
  const next = { ...m.usage, reworkLoops: m.usage.reworkLoops + 1 };
  updateMission(m.id, { usage: next });
  const refreshed = getMission(m.id)!;
  if (refreshed.usage.reworkLoops > refreshed.budgets.maxReworkLoops) {
    markBudgetExhausted(refreshed, ["maxReworkLoops"]);
    return {
      ok: false,
      code: "budget_exhausted",
      reason: "exhausted:maxReworkLoops",
      exhausted: ["maxReworkLoops"],
      usage: refreshed.usage,
      budgets: refreshed.budgets,
    };
  }
  return { ok: true, usage: refreshed.usage, budgets: refreshed.budgets };
}

/**
 * Owner-only budget raise. Agents always rejected.
 */
export function raiseMissionBudget(input: {
  missionId: string;
  actor: string;
  actorRole: "owner" | "support" | "agent" | "practitioner" | "reception" | string;
  patch: Partial<Mission["budgets"]>;
}): BudgetStatusReport & { mission?: Mission } {
  if (!EXECUTION_CONTROL_INVARIANTS.AGENTS_CANNOT_RAISE_BUDGETS) {
    return { ok: false, code: "agents_cannot_raise_budgets", reason: "invariant_broken" };
  }
  if (/^(agent|bot|prime|system|auto|cursor|ci|scout|builder|verifier)\b/i.test(input.actor)) {
    return {
      ok: false,
      code: "agents_cannot_raise_budgets",
      reason: "agents_cannot_raise_budgets",
    };
  }
  if (input.actorRole !== "owner" && input.actorRole !== "support") {
    return { ok: false, code: "owner_required", reason: "owner_required" };
  }

  const m = getMission(input.missionId);
  if (!m) return { ok: false, code: "mission_not_found", reason: "mission_not_found" };

  const budgets = { ...m.budgets, ...input.patch };
  // An owner raise must still produce a finite, non-negative budget: Infinity
  // would make checkExhausted unreachable and persists as null.
  const valid = validateMissionBudgets(budgets);
  if (!valid.ok) {
    return { ok: false, code: "budget_invalid", reason: valid.error };
  }
  // Only allow increases
  for (const key of Object.keys(input.patch) as (keyof Mission["budgets"])[]) {
    const next = input.patch[key];
    if (typeof next === "number" && next < m.budgets[key]) {
      return {
        ok: false,
        code: "owner_required",
        reason: "budget_decrease_forbidden",
      };
    }
  }

  const updated = updateMission(m.id, { budgets })!;
  auditLog("prime.budget_raised", {
    tenant_id: m.tenantSlug,
    actor_user_id: input.actor,
    target_ref: `mission/${m.id}`,
    patch: input.patch,
    budgets,
  });
  return { ok: true, mission: updated, usage: updated.usage, budgets: updated.budgets };
}
