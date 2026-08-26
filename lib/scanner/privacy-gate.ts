/**
 * Privacy-gate for Del Pilar Nexus custom vision destinations.
 *
 * Implements the binding checklist in docs/vision/privacy-gate.md and
 * docs/vision/privacy-gate-broser-checklist.md.
 * Fail-closed: every required check must pass before clinical images
 * may be uploaded to custom (non-legacy) Roboflow endpoints — including
 * SHADOW_ONLY parallel inference.
 *
 * Base64 vs URL does not change processor/residency — this gate applies
 * to any image transfer to custom shadow endpoints.
 *
 * Agents cannot self-approve. Default status is closed.
 */

export type PrivacyGateStatus = "closed" | "passed" | "failed";

export type PrivacyGateCheckId =
  | "private_project"
  | "eu_route_documented"
  | "dpa_signed"
  | "residency_reviewed"
  | "retention_policy_set"
  | "human_approver"
  | "privacy_audit_event";

export type PrivacyGateCheck = {
  id: PrivacyGateCheckId;
  ok: boolean;
  detail: string;
};

export type PrivacyGateResult = {
  /** Explicit status for callers / UI. Default path → closed. */
  status: PrivacyGateStatus;
  allowed: boolean;
  checks: PrivacyGateCheck[];
  /** Human-readable skip reasons when not allowed (no PII). */
  failReasons: string[];
};

export type PrivacyGateEnv = {
  privateProject?: string;
  euRouteDocumented?: string;
  dpaSigned?: string;
  residencyReviewed?: string;
  retentionPolicySet?: string;
  humanApprover?: string;
  privacyAuditEventId?: string;
};

/** Gate stays closed unless Broser completes the EU DPA pack. */
export const PRIVACY_GATE_DEFAULT_STATUS: PrivacyGateStatus = "closed";

/**
 * Approver strings that look like agents/bots/CI — never valid Broser approval.
 * Agents cannot self-approve the privacy gate.
 */
const AGENT_OR_BOT_APPROVER =
  /^(agent|cursor|cloud[-_ ]?agent|ci|bot|system|auto(?:mated)?|github[-_ ]?actions|praxis[-_ ]?agent)\b/i;

function truthy(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function nonEmpty(raw: string | undefined): boolean {
  return Boolean(raw?.trim());
}

/** True when the recorded approver is clearly non-human / self-agent. */
export function isAgentSelfApproval(approver: string | undefined): boolean {
  if (!nonEmpty(approver)) return false;
  return AGENT_OR_BOT_APPROVER.test(approver!.trim());
}

function isNamedHumanApprover(approver: string | undefined): boolean {
  return nonEmpty(approver) && !isAgentSelfApproval(approver);
}

function deriveStatus(allowed: boolean, anyCheckAttempted: boolean): PrivacyGateStatus {
  if (allowed) return "passed";
  if (!anyCheckAttempted) return "closed";
  return "failed";
}

/**
 * Evaluate privacy-gate checklist. Defaults fail-closed (all false / empty).
 * Broser must set env flags + named human approver + audit event id to allow uploads.
 */
export function evaluatePrivacyGate(
  env: PrivacyGateEnv = readPrivacyGateEnv(),
): PrivacyGateResult {
  const checks: PrivacyGateCheck[] = [
    {
      id: "private_project",
      ok: truthy(env.privateProject),
      detail: "Target project must be private (not public Universe)",
    },
    {
      id: "eu_route_documented",
      ok: truthy(env.euRouteDocumented),
      detail: "Approved EU data-processing route documented",
    },
    {
      id: "dpa_signed",
      ok: truthy(env.dpaSigned),
      detail: "Signed DPA with processor on file",
    },
    {
      id: "residency_reviewed",
      ok: truthy(env.residencyReviewed),
      detail: "Residens-review completed for approved EU region",
    },
    {
      id: "retention_policy_set",
      ok: truthy(env.retentionPolicySet),
      detail: "Retention policy for inference I/O specified",
    },
    {
      id: "human_approver",
      ok: isNamedHumanApprover(env.humanApprover),
      detail: "Named human approver (Broser) recorded — agents cannot self-approve",
    },
    {
      id: "privacy_audit_event",
      ok: nonEmpty(env.privacyAuditEventId),
      detail: "Immutable privacy audit-event id recorded",
    },
  ];

  if (isAgentSelfApproval(env.humanApprover)) {
    const human = checks.find((c) => c.id === "human_approver");
    if (human) {
      human.ok = false;
      human.detail =
        "Agent/bot approver rejected — Broser human approval required (no self-approve)";
    }
  }

  const failReasons = checks.filter((c) => !c.ok).map((c) => c.id);
  const allowed = failReasons.length === 0;
  const anyCheckAttempted =
    truthy(env.privateProject) ||
    truthy(env.euRouteDocumented) ||
    truthy(env.dpaSigned) ||
    truthy(env.residencyReviewed) ||
    truthy(env.retentionPolicySet) ||
    nonEmpty(env.humanApprover) ||
    nonEmpty(env.privacyAuditEventId);

  return {
    status: deriveStatus(allowed, anyCheckAttempted),
    allowed,
    checks,
    failReasons,
  };
}

export function readPrivacyGateEnv(
  processEnv: NodeJS.ProcessEnv = process.env,
): PrivacyGateEnv {
  return {
    privateProject: processEnv.PRAXIS_VISION_PRIVATE_PROJECT,
    euRouteDocumented: processEnv.PRAXIS_VISION_EU_ROUTE_DOCUMENTED,
    dpaSigned: processEnv.PRAXIS_VISION_DPA_SIGNED,
    residencyReviewed: processEnv.PRAXIS_VISION_RESIDENCY_REVIEWED,
    retentionPolicySet: processEnv.PRAXIS_VISION_RETENTION_POLICY_SET,
    humanApprover: processEnv.PRAXIS_VISION_HUMAN_APPROVER,
    privacyAuditEventId: processEnv.PRAXIS_VISION_PRIVACY_AUDIT_EVENT_ID,
  };
}

/** Convenience: true only when every checklist item passes. */
export function isPrivacyGateOpen(env?: PrivacyGateEnv): boolean {
  return evaluatePrivacyGate(env ?? readPrivacyGateEnv()).allowed;
}

export function getPrivacyGateStatus(env?: PrivacyGateEnv): PrivacyGateStatus {
  return evaluatePrivacyGate(env ?? readPrivacyGateEnv()).status;
}

/**
 * SHADOW_ONLY (and any custom Roboflow) image traffic must call this.
 * Returns false until Broser EU DPA pack passes — default closed.
 */
export function maySendImagesToCustomRoboflow(env?: PrivacyGateEnv): boolean {
  return isPrivacyGateOpen(env);
}

/**
 * Convenience for shadow callers: privacy pack must pass before any image send.
 * Callers must still keep `PRAXIS_SHADOW_EVAL_ENABLED` off by default and
 * `approved_for_active_routing === false` (see `shadow-inference.runShadowEval`).
 */
export function mayRunShadowOnlyImageInference(env?: PrivacyGateEnv): boolean {
  return maySendImagesToCustomRoboflow(env);
}
