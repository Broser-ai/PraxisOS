/**
 * Active-routing unlock for Del Pilar Nexus custom vision endpoints.
 *
 * Governance (`approved_for_active_routing`) may be true while patient-affecting
 * inference still uses Universe pins until:
 *   1. PRAXIS_ACTIVE_ROUTING_ENABLED is truthy, AND
 *   2. FOOT_VISION_CANARY_PERCENT > 0 (hard-capped at 5).
 *
 * At canary 0% the live quality gate / findings path stays on Universe + Trellis.
 * Landmarks (`praxisos`) are never selected here.
 */

import { createHash } from "node:crypto";
import {
  DEL_PILAR_NEXUS_SHADOW_WORKFLOW,
  ROBOFLOW_SHADOW_APPROVED_FOR_ACTIVE_ROUTING,
  SHADOW_CANDIDATES_ENDPOINT,
  SHADOW_LANDMARKS_DEPLOYABLE,
  SHADOW_SEGMENTATION_ENDPOINT,
} from "@/lib/scanner/shadow-workflow";

export const ACTIVE_ROUTING_FLAG = "PRAXIS_ACTIVE_ROUTING_ENABLED" as const;
export const FOOT_VISION_CANARY_FLAG = "FOOT_VISION_CANARY_PERCENT" as const;

/** Hard ceiling — Broser must raise explicitly; never auto-escalate past 5%. */
export const FOOT_VISION_CANARY_MAX_PERCENT = 5;

const UNIVERSE_SEGMENT_PIN = "foot-segmentation-ehn9q/1";
const UNIVERSE_PATHOLOGY_PRIMARY = "foot-ulcer/1";
const UNIVERSE_PATHOLOGY_SECONDARY = "wounds-detection/1";

function truthyFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isActiveRoutingEnvEnabled(
  processEnv: Record<string, string | undefined> = process.env,
): boolean {
  return truthyFlag(processEnv[ACTIVE_ROUTING_FLAG]);
}

/**
 * Parse canary percent. Default 0. Negative → 0. Values above max → clamped.
 */
export function getFootVisionCanaryPercent(
  processEnv: Record<string, string | undefined> = process.env,
): number {
  const raw = processEnv[FOOT_VISION_CANARY_FLAG];
  if (raw === undefined || raw.trim() === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), FOOT_VISION_CANARY_MAX_PERCENT);
}

/**
 * True when governance + env allow *any* live custom routing, independent of
 * whether this request is inside the canary bucket.
 */
export function isActiveRoutingGovernanceOpen(
  processEnv: Record<string, string | undefined> = process.env,
): boolean {
  if (ROBOFLOW_SHADOW_APPROVED_FOR_ACTIVE_ROUTING !== true) return false;
  if (!isActiveRoutingEnvEnabled(processEnv)) return false;
  if (SHADOW_LANDMARKS_DEPLOYABLE !== false) return false;
  if (DEL_PILAR_NEXUS_SHADOW_WORKFLOW.governance.replaces_live_universe_pins) {
    // Full cutover is a separate Broser action; canary path must stay partial.
    return false;
  }
  return true;
}

/**
 * Deterministic canary membership for a scan correlation key.
 * Empty key → never selected (fail closed for patient path).
 */
export function isInFootVisionCanary(
  scanKey: string | undefined,
  processEnv: Record<string, string | undefined> = process.env,
): boolean {
  if (!isActiveRoutingGovernanceOpen(processEnv)) return false;
  const pct = getFootVisionCanaryPercent(processEnv);
  if (pct <= 0) return false;
  if (!scanKey?.trim()) return false;
  const h = createHash("sha256").update(scanKey.trim()).digest();
  const bucket = h[0]! % 100;
  return bucket < pct;
}

export type LiveVisionPinSet = {
  segmentModel: string;
  pathologyModels: readonly string[];
  /** True when custom shadow endpoints were selected for this request. */
  usingCustomCanary: boolean;
  canaryPercent: number;
  clinicalCopy: string;
};

/**
 * Resolve live Roboflow pins for the patient-affecting scan path.
 * Default / canary 0% → Universe pins from env (or legacy defaults).
 * Canary hit → custom shadow endpoints (suggestion-language only).
 * Landmarks never included.
 */
export function resolveLiveVisionPins(
  scanKey: string | undefined,
  processEnv: Record<string, string | undefined> = process.env,
): LiveVisionPinSet {
  const canaryPercent = getFootVisionCanaryPercent(processEnv);
  const universeSegment =
    processEnv.ROBOFLOW_SEGMENT_MODEL?.trim() || UNIVERSE_SEGMENT_PIN;
  const universePrimary =
    processEnv.ROBOFLOW_MODEL?.trim() || UNIVERSE_PATHOLOGY_PRIMARY;
  const universeSecondary =
    processEnv.ROBOFLOW_MODEL_SECONDARY?.trim() || UNIVERSE_PATHOLOGY_SECONDARY;
  const clinicalCopy =
    DEL_PILAR_NEXUS_SHADOW_WORKFLOW.governance.clinical_copy;

  if (!isInFootVisionCanary(scanKey, processEnv)) {
    return {
      segmentModel: universeSegment,
      pathologyModels: [universePrimary, universeSecondary].filter(Boolean),
      usingCustomCanary: false,
      canaryPercent,
      clinicalCopy,
    };
  }

  const version = processEnv.ROBOFLOW_SHADOW_MODEL_VERSION?.trim() || "1";
  const workspace =
    processEnv.ROBOFLOW_SHADOW_WORKSPACE?.trim() ||
    DEL_PILAR_NEXUS_SHADOW_WORKFLOW.workspace;
  const seg = `${workspace}/${SHADOW_SEGMENTATION_ENDPOINT}/${version}`;
  const cand = `${workspace}/${SHADOW_CANDIDATES_ENDPOINT}/${version}`;

  return {
    segmentModel: seg,
    pathologyModels: [cand],
    usingCustomCanary: true,
    canaryPercent,
    clinicalCopy,
  };
}
