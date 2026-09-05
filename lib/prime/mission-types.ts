// PraxisOS · Prime Execution Control — mission domain types
// Extends swarm/prime invariants; never auto-merge/deploy/train.

import { SWARM_INVARIANTS } from "@/lib/swarm/types";
import { PRIME_INVARIANTS } from "@/lib/prime/types";
import { CLINICAL_POLICY } from "@/lib/swarm/clinical-policy";

export type RiskLevel = "green" | "yellow" | "red";

export type MissionStatus =
  | "draft"
  | "approved"
  | "running"
  | "paused"
  | "cancelled"
  | "completed"
  | "budget_exhausted";

export type WorkstreamStatus =
  | "queued"
  | "running"
  | "blocked"
  | "awaiting_human"
  | "awaiting_verification"
  | "ready_for_review"
  | "approved_for_merge"
  | "done"
  | "failed"
  | "cancelled"
  | "budget_exhausted";

export type MissionRole =
  | "prime_commander"
  | "scout"
  | "builder"
  | "verifier"
  | "reviewer"
  | "release_steward";

/** Alias used by the mission-domain foundation API (PEC). */
export type AgentRole = MissionRole;

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "budget_exhausted";

/** Platform surfaces a mission may touch (policy scoping). */
export type PlatformScope =
  | "clinic_ops"
  | "agent_runtime"
  | "auth_journal"
  | "swarm"
  | "prime"
  | "docs"
  | "infra";

export type AcceptanceCriterion = {
  id: string;
  text: string;
  /** Evidence status — DoD requires at least one `pass` with evidence ref */
  status: "pending" | "pass" | "fail" | "not_verified";
  evidenceIds?: string[];
};

export type MissionBudgets = {
  maxTotalTokens: number;
  maxTokensPerRun: number;
  maxToolCallsPerRun: number;
  maxRuntimeMinutes: number;
  maxAgents: number;
  maxChangedFiles: number;
  maxReworkLoops: number;
  /** Soft reserve pool held before LLM calls settle (BudgetGuard). */
  reservedTokens: number;
  /** Cap concurrent leased workstreams for this mission (default 4). */
  maxParallelWorkstreams: number;
};

export type MissionBudgetUsage = {
  totalTokens: number;
  estimatedTokens: number;
  recordedTokens: number;
  toolCalls: number;
  runtimeMinutes: number;
  agents: number;
  changedFiles: number;
  reworkLoops: number;
};

export const DEFAULT_MISSION_BUDGETS: MissionBudgets = {
  maxTotalTokens: 250_000,
  maxTokensPerRun: 32_000,
  maxToolCallsPerRun: 24,
  maxRuntimeMinutes: 90,
  maxAgents: 4,
  maxChangedFiles: 40,
  maxReworkLoops: 3,
  reservedTokens: 0,
  maxParallelWorkstreams: 4,
};

export type Mission = {
  id: string;
  tenantSlug: string;
  title: string;
  /** Mission objective (same semantic as goal; required by domain foundation). */
  goal: string;
  /** Explicit objective mirror of `goal` for Mission / Workstream / AgentRun API. */
  objective: string;
  status: MissionStatus;
  riskLevel: RiskLevel;
  /** Which product surfaces this mission may touch */
  platformScope: PlatformScope[];
  budgets: MissionBudgets;
  usage: MissionBudgetUsage;
  /** Mission-level acceptance criteria (at least one required by domain repo). */
  acceptanceCriteria: AcceptanceCriterion[];
  workstreamIds: string[];
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Human decisions / blocked reasons surfaced in admin */
  humanDecisions: HumanDecision[];
  /** Optional YAML/fixture id for seeded missions */
  fixtureId?: string;
};

export type HumanDecision = {
  id: string;
  at: string;
  kind:
    | "approve_mission"
    | "raise_budget"
    | "approve_action"
    | "reject_action"
    | "mark_approved_for_merge"
    | "pause"
    | "cancel";
  actor: string;
  detail: string;
  meta?: Record<string, unknown>;
};

export type Workstream = {
  id: string;
  missionId: string;
  tenantSlug: string;
  title: string;
  /** Workstream objective (required by domain foundation). */
  objective: string;
  status: WorkstreamStatus;
  /** Assigned agent role (= AgentRole / MissionRole). */
  role: MissionRole;
  assignedRole: MissionRole;
  allowedPaths: string[];
  forbiddenPaths: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  branchName?: string;
  worktreePath?: string;
  changedFiles: string[];
  evidenceId?: string;
  blockedReason?: string;
  agentRunIds: string[];
  reworkLoops: number;
  /** Attempt count including retries (counts toward rework budget on failure). */
  attemptCount: number;
  /** Lease so two ticks cannot claim the same workstream. */
  leaseId?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  /** ISO timestamp when the current lease was claimed (cleared on release/reclaim). */
  claimedAt?: string;
  /**
   * Fan-out dependency edges — workstream is not claimable until each id is
   * in a dep-satisfied terminal (done / awaiting_verification / ready_for_review /
   * approved_for_merge).
   */
  dependsOnWorkstreamIds?: string[];
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

/** Machine-readable dispatch / fan-out limit (no spin / busy-wait). */
export type DispatchLimitCode =
  | "max_parallel_workstreams"
  | "dependency_unsatisfied"
  | "path_conflict"
  | "lease_held"
  | "lease_expired_reclaim"
  | "rework_limit_reached"
  | "mission_not_running"
  | "workstream_not_claimable"
  | "dispatcher_tick_in_flight";

export type DispatchLimit = {
  code: DispatchLimitCode;
  reason: string;
  limit?: number;
  active?: number;
  waitingOn?: string[];
  leaseOwner?: string;
  conflictingWorkstreamId?: string;
};

/** Thin AgentRun extension for mission-scoped LLM usage. */
export type MissionAgentRun = {
  id: string;
  missionId: string;
  workstreamId?: string;
  role: MissionRole;
  status: AgentRunStatus;
  tokenUsage: TokenUsageRecord;
  toolCallCount: number;
  /** Link to clinic agent-store run when dispatcher executes via runAgent */
  agentRunId?: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
};

/** Domain foundation alias for mission-scoped agent runs. */
export type AgentRun = MissionAgentRun;

export type TokenUsageRecord = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** true when provider omitted usage and we estimated */
  estimated: boolean;
  reservedTokens: number;
};

export type EvidenceCommand = {
  command: string;
  exitCode: number;
  at: string;
  summary?: string;
};

export type EvidenceCheck =
  | { kind: "tests"; status: "pass" | "fail" | "not_run" }
  | { kind: "typecheck"; status: "pass" | "fail" | "not_run" }
  | { kind: "lint"; status: "pass" | "fail" | "not_run" }
  | { kind: "build"; status: "pass" | "fail" | "not_run" | "not_required" }
  | { kind: "security"; status: "pass" | "fail" | "not_verified" }
  | { kind: "tenant"; status: "pass" | "fail" | "not_verified" }
  | { kind: "clinical"; status: "pass" | "fail" | "not_applicable" | "not_verified" };

export type WorkstreamEvidence = {
  id: string;
  workstreamId: string;
  missionId: string;
  commits: string[];
  files: string[];
  commands: EvidenceCommand[];
  checks: EvidenceCheck[];
  acceptance: { criterionId: string; status: AcceptanceCriterion["status"] }[];
  limitations: string[];
  rollback: string;
  humanDecisions: string[];
  createdAt: string;
  updatedAt: string;
};

/** Completion evidence for a workstream (DoD / review). */
export type CompletionEvidence = WorkstreamEvidence;

/** Locked execution-control invariants (compose existing hard locks). */
export const EXECUTION_CONTROL_INVARIANTS = {
  NO_AUTO_MERGE: SWARM_INVARIANTS.NO_AUTO_MERGE,
  NO_AUTO_DEPLOY: SWARM_INVARIANTS.NO_AUTO_DEPLOY,
  NO_AUTO_JOURNAL_SIGN: CLINICAL_POLICY.NO_AUTO_JOURNAL_SIGN,
  CLINICAL_STATUS: CLINICAL_POLICY.clinical_status,
  NO_MODEL_TRAINING: PRIME_INVARIANTS.NO_MODEL_TRAINING,
  PATHOLOGY_SHADOW_UNTIL_GATES: PRIME_INVARIANTS.PATHOLOGY_SHADOW_UNTIL_GATES,
  MAX_PARALLEL_WORKSTREAMS: SWARM_INVARIANTS.MAX_WORKTREES,
  AGENTS_CANNOT_RAISE_BUDGETS: true,
  MANUAL_MERGE_ONLY: true,
} as const;

export type PolicyActionKind =
  | "write_main"
  | "merge"
  | "deploy"
  | "prod_env_secrets"
  | "clinical_policy"
  | "mdr_claim"
  | "pathology_claim"
  | "patient_claim"
  | "migration"
  | "write_path"
  | "sms_patient"
  | "journal_sign"
  | "raise_budget"
  | "mark_approved_for_merge";

export type PolicyVerdict =
  | { ok: true }
  | {
      ok: false;
      code: string;
      reason: string;
      requiresHuman: boolean;
      riskFloor?: RiskLevel;
    };
