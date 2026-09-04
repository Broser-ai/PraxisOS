// Mission domain validation — foundation gates for Mission / Workstream / AgentRun.

import {
  DEFAULT_MISSION_BUDGETS,
  type AgentRole,
  type AgentRunStatus,
  type MissionBudgets,
  type MissionStatus,
  type RiskLevel,
  type WorkstreamStatus,
} from "@/lib/prime/mission-types";

export type DomainValidationError = {
  ok: false;
  error: string;
  field?: string;
};

export type DomainValidationOk = { ok: true };

const RISK_LEVELS: readonly RiskLevel[] = ["green", "yellow", "red"];

const AGENT_ROLES: readonly AgentRole[] = [
  "prime_commander",
  "scout",
  "builder",
  "verifier",
  "reviewer",
  "release_steward",
];

const AGENT_RUN_STATUSES: readonly AgentRunStatus[] = [
  "queued",
  "running",
  "completed",
  "failed",
  "budget_exhausted",
];

const MISSION_STATUSES: readonly MissionStatus[] = [
  "draft",
  "approved",
  "running",
  "paused",
  "cancelled",
  "completed",
  "budget_exhausted",
];

const WORKSTREAM_STATUSES: readonly WorkstreamStatus[] = [
  "queued",
  "running",
  "blocked",
  "awaiting_human",
  "awaiting_verification",
  "ready_for_review",
  "approved_for_merge",
  "done",
  "failed",
  "cancelled",
  "budget_exhausted",
];

function isRiskLevel(v: unknown): v is RiskLevel {
  return typeof v === "string" && (RISK_LEVELS as readonly string[]).includes(v);
}

function isAgentRole(v: unknown): v is AgentRole {
  return typeof v === "string" && (AGENT_ROLES as readonly string[]).includes(v);
}

function isAgentRunStatus(v: unknown): v is AgentRunStatus {
  return (
    typeof v === "string" && (AGENT_RUN_STATUSES as readonly string[]).includes(v)
  );
}

export function isMissionStatus(v: unknown): v is MissionStatus {
  return (
    typeof v === "string" && (MISSION_STATUSES as readonly string[]).includes(v)
  );
}

export function isWorkstreamStatus(v: unknown): v is WorkstreamStatus {
  return (
    typeof v === "string" &&
    (WORKSTREAM_STATUSES as readonly string[]).includes(v)
  );
}

export { isAgentRole, isAgentRunStatus };

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/** Reject negative budget numbers; maxAgents / maxParallelWorkstreams ≥ 1. */
export function validateMissionBudgets(
  budgets: Partial<MissionBudgets> | undefined,
): DomainValidationOk | DomainValidationError {
  const merged: MissionBudgets = { ...DEFAULT_MISSION_BUDGETS, ...budgets };
  const numericKeys: (keyof MissionBudgets)[] = [
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
  for (const key of numericKeys) {
    const n = merged[key];
    // Number.isFinite also rejects Infinity: an infinite budget makes the
    // exhaustion check in budget-guard unreachable, and JSON.stringify turns it
    // into null on persist, which then flips it to instant exhaustion.
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
      return { ok: false, error: "budget_negative_or_invalid", field: key };
    }
  }
  if (merged.maxAgents < 1) {
    return { ok: false, error: "maxAgents_min_1", field: "maxAgents" };
  }
  if (merged.maxParallelWorkstreams < 1) {
    return {
      ok: false,
      error: "maxParallelWorkstreams_min_1",
      field: "maxParallelWorkstreams",
    };
  }
  return { ok: true };
}

export function validateCreateMissionInput(input: {
  title?: string;
  objective?: string;
  goal?: string;
  riskLevel?: RiskLevel;
  budgets?: Partial<MissionBudgets>;
  acceptanceCriteria?: { text: string }[];
}): DomainValidationOk | DomainValidationError {
  if (!nonEmpty(input.title)) {
    return { ok: false, error: "title_required", field: "title" };
  }
  const objective = input.objective ?? input.goal;
  if (!nonEmpty(objective)) {
    return { ok: false, error: "objective_required", field: "objective" };
  }
  if (input.riskLevel !== undefined && !isRiskLevel(input.riskLevel)) {
    return { ok: false, error: "riskLevel_invalid", field: "riskLevel" };
  }
  if (input.riskLevel === undefined) {
    return { ok: false, error: "riskLevel_required", field: "riskLevel" };
  }
  const budgetCheck = validateMissionBudgets(input.budgets);
  if (!budgetCheck.ok) return budgetCheck;
  if (!input.budgets) {
    return { ok: false, error: "budgets_required", field: "budgets" };
  }
  const criteria = input.acceptanceCriteria ?? [];
  if (criteria.length < 1 || !criteria.some((c) => nonEmpty(c.text))) {
    return {
      ok: false,
      error: "acceptance_criterion_required",
      field: "acceptanceCriteria",
    };
  }
  return { ok: true };
}

export function validateCreateWorkstreamInput(input: {
  missionId?: string;
  title?: string;
  objective?: string;
  assignedRole?: AgentRole;
  role?: AgentRole;
}): DomainValidationOk | DomainValidationError {
  if (!nonEmpty(input.missionId)) {
    return { ok: false, error: "missionId_required", field: "missionId" };
  }
  if (!nonEmpty(input.title)) {
    return { ok: false, error: "title_required", field: "title" };
  }
  if (!nonEmpty(input.objective)) {
    return { ok: false, error: "objective_required", field: "objective" };
  }
  const role = input.assignedRole ?? input.role;
  if (!isAgentRole(role)) {
    return { ok: false, error: "assignedRole_required", field: "assignedRole" };
  }
  return { ok: true };
}

export function validateCreateAgentRunInput(input: {
  missionId?: string;
  role?: AgentRole;
  status?: AgentRunStatus;
}): DomainValidationOk | DomainValidationError {
  if (!nonEmpty(input.missionId)) {
    return { ok: false, error: "missionId_required", field: "missionId" };
  }
  if (!isAgentRole(input.role)) {
    return { ok: false, error: "role_invalid", field: "role" };
  }
  if (!isAgentRunStatus(input.status)) {
    return { ok: false, error: "status_invalid", field: "status" };
  }
  return { ok: true };
}
