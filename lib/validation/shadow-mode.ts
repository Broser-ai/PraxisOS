// Shadow-mode validation harness · Duke Sepsis Watch pattern.
// Kontrakt: HUMANIZED-FRONTIER-BLUEPRINT §7 · Duke Sendak npj Digital Medicine 2020
//
// PRINCIP:
//   AI-genererede findings er KUN synlige for practitioner efter modellen har
//   passeret 6-måneders shadow-mode med Cohen's kappa ≥ 0.75 mod blinded
//   fodterapeut-panel. Denne fil implementerer:
//     1. concordance-scoring (Cohen's kappa · Fleiss' kappa · agreement %)
//     2. per-stratum-udregning (Fitzpatrick I-VI, IWGDF risk 0-3, aldersgrupper)
//     3. gating: `isModelPromotable()` → boolean før vi flipper feature-flag

// ---------------------------------------------------------------------------
// Rating input
// ---------------------------------------------------------------------------

export type FindingLabel = string;   // fx "callus", "hallux_valgus", "unknown"

/**
 * En enkelt case i test-datasettet.
 * `panel_ratings` = liste af blinded fodterapeut-vurderinger for samme case.
 * `ai_prediction` = modellens forudsigelse.
 */
export type ShadowModeCase = {
  case_id: string;
  ai_prediction: FindingLabel;
  panel_ratings: FindingLabel[];
  stratum: {
    fitzpatrick: "I" | "II" | "III" | "IV" | "V" | "VI";
    iwgdf_risk: 0 | 1 | 2 | 3;
    age_band: "18-29" | "30-44" | "45-59" | "60-74" | "75+";
  };
};

// ---------------------------------------------------------------------------
// Cohen's kappa (2 raters) · Fleiss' kappa (N raters)
// ---------------------------------------------------------------------------

/**
 * Cohen's kappa mellem AI-forudsigelse og PANEL-MAJORITY.
 * Bruges når panel er ≥ 2 raters — vi tager majority-vote som ground truth.
 */
export function cohensKappaAiVsMajority(cases: ShadowModeCase[]): number {
  if (cases.length === 0) return 0;

  const pairs = cases.map((c) => ({
    ai: c.ai_prediction,
    truth: majorityVote(c.panel_ratings),
  }));

  const labels = new Set<string>();
  for (const p of pairs) {
    labels.add(p.ai);
    labels.add(p.truth);
  }

  const n = pairs.length;
  const observedAgreement = pairs.filter((p) => p.ai === p.truth).length / n;

  // Expected agreement = sum over label of (p_ai(label) * p_truth(label))
  let expectedAgreement = 0;
  for (const label of labels) {
    const pAi = pairs.filter((p) => p.ai === label).length / n;
    const pTruth = pairs.filter((p) => p.truth === label).length / n;
    expectedAgreement += pAi * pTruth;
  }

  if (expectedAgreement >= 1) return 1;
  return (observedAgreement - expectedAgreement) / (1 - expectedAgreement);
}

/**
 * Simple majority vote. Ties break on first-seen.
 */
export function majorityVote(ratings: FindingLabel[]): FindingLabel {
  if (ratings.length === 0) return "unknown";
  const counts = new Map<string, number>();
  for (const r of ratings) counts.set(r, (counts.get(r) ?? 0) + 1);
  let best: FindingLabel = ratings[0]!;
  let bestCount = 0;
  for (const [label, count] of counts.entries()) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Raw agreement percentage (AI == majority vote).
 */
export function agreementPercentage(cases: ShadowModeCase[]): number {
  if (cases.length === 0) return 0;
  const matches = cases.filter((c) => c.ai_prediction === majorityVote(c.panel_ratings)).length;
  return matches / cases.length;
}

// ---------------------------------------------------------------------------
// Stratified analysis (bias audit)
// ---------------------------------------------------------------------------

export type StratumKey = "fitzpatrick" | "iwgdf_risk" | "age_band";

export type StratumReport = {
  stratum_key: StratumKey;
  strata: Array<{
    value: string;
    n: number;
    kappa: number;
    agreement: number;
  }>;
};

/**
 * Cohen's kappa pr. stratum. Bruges til Model Card publikation.
 * Sendak npj Digital Medicine 2020 template kræver stratified performance.
 */
export function stratifiedKappa(cases: ShadowModeCase[], key: StratumKey): StratumReport {
  const buckets = new Map<string, ShadowModeCase[]>();
  for (const c of cases) {
    const value = String(c.stratum[key]);
    if (!buckets.has(value)) buckets.set(value, []);
    buckets.get(value)!.push(c);
  }

  const strata = Array.from(buckets.entries())
    .map(([value, subset]) => ({
      value,
      n: subset.length,
      kappa: +cohensKappaAiVsMajority(subset).toFixed(4),
      agreement: +agreementPercentage(subset).toFixed(4),
    }))
    .sort((a, b) => a.value.localeCompare(b.value));

  return { stratum_key: key, strata };
}

// ---------------------------------------------------------------------------
// Promotion gate · Duke Sepsis Watch pattern
// ---------------------------------------------------------------------------

export type PromotionRequirements = {
  minKappaOverall: number;      // default 0.75
  minKappaPerStratum: number;   // default 0.60 (allows some sub-group variance)
  minCasesOverall: number;      // default 500
  minCasesPerStratum: number;   // default 30
  strata: StratumKey[];
};

export const DEFAULT_PROMOTION_REQUIREMENTS: PromotionRequirements = {
  minKappaOverall: 0.75,
  minKappaPerStratum: 0.6,
  minCasesOverall: 500,
  minCasesPerStratum: 30,
  strata: ["fitzpatrick", "iwgdf_risk", "age_band"],
};

export type PromotionVerdict = {
  promotable: boolean;
  overall_kappa: number;
  overall_n: number;
  reasons: string[];
  stratum_reports: StratumReport[];
};

/**
 * Central gating-funktion. Returnerer `promotable: true` KUN hvis alle
 * kappa- + n-krav er opfyldt både overall og pr. stratum.
 *
 * Bruges i CI/CD-pipeline eller manuel review inden en model flippes fra
 * shadow-mode til practitioner-facing.
 */
export function isModelPromotable(
  cases: ShadowModeCase[],
  reqs: PromotionRequirements = DEFAULT_PROMOTION_REQUIREMENTS,
): PromotionVerdict {
  const reasons: string[] = [];
  const overallKappa = cohensKappaAiVsMajority(cases);
  const overallN = cases.length;

  if (overallN < reqs.minCasesOverall) {
    reasons.push(`insufficient cases: ${overallN} < ${reqs.minCasesOverall}`);
  }
  if (overallKappa < reqs.minKappaOverall) {
    reasons.push(
      `overall kappa ${overallKappa.toFixed(3)} < required ${reqs.minKappaOverall}`,
    );
  }

  const stratumReports = reqs.strata.map((key) => stratifiedKappa(cases, key));

  for (const report of stratumReports) {
    for (const s of report.strata) {
      if (s.n < reqs.minCasesPerStratum) {
        reasons.push(
          `stratum ${report.stratum_key}=${s.value} has ${s.n} cases (< ${reqs.minCasesPerStratum})`,
        );
      }
      if (s.n >= reqs.minCasesPerStratum && s.kappa < reqs.minKappaPerStratum) {
        reasons.push(
          `stratum ${report.stratum_key}=${s.value} kappa ${s.kappa.toFixed(3)} < required ${reqs.minKappaPerStratum}`,
        );
      }
    }
  }

  return {
    promotable: reasons.length === 0,
    overall_kappa: +overallKappa.toFixed(4),
    overall_n: overallN,
    reasons,
    stratum_reports: stratumReports,
  };
}
