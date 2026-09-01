// PraxisOS · Prime agent RL types
//
// Prime = RLVR (verifiable-reward) policy agent for class_0 e-learning +
// swarm self-critique. NOT a clinical tutor. NO model fine-tuning.
// Pathology / diagnosis / treatment remain suggestion-only + human-gated.

export const PRIME_ID = "prime" as const;

export type PrimeDomain =
  | "anatomy"
  | "pharmacology"
  | "procedure"
  | "compliance"
  | "ops";

/** Hard safety invariants — never override in code paths. */
export const PRIME_INVARIANTS = {
  /** Never fine-tune / PPO-train clinic LLMs from this scaffold */
  NO_MODEL_TRAINING: true,
  /** Never emit autonomous diagnosis or treatment */
  NO_AUTONOMOUS_CLINICAL: true,
  /** Pathology findings stay shadow until Broser gates + CE */
  PATHOLOGY_SHADOW_UNTIL_GATES: true,
  /** AI output is suggestions / quiz feedback only */
  AI_SUGGESTIONS_ONLY: true,
  /** Policy weight updates require human adjudication */
  HUMAN_ADJUDICATION_REQUIRED: true,
  /** Education track only — not MDR device software claim */
  CLASS_0_EDUCATION_ONLY: true,
} as const;

export type QuizItem = {
  id: string;
  domain: PrimeDomain;
  prompt: string;
  /** Exact expected answer (normalized before compare) */
  answer: string;
  /** Acceptable aliases (normalized) */
  aliases?: string[];
  explanation: string;
  /** Citations / curriculum refs — never clinical claims */
  refs?: string[];
};

export type RewardScore = {
  itemId: string;
  correct: boolean;
  reward: 0 | 1;
  given: string;
  expected: string;
  explanation: string;
};

export type PrimeLedgerKind =
  | "quiz_attempt"
  | "policy_proposal"
  | "adjudication"
  | "swarm_signal"
  | "gate";

export type PrimeLedgerEntry = {
  id: string;
  at: string;
  kind: PrimeLedgerKind;
  tenantSlug: string;
  content: string;
  meta?: Record<string, unknown>;
};

export type PolicyProposalStatus =
  | "draft"
  | "awaiting_human"
  | "approved"
  | "rejected";

export type PolicyProposal = {
  id: string;
  at: string;
  tenantSlug: string;
  title: string;
  rationale: string;
  /** Suggested weight deltas — never auto-applied to clinical routes */
  suggestedDeltas: Record<string, number>;
  status: PolicyProposalStatus;
  approvedBy?: string;
  approvedAt?: string;
  clinicalImpact: "none";
};

export type PrimeRunResult = {
  ok: boolean;
  summary: string;
  scores: RewardScore[];
  meanReward: number;
  proposals: PolicyProposal[];
  ledgerIds: string[];
  invariants: typeof PRIME_INVARIANTS;
};

/** Forbidden prompt patterns for Prime (clinical autonomy). */
export const PRIME_FORBIDDEN_INTENTS = [
  "diagnose",
  "diagnosis",
  "triage",
  "treat",
  "treatment",
  "prescribe",
  "prescription",
  "patient risk",
  "ulcus",
  "wound care plan",
  "autonomous clinical",
] as const;
