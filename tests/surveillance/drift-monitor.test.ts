// Post-market surveillance drift-monitor tests
// Kontrakt: MDR Art. 83 · AI Act Art. 12 · STATE-OF-THE-ART §10

import { describe, it, expect } from "vitest";
import {
  cusum,
  generateMonthlyReport,
  type DailySignal,
} from "@/lib/surveillance/drift-monitor";

function makeSignal(overrides: Partial<DailySignal>): DailySignal {
  return {
    date: overrides.date ?? "2026-07-01",
    sample_count: overrides.sample_count ?? 25,
    agreement_rate: overrides.agreement_rate ?? 0.85,
    mean_confidence: overrides.mean_confidence ?? 0.75,
    finding_category_counts: overrides.finding_category_counts ?? {
      dermatological: 10,
      biomechanical: 8,
      vascular: 4,
      neurological: 3,
    },
    escalation_count: overrides.escalation_count ?? 1,
    mdr_status_tenants: overrides.mdr_status_tenants ?? {
      ce_marked: 3,
      pre_market: 2,
      none: 5,
    },
  };
}

describe("surveillance · CUSUM", () => {
  it("stable observations produce no alarms", () => {
    const obs = Array.from({ length: 30 }, () => 0.85);
    const result = cusum(obs, { target: 0.85, allowance: 0.02, threshold: 0.15 });
    expect(result.alarms.length).toBe(0);
  });

  it("sustained downward drift triggers alarm", () => {
    const obs = [
      ...Array.from({ length: 5 }, () => 0.85),
      ...Array.from({ length: 15 }, () => 0.7),
    ];
    const result = cusum(obs, { target: 0.85, allowance: 0.02, threshold: 0.15 });
    const downAlarms = result.alarms.filter((a) => a.direction === "down");
    expect(downAlarms.length).toBeGreaterThan(0);
  });

  it("upward drift triggers up-alarm", () => {
    const obs = [
      ...Array.from({ length: 5 }, () => 0.70),
      ...Array.from({ length: 15 }, () => 0.95),
    ];
    const result = cusum(obs, { target: 0.70, allowance: 0.02, threshold: 0.15 });
    const upAlarms = result.alarms.filter((a) => a.direction === "up");
    expect(upAlarms.length).toBeGreaterThan(0);
  });
});

describe("surveillance · monthly PSUR", () => {
  function makeMonth(overrides: Partial<DailySignal> = {}): DailySignal[] {
    return Array.from({ length: 30 }, (_, i) =>
      makeSignal({
        date: `2026-07-${String(i + 1).padStart(2, "0")}`,
        ...overrides,
      }),
    );
  }

  it("generates report from 30-day signal set", () => {
    const report = generateMonthlyReport(makeMonth());
    expect(report.total_samples).toBeGreaterThan(0);
    expect(report.reporting_period.start).toBe("2026-07-01");
    expect(report.reporting_period.end).toBe("2026-07-30");
    expect(report.daily_signals.length).toBe(30);
  });

  it("recommends 'continue' when agreement stable ≥ 85 %", () => {
    const report = generateMonthlyReport(makeMonth({ agreement_rate: 0.87 }));
    expect(report.recommended_action).toBe("continue");
  });

  it("recommends 'rollback' when agreement drops below 72 %", () => {
    const signals = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeSignal({
          date: `2026-07-${String(i + 1).padStart(2, "0")}`,
          agreement_rate: 0.9,
        }),
      ),
      ...Array.from({ length: 20 }, (_, i) =>
        makeSignal({
          date: `2026-07-${String(i + 11).padStart(2, "0")}`,
          agreement_rate: 0.6,
        }),
      ),
    ];
    const report = generateMonthlyReport(signals);
    expect(report.recommended_action).toBe("rollback");
  });

  it("empty signal-set throws", () => {
    expect(() => generateMonthlyReport([])).toThrow();
  });

  it("distribution shift computed over month halves", () => {
    const signals = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeSignal({
          date: `2026-07-${String(i + 1).padStart(2, "0")}`,
          finding_category_counts: { dermatological: 20, vascular: 0 },
        }),
      ),
      ...Array.from({ length: 20 }, (_, i) =>
        makeSignal({
          date: `2026-07-${String(i + 11).padStart(2, "0")}`,
          finding_category_counts: { dermatological: 5, vascular: 15 },
        }),
      ),
    ];
    const report = generateMonthlyReport(signals);
    expect(report.finding_distribution_shift.dermatological).toBeLessThan(0);
    expect(report.finding_distribution_shift.vascular).toBeGreaterThan(0);
  });
});
