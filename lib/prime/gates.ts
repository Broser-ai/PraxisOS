// Clinical / pathology gates for Prime · fail-closed

import {
  PRIME_FORBIDDEN_INTENTS,
  PRIME_INVARIANTS,
} from "@/lib/prime/types";

export type GateResult =
  | { ok: true }
  | { ok: false; code: string; reason: string };

/**
 * Reject prompts that ask Prime for autonomous clinical action.
 * Education / quiz / ops self-critique remain allowed.
 */
export function assertPrimeIntentAllowed(prompt: string): GateResult {
  const lower = prompt.toLowerCase();
  for (const intent of PRIME_FORBIDDEN_INTENTS) {
    if (lower.includes(intent)) {
      // Allow meta-questions ABOUT the ban (quiz items)
      if (
        /må\s|may\s|allowed|tilladt|forbidden|må ai|skal behandleren/i.test(
          prompt,
        )
      ) {
        continue;
      }
      return {
        ok: false,
        code: "prime_clinical_intent_forbidden",
        reason: `Prime refuses clinical intent «${intent}» — suggestions/quiz only`,
      };
    }
  }

  if (PRIME_INVARIANTS.NO_AUTONOMOUS_CLINICAL !== true) {
    return {
      ok: false,
      code: "prime_invariant_broken",
      reason: "NO_AUTONOMOUS_CLINICAL must remain true",
    };
  }
  if (PRIME_INVARIANTS.NO_MODEL_TRAINING !== true) {
    return {
      ok: false,
      code: "prime_invariant_broken",
      reason: "NO_MODEL_TRAINING must remain true",
    };
  }
  return { ok: true };
}

/**
 * Pathology shadow gate — Prime never promotes findings to active routing.
 */
export function pathologyShadowStatus(): {
  mode: "shadow";
  used_for_routing: false;
  approved_for_active_routing: false;
  note: string;
} {
  return {
    mode: "shadow",
    used_for_routing: false,
    approved_for_active_routing: false,
    note: "Pathology remains shadow until Broser gates + CE; Prime cannot lift this.",
  };
}

export function assertNoClinicalPolicyDelta(
  deltas: Record<string, number>,
): GateResult {
  const forbiddenKeys = [
    "diagnosis",
    "triage",
    "treatment",
    "pathology_routing",
    "active_routing",
    "clinical_threshold",
    "scan_quality_threshold",
  ];
  for (const key of Object.keys(deltas)) {
    const lower = key.toLowerCase();
    if (forbiddenKeys.some((f) => lower.includes(f))) {
      return {
        ok: false,
        code: "prime_clinical_delta_forbidden",
        reason: `Policy key «${key}» touches clinical routing — blocked`,
      };
    }
  }
  return { ok: true };
}
