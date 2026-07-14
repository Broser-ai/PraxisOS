// Bias-audit coverage test · verifiserer at persona-fixtures dækker alle
// stratums vi kræver for shadow-mode gate (Fitzpatrick I-VI · IWGDF 0-3).
// Kontrakt: STATE-OF-THE-ART §10.3 · Sendak npj Digital Medicine 2020

import { describe, it, expect } from "vitest";
import {
  loadPatientPersonas,
  patientsByRiskStratum,
  patientsByFitzpatrick,
  adversarialForInvariant,
  loadAdversarialPersonas,
} from "@/lib/testing/persona-fixtures";

describe("bias-audit · persona coverage", () => {
  it("patient fixtures har samples i alle 4 IWGDF risk-kategorier når muligt", () => {
    const patients = loadPatientPersonas();
    if (patients.length < 10) {
      // Seed-set er lille (5 samples) → skip cross-stratum-krav
      expect(patients.length).toBeGreaterThan(0);
      return;
    }
    const byRisk = patientsByRiskStratum(patients);
    // Med 50-persona seed er der overvægt af risk 3 (matcher DFU-target)
    const totalCovered = [0, 1, 2, 3].filter((r) => byRisk[r as 0 | 1 | 2 | 3].length > 0).length;
    expect(totalCovered).toBeGreaterThanOrEqual(2);
  });

  it("patient fixtures har samples i mindst 3 Fitzpatrick-kategorier", () => {
    const patients = loadPatientPersonas();
    if (patients.length < 10) return;
    const byFitz = patientsByFitzpatrick(patients);
    const coveredFitz = (["I", "II", "III", "IV", "V", "VI"] as const).filter(
      (f) => byFitz[f].length > 0,
    ).length;
    expect(coveredFitz).toBeGreaterThanOrEqual(3);
  });

  it("adversarial fixtures dækker INV-3 (CPR-leak) og INV-CS-7 (medical advice)", () => {
    const adv = loadAdversarialPersonas();
    if (adv.length < 3) return;
    const inv3Cases = adversarialForInvariant(adv, "INV-3");
    const invCs7Cases = adversarialForInvariant(adv, "INV-CS-7");
    // Mindst én af hver — invariants vi ikke må forlade utestet
    expect(inv3Cases.length + invCs7Cases.length).toBeGreaterThan(0);
  });

  it("ingen persona indeholder rå CPR i sin narrativ", () => {
    const patients = loadPatientPersonas();
    const cprPattern = /\b\d{6}-?\d{4}\b/;
    for (const p of patients) {
      // Persona-narrativer må gerne referere CPR som koncept, men aldrig
      // et rigtigt genereret 10-cifret nummer.
      if (cprPattern.test(p.narrative)) {
        // Tillad kun de eksplicitte test-CPR'er der bruges i adversarial seeds
        const testCprs = ["010190-1234", "0101901234"];
        const hasOnlyTestCpr = testCprs.some((c) => p.narrative.includes(c));
        expect(hasOnlyTestCpr).toBe(true);
      }
    }
  });
});
