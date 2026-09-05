// BudgetGuard — hard-stop for mission-scoped LLM / agent runs.
// Agents cannot raise budgets; missing provider usage → estimate (never 0).
// Finite budgets only — NaN / Infinity / null fail closed.

import { auditLog } from "@/lib/audit";
import {
  getMission,
  getMissionRun,
  listWorkstreams,
  updateMission,
  updateMissionRun,
  createMissionRun,
} from "@/lib/prime/mission-store";
import type {
  Mission,
  MissionAgentRun,
  MissionBudgets,
  MissionRole,
  TokenUsageRecord,
} from "@/lib/prime/mission-types";
import { EXECUTION_CONTROL_INVARIANTS } from "@/lib/prime/mission-types";

/** Machine-readable limit kind (discriminated from generic budget_exhausted). */
export type BudgetLimitKind =
  | "budget_exhausted"
  | "token_limit_reached"
  | "tool_call_limit_reached"
  | "runtime_limit_reached"
  | "concurrency_limit_reached"
  | "invalid_budget"
  | "reservation_required"
  | "run_already_finished";

export type BudgetStatusCode =
  | "budget_exhausted"
  | "token_limit_reached"
  | "tool_call_limit_reached"
  | "runtime_limit_reached"
  | "concurrency_limit_reached"
  | "invalid_budget"
  | "reservation_required"
  | "run_already_finished"
  | "mission_not_found"
  | "mission_not_running"
  | "agents_cannot_raise_budgets"
  | "owner_required"
  | "run_not_found";

export type BudgetStatusReport = {
  ok: boolean;
  code?: BudgetStatusCode;
  /** Specific limit when stopped by a budget gate. */
  limit?: BudgetLimitKind;
  reason?: string;
  exhausted?: Array<keyof Mission["budgets"]>;
  usage?: Mission["usage"];
  budgets?: Mission["budgets"];
};

const ACTIVE_PARALLEL_STATUSES = new Set([
  "queued",
  "running",
  "ready_for_review",
  "awaiting_human",
  "awaiting_verification",
  "blocked",
]);

/** True for any BudgetGuard stop that must halt further agent work. */
export function isBudgetStop(report: BudgetStatusReport): boolean {
  if (report.ok) return false;
  switch (report.code) {
    case "budget_exhausted":
    case "token_limit_reached":
    case "tool_call_limit_reached":
    case "runtime_limit_reached":
    case "concurrency_limit_reached":
      return true;
    case "invalid_budget":
    case "reservation_required":
    case "run_already_finished":
    case "mission_not_found":
    case "mission_not_running":
    case "agents_cannot_raise_budgets":
    case "owner_required":
    case "run_not_found":
    case undefined:
      return false;
    default: {
      const _exhaustive: never = report.code;
      return _exhaustive;
    }
  }
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Finite, non-negative number (rejects NaN / Infinity / null / undefined). */
export function isFiniteNonNegative(n: unknown): n is number {
  return isFiniteNumber(n) && n >= 0;
}

/**
 * Sanitize mission budgets after hydrate/patch.
 * Invalid values fail closed (returns null) — never coerce Infinity to a huge number.
 */
export function sanitizeMissionBudgets(
  budgets: MissionBudgets | null | undefined,
): MissionBudgets | null {
  if (!budgets || typeof budgets !== "object") return null;
  const keys: (keyof MissionBudgets)[] = [
    "maxTotalTokens",
    "maxTokensPerRun",
    "maxToolCallsPerRun",
    "maxRuntimeMinutes",
    "maxAgents",
    "maxChangedFiles",
    "maxReworkLoops",
    "reservedTokens",
    "maxParallelWorkstreams",
  ];
  const out = { ...budgets };
  for (const key of keys) {
    const v = out[key];
    if (!isFiniteNonNegative(v)) return null;
    // Store as safe finite numbers (ceil token-like fields to integers).
    if (
      key === "maxTotalTokens" ||
      key === "maxTokensPerRun" ||
      key === "maxToolCallsPerRun" ||
      key === "reservedTokens"
    ) {
      out[key] = Math.floor(v);
    } else {
      out[key] = v;
    }
  }
  if (out.maxAgents < 1) return null;
  if (out.maxParallelWorkstreams < 1) return null;
  if (out.maxRuntimeMinutes < 1) return null;
  return out;
}

function limitForExhausted(
  exhausted: Array<keyof Mission["budgets"]>,
): { code: BudgetStatusCode; limit: BudgetLimitKind } {
  if (
    exhausted.includes("maxTokensPerRun") ||
    exhausted.includes("maxTotalTokens")
  ) {
    if (
      exhausted.includes("maxTokensPerRun") &&
      !exhausted.includes("maxTotalTokens")
    ) {
      return { code: "token_limit_reached", limit: "token_limit_reached" };
    }
    if (
      exhausted.includes("maxTotalTokens") &&
      !exhausted.includes("maxTokensPerRun")
    ) {
      return { code: "budget_exhausted", limit: "budget_exhausted" };
    }
    return { code: "token_limit_reached", limit: "token_limit_reached" };
  }
  if (exhausted.includes("maxToolCallsPerRun")) {
    return { code: "tool_call_limit_reached", limit: "tool_call_limit_reached" };
  }
  if (exhausted.includes("maxRuntimeMinutes")) {
    return { code: "runtime_limit_reached", limit: "runtime_limit_reached" };
  }
  if (
    exhausted.includes("maxAgents") ||
    exhausted.includes("maxParallelWorkstreams")
  ) {
    return {
      code: "concurrency_limit_reached",
      limit: "concurrency_limit_reached",
    };
  }
  return { code: "budget_exhausted", limit: "budget_exhausted" };
}

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
  const toolCalls = isFiniteNonNegative(input.toolCallCount)
    ? input.toolCallCount
    : 0;
  const base = Math.ceil((msgChars + outChars) / 4);
  const toolOverhead = toolCalls * 120;
  const estimated = base + toolOverhead + 64; // floor overhead so empty call ≠ 0
  return Math.max(64, estimated);
}

export function extractProviderUsage(raw: unknown): TokenUsageRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const usage = (raw as { usage?: Record<string, unknown> }).usage;
  if (!usage || typeof usage !== "object") return null;
  const promptRaw = usage.prompt_tokens ?? usage.input_tokens;
  const completionRaw = usage.completion_tokens ?? usage.output_tokens;
  const totalRaw = usage.total_tokens;

  const prompt = promptRaw === undefined ? 0 : Number(promptRaw);
  const completion = completionRaw === undefined ? 0 : Number(completionRaw);
  const total =
    totalRaw === undefined ? prompt + completion : Number(totalRaw);

  // Missing / zero / non-finite usage → null (caller must estimate — never treat as 0).
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) return null;
  if (prompt < 0 || completion < 0) return null;

  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total,
    estimated: false,
    reservedTokens: 0,
  };
}

function checkExhausted(
  m: Mission,
  pending: {
    reserveTokens?: number;
    toolCalls?: number;
    changedFilesDelta?: number;
    reworkDelta?: number;
    agentsDelta?: number;
    runtimeDelta?: number;
    parallelDelta?: number;
  },
): Array<keyof Mission["budgets"]> {
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
  if (u.runtimeMinutes + (pending.runtimeDelta ?? 0) >= b.maxRuntimeMinutes) {
    if (
      u.runtimeMinutes >= b.maxRuntimeMinutes ||
      (pending.runtimeDelta ?? 0) > 0
    ) {
      exhausted.push("maxRuntimeMinutes");
    }
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
  if (pending.parallelDelta !== undefined) {
    const active =
      listWorkstreams({ missionId: m.id }).filter((w) =>
        ACTIVE_PARALLEL_STATUSES.has(w.status),
      ).length + pending.parallelDelta;
    if (active > b.maxParallelWorkstreams) {
      exhausted.push("maxParallelWorkstreams");
    }
  }
  return exhausted;
}

function markBudgetExhausted(
  m: Mission,
  exhausted: Array<keyof Mission["budgets"]>,
): void {
  updateMission(m.id, { status: "budget_exhausted" });
  auditLog("prime.budget_exhausted", {
    tenant_id: m.tenantSlug,
    target_ref: `mission/${m.id}`,
    exhausted,
    usage: m.usage,
  });
}

function exhaustionReport(
  m: Mission,
  exhausted: Array<keyof Mission["budgets"]>,
): BudgetStatusReport {
  const { limit } = limitForExhausted(exhausted);
  // Always surface code=budget_exhausted for mission stops so existing dispatcher
  // paths remain compatible; `limit` carries the specific machine-readable cause.
  return {
    ok: false,
    code: "budget_exhausted",
    limit,
    reason: `${limit}:${exhausted.join(",")}`,
    exhausted,
    usage: m.usage,
    budgets: m.budgets,
  };
}

function budgetsOrFail(m: Mission): BudgetStatusReport | { ok: true; budgets: MissionBudgets } {
  const budgets = sanitizeMissionBudgets(m.budgets);
  if (!budgets) {
    return {
      ok: false,
      code: "invalid_budget",
      limit: "invalid_budget",
      reason: "budgets_not_finite",
      usage: m.usage,
      budgets: m.budgets,
    };
  }
  // Persist sanitized finite values so hydrate/persist never keep Infinity/NaN.
  if (
    budgets.maxTotalTokens !== m.budgets.maxTotalTokens ||
    budgets.maxTokensPerRun !== m.budgets.maxTokensPerRun ||
    budgets.maxToolCallsPerRun !== m.budgets.maxToolCallsPerRun ||
    budgets.maxRuntimeMinutes !== m.budgets.maxRuntimeMinutes ||
    budgets.maxAgents !== m.budgets.maxAgents ||
    budgets.maxParallelWorkstreams !== m.budgets.maxParallelWorkstreams
  ) {
    updateMission(m.id, { budgets });
  }
  return { ok: true, budgets };
}

/**
 * Reserve tokens before an LLM call. Fails closed on exhaustion / invalid budgets.
 * A run cannot start without a successful reservation.
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

  // Never continue after budget exhaustion / cancel / complete.
  if (m.status === "budget_exhausted") {
    return {
      ok: false,
      code: "budget_exhausted",
      limit: "budget_exhausted",
      reason: "mission_budget_exhausted",
      usage: m.usage,
      budgets: m.budgets,
    };
  }
  if (m.status !== "running" && m.status !== "approved") {
    return {
      ok: false,
      code: "mission_not_running",
      reason: `mission_status_${m.status}`,
      usage: m.usage,
      budgets: m.budgets,
    };
  }

  const budgetGate = budgetsOrFail(m);
  if (!budgetGate.ok) return budgetGate;
  // Use freshly sanitized budgets on mission
  const mission = getMission(m.id)!;

  if (!isFiniteNonNegative(input.estimatedTokens)) {
    return {
      ok: false,
      code: "invalid_budget",
      limit: "invalid_budget",
      reason: "estimatedTokens_not_finite",
      usage: mission.usage,
      budgets: mission.budgets,
    };
  }

  const reservation = Math.max(64, Math.ceil(input.estimatedTokens));
  if (!Number.isFinite(reservation)) {
    return {
      ok: false,
      code: "invalid_budget",
      limit: "invalid_budget",
      reason: "reservation_not_finite",
      usage: mission.usage,
      budgets: mission.budgets,
    };
  }

  const toolCallsSoFar = isFiniteNonNegative(input.toolCallsSoFar)
    ? input.toolCallsSoFar
    : 0;

  const exhausted = checkExhausted(mission, {
    reserveTokens: reservation,
    toolCalls: toolCallsSoFar,
    agentsDelta: 1,
  });
  if (exhausted.length) {
    markBudgetExhausted(mission, exhausted);
    return exhaustionReport(getMission(mission.id)!, exhausted);
  }

  // Soft-hold: count agent slot; tokens recorded after call
  updateMission(mission.id, {
    usage: {
      ...mission.usage,
      agents: mission.usage.agents + 1,
    },
    status: "running",
  });

  const run = createMissionRun({
    missionId: mission.id,
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
    toolCallCount: toolCallsSoFar,
    startedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    run,
    reservation,
    usage: getMission(mission.id)!.usage,
    budgets: getMission(mission.id)!.budgets,
  };
}

/**
 * Record actual (or estimated) usage after an LLM call.
 * Requires an active reservation (running MissionAgentRun). Never charges 0 for a completed call.
 * Cannot re-record / auto-restart a finished run.
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

  const run = getMissionRun(input.runId);
  if (!run) {
    return {
      ok: false,
      code: "run_not_found",
      limit: "reservation_required",
      reason: "run_not_found",
    };
  }
  if (run.missionId !== input.missionId) {
    return {
      ok: false,
      code: "reservation_required",
      limit: "reservation_required",
      reason: "run_mission_mismatch",
    };
  }
  if (run.status !== "running") {
    return {
      ok: false,
      code: "run_already_finished",
      limit: "run_already_finished",
      reason: `run_status_${run.status}`,
      usage: m.usage,
      budgets: m.budgets,
    };
  }
  if (
    !isFiniteNonNegative(run.tokenUsage.reservedTokens) ||
    run.tokenUsage.reservedTokens <= 0
  ) {
    return {
      ok: false,
      code: "reservation_required",
      limit: "reservation_required",
      reason: "missing_reservation",
      usage: m.usage,
      budgets: m.budgets,
    };
  }

  const budgetGate = budgetsOrFail(m);
  if (!budgetGate.ok) return budgetGate;

  const usageTotal = input.usage.totalTokens;
  const reserved = run.tokenUsage.reservedTokens;

  let charged: number;
  if (input.usage.estimated) {
    const raw = isFiniteNonNegative(usageTotal) ? usageTotal : 0;
    // Never assume 0 for a completed call — floor to reservation or 64.
    charged = Math.max(64, raw > 0 ? raw : reserved || 64);
  } else {
    if (!isFiniteNonNegative(usageTotal) || usageTotal <= 0) {
      // Provider claimed non-estimated but gave invalid/zero — estimate conservatively.
      charged = Math.max(64, reserved || 64);
      input = {
        ...input,
        usage: { ...input.usage, estimated: true, totalTokens: charged },
      };
    } else {
      charged = usageTotal;
    }
  }

  if (!Number.isFinite(charged) || charged <= 0) {
    charged = Math.max(64, reserved || 64);
  }

  const runtimeDelta = isFiniteNonNegative(input.runtimeMinutesDelta)
    ? input.runtimeMinutesDelta
    : 0;
  const toolDelta = isFiniteNonNegative(input.toolCallCount)
    ? input.toolCallCount
    : 0;

  // Pre-check runtime / total before charging so we don't overshoot silently without stop.
  const preExhausted = checkExhausted(m, {
    reserveTokens: charged,
    runtimeDelta,
    toolCalls: toolDelta,
  });
  // Allow charge then mark exhausted if this call tips over total — still record usage.
  const nextUsage = {
    ...m.usage,
    totalTokens: m.usage.totalTokens + charged,
    estimatedTokens:
      m.usage.estimatedTokens + (input.usage.estimated ? charged : 0),
    recordedTokens:
      m.usage.recordedTokens + (input.usage.estimated ? 0 : charged),
    toolCalls: m.usage.toolCalls + toolDelta,
    runtimeMinutes: m.usage.runtimeMinutes + runtimeDelta,
    // reserveBudget claims a slot. Only a run that still holds one may return it,
    // otherwise a second finalisation frees a concurrent run's slot instead.
    agents: run.status === "running"
      ? Math.max(0, m.usage.agents - 1)
      : m.usage.agents,
  };

  updateMission(m.id, { usage: nextUsage });
  updateMissionRun(input.runId, {
    status: "completed",
    tokenUsage: {
      ...input.usage,
      totalTokens: charged,
      reservedTokens: reserved,
      estimated: input.usage.estimated || charged !== usageTotal,
    },
    toolCallCount: toolDelta,
    finishedAt: new Date().toISOString(),
  });

  const refreshed = getMission(input.missionId)!;
  const exhausted = [
    ...new Set([...preExhausted, ...checkExhausted(refreshed, {})]),
  ];
  if (exhausted.length) {
    markBudgetExhausted(refreshed, exhausted);
    // Mark run budget_exhausted when the charge itself exhausted the mission.
    updateMissionRun(input.runId, { status: "budget_exhausted" });
    return exhaustionReport(getMission(input.missionId)!, exhausted);
  }
  return { ok: true, usage: refreshed.usage, budgets: refreshed.budgets };
}

/**
 * Release a reservation for a run that never completed — provider error, crash
 * or cancelled lease. Without this the agent slot claimed by reserveBudget is
 * never returned.
 */
export function releaseBudgetReservation(input: {
  missionId: string;
  runId: string;
  reason: string;
}): BudgetStatusReport {
  const m = getMission(input.missionId);
  if (!m)
    return {
      ok: false,
      code: "mission_not_found",
      reason: "mission_not_found",
    };
  const run = getMissionRun(input.runId);
  if (!run)
    return { ok: false, code: "run_not_found", reason: "run_not_found" };

  // Only release a slot the run still holds — releasing twice would free a
  // concurrent run's slot.
  const holdsSlot = run.status === "running";
  if (holdsSlot) {
    updateMission(m.id, {
      usage: { ...m.usage, agents: Math.max(0, m.usage.agents - 1) },
    });
    updateMissionRun(input.runId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
    });
  }
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
  if (m.status === "budget_exhausted") {
    return {
      ok: false,
      code: "budget_exhausted",
      limit: "budget_exhausted",
      reason: "mission_budget_exhausted",
      usage: m.usage,
      budgets: m.budgets,
    };
  }
  const budgetGate = budgetsOrFail(m);
  if (!budgetGate.ok) return budgetGate;

  if (!isFiniteNonNegative(input.toolCallsThisRun)) {
    return {
      ok: false,
      code: "invalid_budget",
      limit: "invalid_budget",
      reason: "toolCalls_not_finite",
      usage: m.usage,
      budgets: m.budgets,
    };
  }

  // Stop after exact limit: allowed while <= max; > max exhausts.
  if (input.toolCallsThisRun > m.budgets.maxToolCallsPerRun) {
    markBudgetExhausted(m, ["maxToolCallsPerRun"]);
    return {
      ok: false,
      code: "tool_call_limit_reached",
      limit: "tool_call_limit_reached",
      reason: "tool_call_limit_reached:maxToolCallsPerRun",
      exhausted: ["maxToolCallsPerRun"],
      usage: m.usage,
      budgets: m.budgets,
    };
  }
  return { ok: true, usage: m.usage, budgets: m.budgets };
}

/**
 * Runtime gate — stop when cumulative runtime reaches maxRuntimeMinutes.
 */
export function assertRuntimeBudget(input: {
  missionId: string;
  runtimeMinutesDelta?: number;
}): BudgetStatusReport {
  const m = getMission(input.missionId);
  if (!m) return { ok: false, code: "mission_not_found", reason: "mission_not_found" };
  if (m.status === "budget_exhausted") {
    return {
      ok: false,
      code: "budget_exhausted",
      limit: "budget_exhausted",
      reason: "mission_budget_exhausted",
      usage: m.usage,
      budgets: m.budgets,
    };
  }
  const budgetGate = budgetsOrFail(m);
  if (!budgetGate.ok) return budgetGate;

  const delta = isFiniteNonNegative(input.runtimeMinutesDelta)
    ? input.runtimeMinutesDelta
    : 0;
  const next = m.usage.runtimeMinutes + delta;
  if (next >= m.budgets.maxRuntimeMinutes) {
    if (delta > 0) {
      updateMission(m.id, {
        usage: { ...m.usage, runtimeMinutes: next },
      });
    }
    const refreshed = getMission(m.id)!;
    markBudgetExhausted(refreshed, ["maxRuntimeMinutes"]);
    return {
      ok: false,
      code: "runtime_limit_reached",
      limit: "runtime_limit_reached",
      reason: "runtime_limit_reached:maxRuntimeMinutes",
      exhausted: ["maxRuntimeMinutes"],
      usage: getMission(m.id)!.usage,
      budgets: m.budgets,
    };
  }
  if (delta > 0) {
    updateMission(m.id, {
      usage: { ...m.usage, runtimeMinutes: next },
    });
  }
  return {
    ok: true,
    usage: getMission(m.id)!.usage,
    budgets: m.budgets,
  };
}

/**
 * Concurrency gate for parallel workstreams (uses workstream store state).
 */
export function assertParallelWorkstreamBudget(input: {
  missionId: string;
  additional?: number;
}): BudgetStatusReport {
  const m = getMission(input.missionId);
  if (!m) return { ok: false, code: "mission_not_found", reason: "mission_not_found" };
  const budgetGate = budgetsOrFail(m);
  if (!budgetGate.ok) return budgetGate;

  const additional = isFiniteNonNegative(input.additional) ? input.additional : 0;
  const exhausted = checkExhausted(m, { parallelDelta: additional });
  if (exhausted.includes("maxParallelWorkstreams")) {
    return {
      ok: false,
      code: "concurrency_limit_reached",
      limit: "concurrency_limit_reached",
      reason: "concurrency_limit_reached:maxParallelWorkstreams",
      exhausted: ["maxParallelWorkstreams"],
      usage: m.usage,
      budgets: m.budgets,
    };
  }
  return { ok: true, usage: m.usage, budgets: m.budgets };
}

export function recordChangedFiles(
  missionId: string,
  count: number,
): BudgetStatusReport {
  const m = getMission(missionId);
  if (!m) return { ok: false, code: "mission_not_found", reason: "mission_not_found" };
  if (!isFiniteNonNegative(count)) {
    return {
      ok: false,
      code: "invalid_budget",
      limit: "invalid_budget",
      reason: "changedFiles_not_finite",
    };
  }
  const next = { ...m.usage, changedFiles: m.usage.changedFiles + count };
  updateMission(m.id, { usage: next });
  const refreshed = getMission(m.id)!;
  const exhausted = checkExhausted(refreshed, {});
  if (exhausted.includes("maxChangedFiles")) {
    markBudgetExhausted(refreshed, ["maxChangedFiles"]);
    return exhaustionReport(getMission(m.id)!, ["maxChangedFiles"]);
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
    return exhaustionReport(getMission(m.id)!, ["maxReworkLoops"]);
  }
  return { ok: true, usage: refreshed.usage, budgets: refreshed.budgets };
}

/**
 * Owner-only budget raise. Agents always rejected.
 * Rejects non-finite / negative patch values.
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

  for (const key of Object.keys(input.patch) as (keyof Mission["budgets"])[]) {
    const next = input.patch[key];
    if (next === undefined) continue;
    if (!isFiniteNonNegative(next)) {
      return {
        ok: false,
        code: "invalid_budget",
        limit: "invalid_budget",
        reason: `budget_patch_not_finite:${key}`,
      };
    }
    if (next < m.budgets[key]) {
      return {
        ok: false,
        code: "owner_required",
        reason: "budget_decrease_forbidden",
      };
    }
  }

  const budgets = sanitizeMissionBudgets({ ...m.budgets, ...input.patch });
  if (!budgets) {
    return {
      ok: false,
      code: "invalid_budget",
      limit: "invalid_budget",
      reason: "budgets_not_finite_after_patch",
    };
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
