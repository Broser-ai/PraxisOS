// PraxisOS · S-H Swarm types
// S-agents = software/system agents (code, research, improve)
// H-agents = humanized clinical personas (Aria, Niels, … via LangGraph)

export type SwarmAgentKind = "S" | "H";

export type SAgentId =
  | "ARIA_META"
  | "ATLAS_CODE"
  | "LUNA_RESEARCH"
  | "FELIX_IMPROVE"
  | "FREJ_GATE"
  | "PRIME_RL";

export type SwarmTaskType =
  | "research"
  | "code"
  | "improve"
  | "clinical_h"
  | "audit"
  | "worktree_exec"
  | "rl_eval";

export type SwarmTaskStatus =
  | "queued"
  | "running"
  | "awaiting_human"
  | "completed"
  | "failed"
  | "rejected";

export type SwarmTask = {
  id: string;
  type: SwarmTaskType;
  title: string;
  brief: string;
  tenantSlug: string;
  priority: 1 | 2 | 3;
  assignedTo: SAgentId | "H_BRIDGE";
  status: SwarmTaskStatus;
  createdAt: string;
  updatedAt: string;
  worktreePath?: string;
  branchName?: string;
  resultSummary?: string;
  artifacts?: string[];
  /** Merge/deploy NEVER automatic — human must approve */
  humanApprovalRequired: boolean;
  approvedBy?: string;
  approvedAt?: string;
  error?: string;
};

export type JournalEntry = {
  id: string;
  at: string;
  agent: SAgentId | "H_BRIDGE" | "SYSTEM";
  kind: "thought" | "action" | "result" | "gate" | "learning";
  taskId?: string;
  content: string;
  meta?: Record<string, unknown>;
};

/** Documented agent roles for S-H + Prime + Autonom stack */
export const SWARM_AGENT_ROLES = {
  ARIA_META: "Meta-harness router · enqueue/execute · never auto-merge",
  ATLAS_CODE: "S-agent · savage worktree plans (human PR gate)",
  LUNA_RESEARCH: "S-agent · Alphaxiv harvest (citations only)",
  FELIX_IMPROVE: "S-agent · measurable self-improve proposals",
  FREJ_GATE: "S-agent · compliance gate before human approve",
  PRIME_RL: "S-agent · RLVR quiz rewards + policy suggestions (class_0)",
  H_BRIDGE: "H-agent bridge · clinic personas via LangGraph (ops pulse)",
  AUTONOM: "Daemon · recurring agenda ticks (NO_AUTO_MERGE/DEPLOY)",
} as const;

export type WorktreeJob = {
  taskId: string;
  branchName: string;
  path: string;
  createdAt: string;
  status: "active" | "ready_for_review" | "merged" | "discarded";
};

/** Hard safety invariants for the swarm — never override in code paths. */
export const SWARM_INVARIANTS = {
  /** Never auto-merge to main/production branches */
  NO_AUTO_MERGE: true,
  /** Never auto-deploy to Vercel production */
  NO_AUTO_DEPLOY: true,
  /** Max parallel worktrees */
  MAX_WORKTREES: 4,
  /** Max task steps before forced FINISH */
  MAX_TASK_STEPS: 12,
  /** Worktree root (gitignored) */
  WORKTREE_ROOT: ".worktrees",
  /** Branch prefix must match cloud policy */
  BRANCH_PREFIX: "cursor/swarm-",
  BRANCH_SUFFIX: "-2c11",
} as const;
