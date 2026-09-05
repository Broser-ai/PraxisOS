/**
 * PraxisOS · ExecutionProvider registry (fail-closed)
 *
 * Sandbox-only contract surface. No SDK imports, no network, no execution.
 * configurationPresent checks process.env KEY NAMES for boolean presence only —
 * never logs or returns secret values.
 */

import {
  EXECUTION_PROVIDER_INVARIANTS,
  EXECUTION_PROVIDER_KINDS,
  type ExecutionProviderDescriptor,
  type ExecutionProviderEvidence,
  type ExecutionProviderGateInput,
  type ExecutionProviderGateResult,
  type ExecutionProviderKind,
  type ExecutionProviderStatus,
} from "@/lib/prime/execution-provider-types";

void EXECUTION_PROVIDER_INVARIANTS;

const PROVIDERS: readonly ExecutionProviderDescriptor[] = [
  {
    kind: "cursor",
    displayName: "Cursor",
    capabilities: ["code_execution", "llm_reasoning"],
    status: "unconfigured",
    enabled: false,
    configEnvKeys: ["CURSOR_API_KEY"],
    adapterPresent: false,
    supportsCallback: false,
    supportsCancel: false,
  },
  {
    kind: "vscode_copilot",
    displayName: "VS Code Copilot",
    capabilities: ["code_execution", "llm_reasoning"],
    status: "unconfigured",
    enabled: false,
    configEnvKeys: ["GITHUB_COPILOT_TOKEN", "VSCODE_COPILOT_TOKEN"],
    adapterPresent: false,
    supportsCallback: false,
    supportsCancel: false,
  },
  {
    kind: "openai",
    displayName: "OpenAI",
    capabilities: ["llm_reasoning", "research"],
    status: "unconfigured",
    enabled: false,
    configEnvKeys: ["OPENAI_API_KEY"],
    adapterPresent: false,
    supportsCallback: false,
    supportsCancel: false,
  },
  {
    kind: "anthropic",
    displayName: "Anthropic",
    capabilities: ["llm_reasoning", "research"],
    status: "unconfigured",
    enabled: false,
    configEnvKeys: ["ANTHROPIC_API_KEY"],
    adapterPresent: false,
    supportsCallback: false,
    supportsCancel: false,
  },
  {
    kind: "langgraph",
    displayName: "LangGraph",
    capabilities: ["workflow_orchestration", "llm_reasoning"],
    status: "unconfigured",
    enabled: false,
    configEnvKeys: ["LANGGRAPH_API_KEY", "LANGCHAIN_API_KEY"],
    adapterPresent: false,
    supportsCallback: false,
    supportsCancel: false,
  },
  {
    kind: "huggingface",
    displayName: "Hugging Face",
    capabilities: ["llm_reasoning", "research", "vision"],
    status: "unconfigured",
    enabled: false,
    configEnvKeys: ["HF_TOKEN", "HUGGINGFACE_API_KEY"],
    adapterPresent: false,
    supportsCallback: false,
    supportsCancel: false,
  },
  {
    kind: "roboflow",
    displayName: "Roboflow",
    capabilities: ["vision"],
    status: "unconfigured",
    enabled: false,
    configEnvKeys: ["ROBOFLOW_API_KEY"],
    adapterPresent: false,
    supportsCallback: false,
    supportsCancel: false,
  },
  {
    kind: "heygen",
    displayName: "HeyGen",
    capabilities: ["avatar"],
    status: "unconfigured",
    enabled: false,
    configEnvKeys: ["HEYGEN_API_KEY"],
    adapterPresent: false,
    supportsCallback: false,
    supportsCancel: false,
  },
  {
    kind: "tinker",
    displayName: "Tinker",
    capabilities: ["workflow_orchestration", "code_execution"],
    status: "unconfigured",
    enabled: false,
    configEnvKeys: ["TINKER_API_KEY"],
    adapterPresent: false,
    supportsCallback: false,
    supportsCancel: false,
  },
  {
    kind: "inkling",
    displayName: "Inkling",
    capabilities: ["research", "llm_reasoning"],
    status: "unconfigured",
    enabled: false,
    configEnvKeys: ["INKLING_API_KEY"],
    adapterPresent: false,
    supportsCallback: false,
    supportsCancel: false,
  },
  {
    kind: "mock",
    displayName: "Mock (sandbox)",
    capabilities: [
      "code_execution",
      "research",
      "llm_reasoning",
      "vision",
      "avatar",
      "workflow_orchestration",
    ],
    // Only mock may declare sandbox_ready without adapter/config evidence.
    status: "sandbox_ready",
    enabled: true,
    configEnvKeys: [],
    adapterPresent: true,
    supportsCallback: true,
    supportsCancel: true,
  },
] as const;

const BY_KIND = new Map<ExecutionProviderKind, ExecutionProviderDescriptor>(
  PROVIDERS.map((p) => [p.kind, p]),
);

export function listExecutionProviders(): ExecutionProviderDescriptor[] {
  return PROVIDERS.map((p) => ({
    ...p,
    capabilities: [...p.capabilities],
    configEnvKeys: [...p.configEnvKeys],
  }));
}

/**
 * Public registry snapshot. Includes boolean configurationPresent only —
 * never secret values from process.env.
 */
export function dumpExecutionProviderRegistry(): Array<
  ExecutionProviderDescriptor & { configurationPresent: boolean }
> {
  return listExecutionProviders().map((p) => ({
    ...p,
    configurationPresent: configurationPresentFor(p),
  }));
}

export function getExecutionProvider(
  kind: ExecutionProviderKind,
): ExecutionProviderDescriptor | undefined {
  const found = BY_KIND.get(kind);
  if (!found) return undefined;
  return {
    ...found,
    capabilities: [...found.capabilities],
    configEnvKeys: [...found.configEnvKeys],
  };
}

export function isExecutionProviderKind(
  kind: string,
): kind is ExecutionProviderKind {
  return (EXECUTION_PROVIDER_KINDS as readonly string[]).includes(kind);
}

/**
 * Boolean presence check for an env KEY NAME only.
 * Never returns or logs the value.
 */
export function envConfigKeyPresent(keyName: string): boolean {
  if (!keyName || typeof keyName !== "string") return false;
  // Existence of a non-empty binding — value is never exposed to callers.
  const bound = Object.prototype.hasOwnProperty.call(process.env, keyName);
  if (!bound) return false;
  const raw = process.env[keyName];
  return typeof raw === "string" && raw.trim().length > 0;
}

export function configurationPresentFor(
  descriptor: ExecutionProviderDescriptor,
  evidence?: ExecutionProviderEvidence,
): boolean {
  if (typeof evidence?.configurationPresent === "boolean") {
    return evidence.configurationPresent;
  }
  if (descriptor.configEnvKeys.length === 0) {
    // No keys required (mock). Presence is vacuously true for mock only.
    return descriptor.kind === "mock";
  }
  return descriptor.configEnvKeys.some((k) => envConfigKeyPresent(k));
}

function adapterPresentFor(
  descriptor: ExecutionProviderDescriptor,
  evidence?: ExecutionProviderEvidence,
): boolean {
  if (typeof evidence?.adapterPresent === "boolean") {
    return evidence.adapterPresent;
  }
  return descriptor.adapterPresent;
}

function enabledFor(
  descriptor: ExecutionProviderDescriptor,
  evidence?: ExecutionProviderEvidence,
): boolean {
  if (typeof evidence?.enabled === "boolean") {
    return evidence.enabled;
  }
  return descriptor.enabled;
}

function isClinicalOrPatientScope(scope: string): boolean {
  const s = scope.toLowerCase();
  return s === "patient" || s === "clinical";
}

function isLiveScope(scope: string): boolean {
  return scope.toLowerCase() === "live";
}

/**
 * Resolve effective status without promoting to live_ready by default.
 * Worktree/branch evidence alone never upgrades readiness.
 */
export function resolveExecutionProviderStatus(
  descriptor: ExecutionProviderDescriptor,
  evidence?: ExecutionProviderEvidence,
): ExecutionProviderStatus {
  if (!enabledFor(descriptor, evidence)) {
    // Explicit disabled takes precedence; otherwise keep unconfigured semantics
    // when that is the declared default.
    if (descriptor.status === "disabled" || evidence?.enabled === false) {
      return "disabled";
    }
    if (descriptor.status === "unconfigured") {
      return "unconfigured";
    }
    return "disabled";
  }

  const configOk = configurationPresentFor(descriptor, evidence);
  const adapterOk = adapterPresentFor(descriptor, evidence);

  // Claimed live_ready still requires human approval downstream; we never
  // invent it as a default. Evidence overlays cannot invent live_ready —
  // require the registry's actual adapter flag AND actual env-key presence.
  if (evidence?.claimedStatus === "live_ready") {
    const actualAdapter = descriptor.adapterPresent === true;
    const actualConfig = configurationPresentFor(descriptor);
    if (actualAdapter && actualConfig) return "live_ready";
    if (!actualConfig) return "unconfigured";
    return "unavailable";
  }

  if (evidence?.claimedStatus === "unavailable") {
    return "unavailable";
  }
  if (evidence?.claimedStatus === "blocked") {
    return "blocked";
  }

  // Mock: sandbox_ready without adapter/config evidence.
  if (descriptor.kind === "mock") {
    return "sandbox_ready";
  }

  // Non-mock: need both config + adapter for sandbox_ready.
  // Worktree/branch must NOT satisfy this (ignored here on purpose).
  void evidence?.worktreePresent;
  void evidence?.branchPresent;

  if (!configOk) {
    return "unconfigured";
  }
  if (!adapterOk) {
    return "unavailable";
  }

  if (
    evidence?.claimedStatus === "sandbox_ready" ||
    descriptor.status === "sandbox_ready"
  ) {
    return "sandbox_ready";
  }

  // Config + adapter present but no sandbox declaration → still not live.
  // Treat as sandbox_ready only when explicitly claimed or mock (handled above).
  // Default path: remain unconfigured/disabled unless inventory claims sandbox.
  return evidence?.claimedStatus === "disabled"
    ? "disabled"
    : "sandbox_ready";
}

/**
 * Fail-closed gate. Unknown / unconfigured / disabled / clinical / patient ⇒ blocked.
 * Live scope or live_ready ⇒ requiresHumanApproval.
 * Autonomous-ready requires callback AND cancel AND sandbox_ready AND not blocked.
 */
export function evaluateExecutionProviderGate(
  input: ExecutionProviderGateInput,
): ExecutionProviderGateResult {
  const scope = String(input.scope ?? "");

  if (!isExecutionProviderKind(input.kind)) {
    return {
      kind: "unknown",
      status: "blocked",
      blocked: true,
      allowed: false,
      reason: `unknown_provider:${input.kind}`,
      requiresHumanApproval: true,
      autonomousReady: false,
      configurationPresent: false,
      adapterPresent: false,
    };
  }

  const descriptor = BY_KIND.get(input.kind)!;
  const configurationPresent = configurationPresentFor(
    descriptor,
    input.evidence,
  );
  const adapterPresent = adapterPresentFor(descriptor, input.evidence);

  if (isClinicalOrPatientScope(scope)) {
    return {
      kind: descriptor.kind,
      status: "blocked",
      blocked: true,
      allowed: false,
      reason: `scope_blocked:${scope}`,
      requiresHumanApproval: true,
      autonomousReady: false,
      configurationPresent,
      adapterPresent,
    };
  }

  const status = resolveExecutionProviderStatus(descriptor, input.evidence);

  if (
    status === "unconfigured" ||
    status === "disabled" ||
    status === "unavailable" ||
    status === "blocked"
  ) {
    return {
      kind: descriptor.kind,
      status,
      blocked: true,
      allowed: false,
      reason: `provider_${status}`,
      requiresHumanApproval: isLiveScope(scope),
      autonomousReady: false,
      configurationPresent,
      adapterPresent,
    };
  }

  const requiresHumanApproval =
    isLiveScope(scope) || status === "live_ready";

  const autonomousReady =
    status === "sandbox_ready" &&
    descriptor.supportsCallback === true &&
    descriptor.supportsCancel === true &&
    !requiresHumanApproval;

  const allowed =
    status === "sandbox_ready" ||
    (status === "live_ready" && requiresHumanApproval);

  return {
    kind: descriptor.kind,
    status,
    blocked: !allowed,
    allowed,
    reason: allowed
      ? requiresHumanApproval
        ? "live_requires_human_approval"
        : "sandbox_ready"
      : `provider_${status}`,
    requiresHumanApproval,
    autonomousReady,
    configurationPresent,
    adapterPresent,
  };
}

/** Assert registry defaults never invent live_ready. */
export function assertNoDefaultLiveReady(): boolean {
  return PROVIDERS.every((p) => p.status !== "live_ready");
}

/** Assert only mock may be sandbox_ready without adapter+config evidence. */
export function assertOnlyMockSandboxWithoutEvidence(): boolean {
  return PROVIDERS.every((p) => {
    if (p.kind === "mock") return p.status === "sandbox_ready";
    if (p.status === "sandbox_ready") {
      return p.adapterPresent && p.configEnvKeys.length > 0;
    }
    return p.status === "unconfigured" || p.status === "disabled";
  });
}
