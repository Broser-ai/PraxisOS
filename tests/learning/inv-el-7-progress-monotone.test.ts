// INV-EL-7 progress monotone test
// Kontrakt: docs/harness/EPIC-4-ELearning.md §4

import { describe, it, expect } from "vitest";
import { assertProgressMonotone, generateLearningPath } from "@/lib/learning/path-generator";
import type { ScannerFindings } from "@/lib/scanner/findings-schema";

describe("INV-EL-7 · progress monotone growing", () => {
  it("(a) 0 → 25 OK", () => {
    expect(() => assertProgressMonotone(0, 25)).not.toThrow();
  });

  it("(b) 50 → 50 OK (idempotent)", () => {
    expect(() => assertProgressMonotone(50, 50)).not.toThrow();
  });

  it("(c) 75 → 50 kaster INV-EL-7", () => {
    expect(() => assertProgressMonotone(75, 50)).toThrow(/INV-EL-7/);
  });

  it("(d) 100 → 99 kaster", () => {
    expect(() => assertProgressMonotone(100, 99)).toThrow(/INV-EL-7/);
  });
});

describe("path generator sanity", () => {
  it("genererer sti fra hallux valgus finding", () => {
    const findings: ScannerFindings = {
      scan_id: "s1",
      vlm_model_version: "v1",
      ai_generated: true,
      confidence_overall: 0.8,
      findings: [
        {
          id: "f1",
          category: "biomechanical",
          label: "Mild hallux valgus",
          icd10_candidates: ["M20.1"],
          confidence: 0.85,
          severity: "low",
          ai_reasoning: "",
          escalation_needed: false,
          ai_generated: true,
        },
      ],
      overall_summary_da: "",
    };
    const path = generateLearningPath({
      findings,
      clientProfile: {},
      language: "da",
    });
    expect(path.steps.length).toBeGreaterThan(0);
    expect(path.language).toBe("da");
    // Skal indeholde hallux-valgus-basis artikel
    expect(path.steps.some((s) => s.content_id.includes("hallux"))).toBe(true);
  });

  it("diabetes-diagnose i klientprofil → diabetes-fodpleje-artikel", () => {
    const path = generateLearningPath({
      clientProfile: { knownDiagnoses: ["diabet type 2"] },
      language: "da",
    });
    expect(path.steps.some((s) => s.content_id.includes("diabet"))).toBe(true);
  });
});
