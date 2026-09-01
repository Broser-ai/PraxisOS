/**
 * Clinician adjudication schema hook for ShadowFlywheel (acceptance §C).
 *
 * Placeholder only — no fake clinical data, no auto-labels.
 * Used to validate future agree/disagree/unsure records before promotion.
 */

export type AdjudicationDecision = "agree" | "disagree" | "unsure";

export type CandidateAdjudicationRecord = {
  /** Schema version for audit forward-compat. */
  schema: "praxisos.candidate_adjudication.v1";
  /** Hashed scan ref — never raw image / CPR. */
  scan_ref: string;
  /** Candidate class id (e.g. candidate_open_wound). */
  candidate_class: string;
  /** Model / endpoint that produced the box (shadow or live candidate). */
  model_id: string;
  decision: AdjudicationDecision;
  /** Named human clinician — never agent/bot. */
  adjudicator: string;
  adjudicated_at: string; // ISO 8601
  /** Optional free-text note (no PHI). */
  note?: string;
  /** Slice tags for acceptance §C.4 reporting. */
  slice_tags?: string[];
  /** Always suggestions until promotion pack signed. */
  clinical_status: "suggestion_only";
  used_for_routing: false;
  approved_for_active_routing: false;
};

export type AdjudicationDraftInput = {
  scan_ref: string;
  candidate_class: string;
  model_id: string;
  decision: AdjudicationDecision;
  adjudicator: string;
  note?: string;
  slice_tags?: string[];
  adjudicated_at?: string;
};

const AGENT_OR_BOT =
  /^(agent|cursor|cloud[-_ ]?agent|ci|bot|system|auto(?:mated)?|github[-_ ]?actions|praxis[-_ ]?agent)\b/i;

export function isValidAdjudicationDecision(
  value: unknown,
): value is AdjudicationDecision {
  return value === "agree" || value === "disagree" || value === "unsure";
}

/**
 * Build a typed adjudication record. Throws on invalid / agent self-label.
 * Does not persist — callers own storage after Broser privacy unlock.
 */
export function createCandidateAdjudicationDraft(
  input: AdjudicationDraftInput,
): CandidateAdjudicationRecord {
  if (!input.scan_ref?.trim()) {
    throw new Error("adjudication_missing_scan_ref");
  }
  if (!input.candidate_class?.trim()) {
    throw new Error("adjudication_missing_candidate_class");
  }
  if (!input.model_id?.trim()) {
    throw new Error("adjudication_missing_model_id");
  }
  if (!isValidAdjudicationDecision(input.decision)) {
    throw new Error("adjudication_invalid_decision");
  }
  const adjudicator = input.adjudicator?.trim() ?? "";
  if (!adjudicator) {
    throw new Error("adjudication_missing_adjudicator");
  }
  if (AGENT_OR_BOT.test(adjudicator)) {
    throw new Error("adjudication_agent_self_label_forbidden");
  }

  return {
    schema: "praxisos.candidate_adjudication.v1",
    scan_ref: input.scan_ref.trim(),
    candidate_class: input.candidate_class.trim(),
    model_id: input.model_id.trim(),
    decision: input.decision,
    adjudicator,
    adjudicated_at: input.adjudicated_at ?? new Date().toISOString(),
    note: input.note?.trim() || undefined,
    slice_tags: input.slice_tags?.slice(0, 16),
    clinical_status: "suggestion_only",
    used_for_routing: false,
    approved_for_active_routing: false,
  };
}

/**
 * Aggregate helper for acceptance §C precision floor (no clinical GT claim).
 * Empty input → null (insufficient).
 */
export function summarizeAdjudicationPrecision(
  records: CandidateAdjudicationRecord[],
  candidateClass?: string,
): {
  n: number;
  agree: number;
  disagree: number;
  unsure: number;
  precision_proxy: number | null;
  meets_default_floor_0_70: boolean;
} {
  const filtered = candidateClass
    ? records.filter((r) => r.candidate_class === candidateClass)
    : records;
  const agree = filtered.filter((r) => r.decision === "agree").length;
  const disagree = filtered.filter((r) => r.decision === "disagree").length;
  const unsure = filtered.filter((r) => r.decision === "unsure").length;
  const decided = agree + disagree;
  const precision_proxy = decided === 0 ? null : agree / decided;
  return {
    n: filtered.length,
    agree,
    disagree,
    unsure,
    precision_proxy,
    meets_default_floor_0_70:
      precision_proxy != null && decided >= 1 && precision_proxy >= 0.7,
  };
}
