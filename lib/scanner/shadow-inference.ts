/**
 * SHADOW_ONLY parallel inference for Del Pilar Nexus custom endpoints.
 *
 * - Never replaces Universe / Hetzner live routing.
 * - Never feeds quality gate, patient response, or clinical findings.
 * - Requires PRAXIS_SHADOW_EVAL_ENABLED + privacy-gate pass before any image upload.
 * - Fail-soft: errors are audited and swallowed; primary pipeline is unaffected.
 * - AI findings = suggestions only (logged for evaluation).
 */

import { createHash } from "node:crypto";
import { auditError, auditLog } from "@/lib/audit";
import { resolveSecret } from "@/lib/secrets";
import {
  evaluatePrivacyGate,
  readPrivacyGateEnv,
  type PrivacyGateEnv,
  type PrivacyGateResult,
} from "@/lib/scanner/privacy-gate";
import {
  DEL_PILAR_NEXUS_SHADOW_WORKFLOW,
  ROBOFLOW_SHADOW_APPROVED_FOR_ACTIVE_ROUTING,
  ROBOFLOW_SHADOW_WORKFLOW_ID,
  ROBOFLOW_SHADOW_WORKSPACE,
  SHADOW_LANDMARKS_DEPLOYABLE,
  assertLandmarksNotSelectedForInference,
  isShadowOnlyRoutingAllowed,
  listShadowParallelInferenceEndpoints,
} from "@/lib/scanner/shadow-workflow";

/** Explicit feature flag — default OFF. Accepts 1/true/yes/on. */
export const SHADOW_EVAL_FLAG = "PRAXIS_SHADOW_EVAL_ENABLED" as const;

export type ShadowPredictionSummary = {
  class: string;
  confidence: number;
};

export type ShadowEndpointResult = {
  role: "segmentation" | "candidates";
  model_id: string;
  latency_ms: number;
  ok: boolean;
  predictions: ShadowPredictionSummary[];
  error?: string;
};

export type ShadowEvalRecord = {
  event: "vision.shadow.eval";
  workflow_id: string;
  workspace: string;
  deployment_state: "shadow_only";
  approved_for_active_routing: false;
  used_for_routing: false;
  used_for_quality_gate: false;
  used_for_patient_response: false;
  clinical_copy: string;
  scan_ref: string;
  tenant_ref: string;
  endpoints: ShadowEndpointResult[];
  skipped?: boolean;
  skip_reason?: string;
  privacy_fail_reasons?: string[];
};

export type ShadowEvalDeps = {
  fetchFn?: typeof fetch;
  apiKey?: string;
  flagEnabled?: boolean;
  privacyEnv?: PrivacyGateEnv;
  now?: () => number;
  audit?: {
    log: typeof auditLog;
    error: typeof auditError;
  };
};

export type ShadowEvalInput = {
  imageBase64: string;
  tenantId?: string;
  patientId?: string;
  /** Optional correlation id already present in scan flow (no new PII). */
  scanId?: string;
};

function truthyFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isShadowEvalEnabled(
  processEnv: Record<string, string | undefined> = process.env,
): boolean {
  return truthyFlag(processEnv[SHADOW_EVAL_FLAG]);
}

function stripDataUrl(b64: string): string {
  return b64.replace(/^data:image\/\w+;base64,/, "");
}

/** Short non-reversible ref for logs (no raw tenant/patient/image). */
export function hashScanRef(parts: {
  tenantId?: string;
  patientId?: string;
  scanId?: string;
  imageBase64?: string;
}): string {
  const h = createHash("sha256");
  h.update(parts.scanId ?? "");
  h.update("|");
  h.update(parts.tenantId ?? "");
  h.update("|");
  h.update(parts.patientId ?? "");
  h.update("|");
  if (parts.imageBase64) {
    const bare = stripDataUrl(parts.imageBase64);
    h.update(bare.slice(0, 64));
    h.update(String(bare.length));
  }
  return h.digest("hex").slice(0, 16);
}

function hashTenantRef(tenantId: string | undefined): string {
  if (!tenantId) return "unknown";
  return createHash("sha256").update(tenantId).digest("hex").slice(0, 12);
}

function shadowModelVersion(
  processEnv: NodeJS.ProcessEnv = process.env,
): string {
  return processEnv.ROBOFLOW_SHADOW_MODEL_VERSION?.trim() || "1";
}

function modelPath(endpoint: string): string {
  return `${ROBOFLOW_SHADOW_WORKSPACE}/${endpoint}/${shadowModelVersion()}`;
}

type RfPred = { class?: string; confidence?: number };

function summarizePredictions(raw: unknown): ShadowPredictionSummary[] {
  if (!raw || typeof raw !== "object") return [];
  const preds = (raw as { predictions?: RfPred[] }).predictions;
  if (!Array.isArray(preds)) return [];
  return preds
    .filter((p) => typeof p?.class === "string")
    .map((p) => ({
      class: String(p.class),
      confidence: typeof p.confidence === "number" ? p.confidence : 0,
    }))
    .slice(0, 50);
}

async function inferEndpoint(
  modelId: string,
  imageBase64: string,
  apiKey: string,
  fetchFn: typeof fetch,
  now: () => number,
): Promise<Omit<ShadowEndpointResult, "role">> {
  const started = now();
  try {
    const res = await fetchFn(
      `https://detect.roboflow.com/${modelId}?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        body: stripDataUrl(imageBase64),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );
    const latency_ms = Math.max(0, now() - started);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        model_id: modelId,
        latency_ms,
        ok: false,
        predictions: [],
        error: `HTTP ${res.status}`,
      };
    }
    return {
      model_id: modelId,
      latency_ms,
      ok: true,
      predictions: summarizePredictions(data),
    };
  } catch (e) {
    return {
      model_id: modelId,
      latency_ms: Math.max(0, now() - started),
      ok: false,
      predictions: [],
      error: e instanceof Error ? e.message : "shadow_infer_error",
    };
  }
}

function baseRecord(scanRef: string, tenantRef: string): ShadowEvalRecord {
  return {
    event: "vision.shadow.eval",
    workflow_id: ROBOFLOW_SHADOW_WORKFLOW_ID,
    workspace: ROBOFLOW_SHADOW_WORKSPACE,
    deployment_state: "shadow_only",
    approved_for_active_routing: false,
    used_for_routing: false,
    used_for_quality_gate: false,
    used_for_patient_response: false,
    clinical_copy: DEL_PILAR_NEXUS_SHADOW_WORKFLOW.governance.clinical_copy,
    scan_ref: scanRef,
    tenant_ref: tenantRef,
    endpoints: [],
  };
}

export type ShadowEvalOutcome =
  | { status: "skipped"; reason: string; record: ShadowEvalRecord; gate?: PrivacyGateResult }
  | { status: "completed"; record: ShadowEvalRecord }
  | { status: "error"; record: ShadowEvalRecord; error: string };

/**
 * Run shadow inference when flag is on AND privacy gate passes.
 * Never throws to callers — always returns a structured outcome.
 * Does not call landmarks (not deployable).
 */
export async function runShadowEval(
  input: ShadowEvalInput,
  deps: ShadowEvalDeps = {},
): Promise<ShadowEvalOutcome> {
  const audit = deps.audit ?? { log: auditLog, error: auditError };
  const now = deps.now ?? Date.now;
  const scanRef = hashScanRef({
    tenantId: input.tenantId,
    patientId: input.patientId,
    scanId: input.scanId,
    imageBase64: input.imageBase64,
  });
  const tenantRef = hashTenantRef(input.tenantId);
  const record = baseRecord(scanRef, tenantRef);

  // Hard governance: never treat as active routing
  if (
    ROBOFLOW_SHADOW_APPROVED_FOR_ACTIVE_ROUTING !== false ||
    !isShadowOnlyRoutingAllowed() ||
    SHADOW_LANDMARKS_DEPLOYABLE !== false
  ) {
    record.skipped = true;
    record.skip_reason = "governance_block";
    audit.log("vision.shadow.skipped", {
      ...record,
      target_ref: `shadow/${scanRef}`,
    });
    return { status: "skipped", reason: "governance_block", record };
  }

  const flagOn =
    deps.flagEnabled !== undefined
      ? deps.flagEnabled
      : isShadowEvalEnabled();
  if (!flagOn) {
    record.skipped = true;
    record.skip_reason = "flag_off";
    audit.log("vision.shadow.skipped", {
      ...record,
      target_ref: `shadow/${scanRef}`,
    });
    return { status: "skipped", reason: "flag_off", record };
  }

  const gate = evaluatePrivacyGate(deps.privacyEnv ?? readPrivacyGateEnv());
  if (!gate.allowed) {
    record.skipped = true;
    record.skip_reason = "privacy_gate";
    record.privacy_fail_reasons = gate.failReasons;
    audit.log("vision.shadow.skipped", {
      ...record,
      target_ref: `shadow/${scanRef}`,
    });
    return { status: "skipped", reason: "privacy_gate", record, gate };
  }

  if (!input.imageBase64?.trim()) {
    record.skipped = true;
    record.skip_reason = "missing_image";
    audit.log("vision.shadow.skipped", {
      ...record,
      target_ref: `shadow/${scanRef}`,
    });
    return { status: "skipped", reason: "missing_image", record };
  }

  const apiKey = deps.apiKey ?? resolveSecret("ROBOFLOW_API_KEY");
  if (!apiKey) {
    record.skipped = true;
    record.skip_reason = "missing_api_key";
    audit.log("vision.shadow.skipped", {
      ...record,
      target_ref: `shadow/${scanRef}`,
    });
    return { status: "skipped", reason: "missing_api_key", record };
  }

  const fetchFn = deps.fetchFn ?? fetch;

  try {
    // Landmarks intentionally omitted while candidate_untrained / not deployable.
    assertLandmarksNotSelectedForInference();
    const lanes = listShadowParallelInferenceEndpoints();

    const results = await Promise.all(
      lanes.map(async (lane) => {
        const modelId = modelPath(lane.endpoint);
        const result = await inferEndpoint(
          modelId,
          input.imageBase64,
          apiKey,
          fetchFn,
          now,
        );
        return { role: lane.lane, ...result } satisfies ShadowEndpointResult;
      }),
    );

    record.endpoints = results;

    audit.log("vision.shadow.completed", {
      ...record,
      target_ref: `shadow/${scanRef}`,
      tenant_id: input.tenantId,
    });

    return { status: "completed", record };
  } catch (e) {
    const error = e instanceof Error ? e.message : "shadow_eval_failed";
    audit.error("vision.shadow.error", e, {
      ...record,
      target_ref: `shadow/${scanRef}`,
      tenant_id: input.tenantId,
    });
    return { status: "error", record, error };
  }
}

/**
 * Fire-and-forget wrapper for the scan pipeline.
 * Never rejects; never influences caller control flow.
 */
export function scheduleShadowEval(
  input: ShadowEvalInput,
  deps?: ShadowEvalDeps,
): void {
  void runShadowEval(input, deps).catch((err) => {
    try {
      auditError("vision.shadow.error", err, {
        event: "vision.shadow.eval",
        skip_reason: "unhandled",
        approved_for_active_routing: false,
        used_for_routing: false,
      });
    } catch {
      // never break primary
    }
  });
}
