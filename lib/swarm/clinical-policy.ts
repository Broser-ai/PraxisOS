/**
 * Swarm clinical policy — suggestion-only, never auto-route or auto-diagnose.
 * Aligns with scanner adjudication / shadow gates (MDR Class IIa freeze).
 */

export const CLINICAL_POLICY = {
  clinical_status: "suggestion_only",
  approved_for_active_routing: false,
  used_for_routing: false,
  used_for_patient_response: false,
  requires_clinician_review: true,
  NO_AUTO_DIAGNOSIS: true,
  NO_AUTO_JOURNAL_SIGN: true,
} as const;

export type ClinicalSuggestionEnvelope<T = Record<string, unknown>> = {
  clinical_status: typeof CLINICAL_POLICY.clinical_status;
  approved_for_active_routing: false;
  used_for_routing: false;
  used_for_patient_response: false;
  requires_clinician_review: true;
  suggestion: T;
  disclaimer: string;
};

export const CLINICAL_SUGGESTION_DISCLAIMER =
  "Kandidatforslag kun — kræver kliniker-review. Ikke diagnose, ikke aktiv routing.";

/** Wrap any clinical agent output as suggestion-only. */
export function asClinicalSuggestion<T extends Record<string, unknown>>(
  suggestion: T,
): ClinicalSuggestionEnvelope<T> {
  return {
    clinical_status: CLINICAL_POLICY.clinical_status,
    approved_for_active_routing: false,
    used_for_routing: false,
    used_for_patient_response: false,
    requires_clinician_review: true,
    suggestion,
    disclaimer: CLINICAL_SUGGESTION_DISCLAIMER,
  };
}

/** FREJ / H-bridge: reject envelopes that claim active clinical routing. */
export function assertSuggestionOnlyClinical(
  value: unknown,
): { ok: true } | { ok: false; reason: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, reason: "clinical_envelope_missing" };
  }
  const rec = value as Record<string, unknown>;
  if (rec.clinical_status !== "suggestion_only") {
    return { ok: false, reason: "clinical_status_must_be_suggestion_only" };
  }
  if (rec.approved_for_active_routing === true) {
    return { ok: false, reason: "approved_for_active_routing_forbidden" };
  }
  if (rec.used_for_routing === true) {
    return { ok: false, reason: "used_for_routing_forbidden" };
  }
  if (rec.used_for_patient_response === true) {
    return { ok: false, reason: "used_for_patient_response_forbidden" };
  }
  return { ok: true };
}
