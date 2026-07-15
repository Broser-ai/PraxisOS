// Post-market surveillance · daily drift monitoring for Class-IIa medical AI.
// Kontrakt: MDR Art. 83 (post-market surveillance) · AI Act Art. 12 (logging)
// STATE-OF-THE-ART §10 · Duke Sepsis Watch playbook
//
// PRINCIP:
//   1. Aggregér daglig performance-signal (agreement, confidence-distribution,
//      finding-distribution, escalation-rate)
//   2. Kør CUSUM-baseret drift-detection mod baseline
//   3. Generer månedlig PSUR-lignende rapport (Periodic Safety Update Report)
//   4. Alert på grænser hvor model skal freezes / rulles tilbage

// ---------------------------------------------------------------------------
// Daily signal input
// ---------------------------------------------------------------------------

export type DailySignal = {
  date: string;                          // ISO YYYY-MM-DD
  sample_count: number;
  agreement_rate: number;                // 0..1 · practitioner-accept rate
  mean_confidence: number;               // 0..1
  finding_category_counts: Record<string, number>;
  escalation_count: number;
  mdr_status_tenants: {
    ce_marked: number;
    pre_market: number;
    none: number;
  };
};

// ---------------------------------------------------------------------------
// CUSUM (Cumulative Sum) drift detection · Page 1954
// ---------------------------------------------------------------------------

export type CusumConfig = {
  target: number;                        // baseline expected value
  allowance: number;                     // slack constant (k), typically 0.5 * sigma
  threshold: number;                     // control limit (h), typically 4-5 * sigma
};

export type CusumResult = {
  positive_sums: number[];               // sum^+ over time
  negative_sums: number[];               // sum^-
  alarms: Array<{ index: number; direction: "up" | "down"; value: number }>;
};

/**
 * Two-sided CUSUM statistic.
 * Bruges til at detektere gradvis drift i agreement_rate eller confidence.
 * Alarm når |sum^+/-| > h — model skal review'es.
 */
export function cusum(
  observations: number[],
  config: CusumConfig,
): CusumResult {
  const { target, allowance, threshold } = config;
  const posSums: number[] = [];
  const negSums: number[] = [];
  const alarms: CusumResult["alarms"] = [];
  let sPos = 0;
  let sNeg = 0;
  for (let i = 0; i < observations.length; i++) {
    const x = observations[i]!;
    sPos = Math.max(0, sPos + (x - target) - allowance);
    sNeg = Math.min(0, sNeg + (x - target) + allowance);
    posSums.push(sPos);
    negSums.push(sNeg);
    if (sPos > threshold) alarms.push({ index: i, direction: "up", value: sPos });
    if (sNeg < -threshold) alarms.push({ index: i, direction: "down", value: sNeg });
  }
  return { positive_sums: posSums, negative_sums: negSums, alarms };
}

// ---------------------------------------------------------------------------
// PSUR (Periodic Safety Update Report) — månedlig aggregering
// ---------------------------------------------------------------------------

export type MonthlySafetyReport = {
  reporting_period: { start: string; end: string };
  total_samples: number;
  daily_signals: DailySignal[];
  agreement_baseline: number;
  agreement_current: number;
  agreement_delta: number;
  confidence_baseline: number;
  confidence_current: number;
  confidence_delta: number;
  finding_distribution_shift: Record<string, number>;   // % change per category
  escalation_rate: number;
  drift_alarms: CusumResult["alarms"];
  recommended_action: "continue" | "review" | "freeze-clinical" | "rollback";
  narrative: string;
};

const DEFAULT_AGREEMENT_TARGET = 0.85;
const DEFAULT_CONFIDENCE_TARGET = 0.75;
const DEFAULT_CUSUM_CONFIG: CusumConfig = {
  target: 0,          // set per-observation
  allowance: 0.02,    // 2 % slack
  threshold: 0.15,    // alarm ved ~7 dages sustained 2 % drift
};

export function generateMonthlyReport(
  dailySignals: DailySignal[],
): MonthlySafetyReport {
  if (dailySignals.length === 0) {
    throw new Error("PSUR: cannot generate report from empty daily-signal set");
  }
  const sorted = [...dailySignals].sort((a, b) => a.date.localeCompare(b.date));
  const start = sorted[0]!.date;
  const end = sorted[sorted.length - 1]!.date;
  const totalSamples = sorted.reduce((sum, d) => sum + d.sample_count, 0);

  const agreements = sorted.map((d) => d.agreement_rate);
  const confidences = sorted.map((d) => d.mean_confidence);

  // First-week baseline vs last-week current
  const baselineWindow = agreements.slice(0, Math.min(7, agreements.length));
  const currentWindow = agreements.slice(-Math.min(7, agreements.length));
  const agreementBaseline = avg(baselineWindow);
  const agreementCurrent = avg(currentWindow);

  const confBaseline = avg(confidences.slice(0, Math.min(7, confidences.length)));
  const confCurrent = avg(confidences.slice(-Math.min(7, confidences.length)));

  // CUSUM against baseline
  const cusumAgreement = cusum(agreements, {
    ...DEFAULT_CUSUM_CONFIG,
    target: agreementBaseline,
  });

  const distributionShift = computeDistributionShift(sorted);
  const escalationRate =
    totalSamples > 0
      ? sorted.reduce((sum, d) => sum + d.escalation_count, 0) / totalSamples
      : 0;

  // Recommended action per drift severity
  let action: MonthlySafetyReport["recommended_action"] = "continue";
  if (agreementCurrent < DEFAULT_AGREEMENT_TARGET * 0.85) action = "rollback";
  else if (agreementCurrent < DEFAULT_AGREEMENT_TARGET * 0.9) action = "freeze-clinical";
  else if (agreementCurrent < DEFAULT_AGREEMENT_TARGET * 0.95) action = "review";
  else if (cusumAgreement.alarms.length > 0) action = "review";

  const narrative = renderNarrative({
    start,
    end,
    totalSamples,
    agreementBaseline,
    agreementCurrent,
    confBaseline,
    confCurrent,
    escalationRate,
    action,
    alarmCount: cusumAgreement.alarms.length,
  });

  return {
    reporting_period: { start, end },
    total_samples: totalSamples,
    daily_signals: sorted,
    agreement_baseline: +agreementBaseline.toFixed(4),
    agreement_current: +agreementCurrent.toFixed(4),
    agreement_delta: +(agreementCurrent - agreementBaseline).toFixed(4),
    confidence_baseline: +confBaseline.toFixed(4),
    confidence_current: +confCurrent.toFixed(4),
    confidence_delta: +(confCurrent - confBaseline).toFixed(4),
    finding_distribution_shift: distributionShift,
    escalation_rate: +escalationRate.toFixed(4),
    drift_alarms: cusumAgreement.alarms,
    recommended_action: action,
    narrative,
  };
}

function computeDistributionShift(
  signals: DailySignal[],
): Record<string, number> {
  const totalStart = new Map<string, number>();
  const totalEnd = new Map<string, number>();
  const half = Math.floor(signals.length / 2);
  for (let i = 0; i < signals.length; i++) {
    const bucket = i < half ? totalStart : totalEnd;
    for (const [cat, count] of Object.entries(signals[i]!.finding_category_counts)) {
      bucket.set(cat, (bucket.get(cat) ?? 0) + count);
    }
  }
  const sumStart = [...totalStart.values()].reduce((a, b) => a + b, 0) || 1;
  const sumEnd = [...totalEnd.values()].reduce((a, b) => a + b, 0) || 1;
  const shifts: Record<string, number> = {};
  const allCats = new Set([...totalStart.keys(), ...totalEnd.keys()]);
  for (const cat of allCats) {
    const pctStart = (totalStart.get(cat) ?? 0) / sumStart;
    const pctEnd = (totalEnd.get(cat) ?? 0) / sumEnd;
    shifts[cat] = +(pctEnd - pctStart).toFixed(4);
  }
  return shifts;
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function renderNarrative(input: {
  start: string;
  end: string;
  totalSamples: number;
  agreementBaseline: number;
  agreementCurrent: number;
  confBaseline: number;
  confCurrent: number;
  escalationRate: number;
  action: MonthlySafetyReport["recommended_action"];
  alarmCount: number;
}): string {
  const dPct = (
    ((input.agreementCurrent - input.agreementBaseline) /
      Math.max(input.agreementBaseline, 0.01)) *
    100
  ).toFixed(1);
  return [
    `PSUR periode ${input.start} → ${input.end} · ${input.totalSamples} samples.`,
    `Practitioner-agreement baseline ${(input.agreementBaseline * 100).toFixed(1)}% → current ${(input.agreementCurrent * 100).toFixed(1)}% (Δ ${dPct}%).`,
    `Mean confidence ${(input.confBaseline * 100).toFixed(1)}% → ${(input.confCurrent * 100).toFixed(1)}%.`,
    `Escalation rate ${(input.escalationRate * 100).toFixed(2)}%.`,
    `CUSUM alarms: ${input.alarmCount}.`,
    `Recommended action: ${input.action.toUpperCase()}.`,
  ].join(" ");
}
