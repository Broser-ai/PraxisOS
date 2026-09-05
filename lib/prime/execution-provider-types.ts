/**
 * PraxisOS · ExecutionProvider contract (sandbox-only Session B)
 *
 * Fail-closed readiness types. No SDK calls, no secret values, no execution.
 * Defaults are never live_ready. Live always requires human approval.
 */

export const EXECUTION_PROVIDER_KINDS = [
  "cursor",
  "vscode_copilot",
  "openai",
  "anthropic",
  "langgraph",
  "huggingface",
  "roboflow",
  "heygen",
  "tinker",
  "inkling",
  "mock",
] as const;

export type ExecutionProviderKind = (typeof EXECUTION_PROVIDER_KINDS)[number];

export const EXECUTION_PROVIDER_STATUSES = [
  "unconfigured",
  "disabled",
  "sandbox_ready",
  "live_ready",
  "unavailable",
  "blocked",
] as const;

export type ExecutionProviderStatus =
  (typeof EXECUTION_PROVIDER_STATUSES)[number];

export const EXECUTION_PROVIDER_CAPABILITIES = [
  "code_execution",
  "research",
  "llm_reasoning",
  "vision",
  "avatar",
  "workflow_orchestration",
] as const;

export type ExecutionProviderCapability =
  (typeof EXECUTION_PROVIDER_CAPABILITIES)[number];

/** Request / mission scopes that affect gate decisions. */
export type ExecutionProviderScope =
  | "sandbox"
  | "live"
  | "ops"
  | "research"
  | "patient"
  | "clinical";

/**
 * Static registry descriptor. `status` is the declared default —
 * MUST NOT be `live_ready` for any provider.
 */
export type ExecutionProviderDescriptor = {
  kind: ExecutionProviderKind;
  displayName: string;
  capabilities: readonly ExecutionProviderCapability[];
  /** Declared default — unconfigured | disabled only (mock may declare sandbox_ready). */
  status: ExecutionProviderStatus;
  /** Soft enable flag; false ⇒ blocked as disabled. */
  enabled: boolean;
  /**
   * process.env KEY NAMES only. Callers may check existence (boolean);
   * never read/print values into logs or decisions beyond boolean presence.
   */
  configEnvKeys: readonly string[];
  /** Whether a local adapter module is known / declared present. */
  adapterPresent: boolean;
  /** Required for autonomous-ready (with supportsCancel). */
  supportsCallback: boolean;
  /** Required for autonomous-ready (with supportsCallback). */
  supportsCancel: boolean;
};

/**
 * Optional evidence overlays. Worktree/branch alone must NEVER promote Cursor
 * (or any non-mock provider) to sandbox_ready.
 */
export type ExecutionProviderEvidence = {
  worktreePresent?: boolean;
  branchPresent?: boolean;
  /** Override boolean config presence (tests). Never pass secret values. */
  configurationPresent?: boolean;
  adapterPresent?: boolean;
  enabled?: boolean;
  /** Inventory claim — still fail-closed; cannot invent live_ready as default. */
  claimedStatus?: ExecutionProviderStatus;
};

export type ExecutionProviderGateInput = {
  /** May be unknown / typo — unknown ⇒ blocked. */
  kind: string;
  scope: ExecutionProviderScope | string;
  evidence?: ExecutionProviderEvidence;
};

export type ExecutionProviderGateResult = {
  kind: ExecutionProviderKind | "unknown";
  status: ExecutionProviderStatus;
  blocked: boolean;
  allowed: boolean;
  reason: string;
  /** Always true for live scope or live_ready status. */
  requiresHumanApproval: boolean;
  /**
   * True only when not blocked, sandbox_ready, and both callback + cancel
   * hooks exist. Missing either ⇒ not autonomous-ready.
   */
  autonomousReady: boolean;
  configurationPresent: boolean;
  adapterPresent: boolean;
};

/** Hard invariants for this contract (documentation + test anchors). */
export const EXECUTION_PROVIDER_INVARIANTS = {
  NEVER_DEFAULT_LIVE_READY: true,
  ONLY_MOCK_SANDBOX_WITHOUT_EVIDENCE: true,
  UNKNOWN_BLOCKED: true,
  UNCONFIGURED_DISABLED_BLOCKED: true,
  PATIENT_CLINICAL_BLOCKED: true,
  LIVE_REQUIRES_HUMAN_APPROVAL: true,
  NO_SECRET_VALUES: true,
  NO_SDK_EXECUTION: true,
  WORKTREE_BRANCH_NOT_SUFFICIENT: true,
  CALLBACK_AND_CANCEL_REQUIRED_FOR_AUTONOMOUS: true,
} as const;
