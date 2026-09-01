/**
 * Swarm-facing shadow / privacy gate summary for FREJ compliance ticks.
 * Read-only — never enables shadow eval or uploads images.
 */

import {
  evaluatePrivacyGate,
  readPrivacyGateEnv,
  type PrivacyGateStatus,
} from "@/lib/scanner/privacy-gate";
import { isShadowEvalEnabled } from "@/lib/scanner/shadow-inference";
import { CLINICAL_POLICY } from "@/lib/swarm/clinical-policy";
import { SWARM_INVARIANTS } from "@/lib/swarm/types";

export type ShadowGateSnapshot = {
  shadowEvalFlag: boolean;
  privacyGate: PrivacyGateStatus;
  privacyAllowed: boolean;
  clinicalPolicy: typeof CLINICAL_POLICY;
  swarmInvariants: {
    NO_AUTO_MERGE: boolean;
    NO_AUTO_DEPLOY: boolean;
  };
  /** True when swarm may continue research/improve — always true for non-vision tasks */
  safeForNonVisionSwarm: boolean;
  /** True only if vision shadow image traffic would be allowed (flag + privacy) */
  visionShadowWouldRun: boolean;
};

export function getShadowGateSnapshot(
  processEnv: NodeJS.ProcessEnv = process.env,
): ShadowGateSnapshot {
  const gate = evaluatePrivacyGate(readPrivacyGateEnv(processEnv));
  const shadowEvalFlag = isShadowEvalEnabled(processEnv);
  return {
    shadowEvalFlag,
    privacyGate: gate.status,
    privacyAllowed: gate.allowed,
    clinicalPolicy: CLINICAL_POLICY,
    swarmInvariants: {
      NO_AUTO_MERGE: SWARM_INVARIANTS.NO_AUTO_MERGE,
      NO_AUTO_DEPLOY: SWARM_INVARIANTS.NO_AUTO_DEPLOY,
    },
    safeForNonVisionSwarm:
      SWARM_INVARIANTS.NO_AUTO_MERGE === true &&
      SWARM_INVARIANTS.NO_AUTO_DEPLOY === true &&
      CLINICAL_POLICY.clinical_status === "suggestion_only",
    visionShadowWouldRun: shadowEvalFlag && gate.allowed,
  };
}
