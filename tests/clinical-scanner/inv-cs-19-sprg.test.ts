// INV-CS-19 · SPRG guardrails · Sprint 6 blocker B15
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §3.4
//           COMPLETE-AUDIT-REPORT.md §B15 (sprg-guardrails zero test coverage)
//
// Dækker de 6 SECURITY-FIXES fra sprg-guardrails.ts header + property-test.
// API-shapes verificeret mod lib/scanner/sprg-guardrails.ts 2026-07-12.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import {
  SPRG_UNVERIFIED_PENALTY,
  plausibleRegionsForLabel,
  mockAnatomicalEvidence,
  createMedSamAdapter,
  sprgVerify,
  assertInvCs19,
  type AnatomicalEvidence,
  type SprgVerdict,
} from "@/lib/scanner/sprg-guardrails";
import type { Finding } from "@/lib/scanner/findings-schema";

// -----------------------------------------------------------------------------
// Fixture helpers — bbox_2d er ABSOLUTTE pixel-koordinater med frame_index
// -----------------------------------------------------------------------------

function mkFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: overrides.id ?? "f_test_1",
    label: overrides.label ?? "Hallux valgus mild",
    confidence: overrides.confidence ?? 0.85,
    ai_generated: true,
    bbox_2d: overrides.bbox_2d ?? {
      frame_index: 0,
      x: 520,
      y: 230,
      w: 60,
      h: 80, // ligger inde i hallux-mock-boks (500,220,100,120)
    },
    icd_hint: "M20.1",
  } as unknown as Finding;
}

// -----------------------------------------------------------------------------
// SECURITY-FIX 1 · source-flag propageres til SprgVerdict
// -----------------------------------------------------------------------------

describe("INV-CS-19 · SECURITY-FIX 1 · matched_source propageres", () => {
  it("mock-evidence bærer source='None'", () => {
    const evidence = mockAnatomicalEvidence(0);
    expect(evidence.length).toBeGreaterThan(0);
    for (const ev of evidence) {
      expect(ev.source).toBe("None");
    }
  });

  it("SprgVerdict.matched_source er 'None' når mock-evidence matcher", () => {
    const evidence = mockAnatomicalEvidence(0);
    const finding = mkFinding({ label: "Hallux valgus" });
    const { verdicts } = sprgVerify([finding], evidence);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]!.matched_source).toBe("None");
  });
});

// -----------------------------------------------------------------------------
// SECURITY-FIX 2 · mock kun via PRAXIS_SPRG_ALLOW_MOCK=1 (uden test-env)
// -----------------------------------------------------------------------------

describe("INV-CS-19 · SECURITY-FIX 2 · mock-opt-in", () => {
  const originalAllow = process.env.PRAXIS_SPRG_ALLOW_MOCK;
  const originalNode = process.env.NODE_ENV;
  const originalMedSam = process.env.MEDSAM_URL;
  const originalVitest = process.env.VITEST;

  beforeEach(() => {
    // Simuler prod: fjern test-env markører så mockAllowed() går efter ALLOW_MOCK
    delete process.env.PRAXIS_SPRG_ALLOW_MOCK;
    delete process.env.MEDSAM_URL;
    delete process.env.VITEST;
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    if (originalAllow === undefined) delete process.env.PRAXIS_SPRG_ALLOW_MOCK;
    else process.env.PRAXIS_SPRG_ALLOW_MOCK = originalAllow;
    if (originalNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNode;
    if (originalMedSam === undefined) delete process.env.MEDSAM_URL;
    else process.env.MEDSAM_URL = originalMedSam;
    if (originalVitest === undefined) delete process.env.VITEST;
    else process.env.VITEST = originalVitest;
  });

  it("prod uden opt-in kaster ved segmentFrame() uden MEDSAM_URL", async () => {
    const adapter = createMedSamAdapter();
    await expect(adapter.segmentFrame("stub://frame/0", 0)).rejects.toThrow(
      /MEDSAM_URL|ALLOW_MOCK/i,
    );
  });

  it("prod MED opt-in bruger mock uden at kaste", async () => {
    process.env.PRAXIS_SPRG_ALLOW_MOCK = "1";
    const adapter = createMedSamAdapter();
    const result = await adapter.segmentFrame("stub://frame/0", 0);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.source).toBe("None");
  });
});

// -----------------------------------------------------------------------------
// SECURITY-FIX 3 · label→region mismatch afvises
// -----------------------------------------------------------------------------

describe("INV-CS-19 · SECURITY-FIX 3 · anatomisk grounding ≠ containment", () => {
  it("plausibleRegionsForLabel matcher hallux valgus → hallux+forefoot", () => {
    const regions = plausibleRegionsForLabel("Hallux valgus severe");
    expect(regions).toContain("hallux");
    expect(regions).toContain("forefoot");
  });

  it("plausibleRegionsForLabel matcher plantar fasciitis → heel+arch", () => {
    const regions = plausibleRegionsForLabel("plantar fasciitis chronic");
    expect(regions).toContain("heel");
    expect(regions).toContain("arch");
  });

  it("plausibleRegionsForLabel returnerer null for ukendt label", () => {
    expect(plausibleRegionsForLabel("Ukendt vævsforandring 42")).toBeNull();
  });

  it("hallux-valgus finding placeret INDE i heel-region → verdict verified=false + downgraded", () => {
    const evidence: AnatomicalEvidence[] = mockAnatomicalEvidence(0).filter(
      (e) => e.region_id === "heel",
    );
    const hallux = mkFinding({
      label: "Hallux valgus",
      // heel-mock-boks er (40,320,160,140) → læg bbox inde i den
      bbox_2d: { frame_index: 0, x: 60, y: 340, w: 40, h: 60 },
    });
    const { verdicts, findings } = sprgVerify([hallux], evidence);
    const v = verdicts[0]!;
    // Enten grounded=false (label mismatch) eller ingen match — begge → downgrade
    expect(v.verified).toBe(false);
    const expected = +(0.85 * SPRG_UNVERIFIED_PENALTY).toFixed(4);
    expect(findings[0]!.confidence).toBe(expected);
  });
});

// -----------------------------------------------------------------------------
// SECURITY-FIX 4 · INV-CS-19 assertion — verified=true skal kompilere fint
// -----------------------------------------------------------------------------

describe("INV-CS-19 · SECURITY-FIX 4 · assertInvCs19", () => {
  it("passerer når alle findings er verificerede", () => {
    const evidence = mockAnatomicalEvidence(0);
    const finding = mkFinding({ label: "Hallux valgus" });
    const original = [finding];
    const { verdicts } = sprgVerify([...original], evidence);
    expect(() => assertInvCs19(verdicts, original)).not.toThrow();
  });

  it("kaster hvis verified=false uden korrekt confidence-downgrade", () => {
    const original = [mkFinding({ confidence: 0.9 })];
    const badVerdicts: SprgVerdict[] = [
      {
        finding: { ...original[0]!, confidence: 0.9 }, // IKKE downgraded
        verified: false,
        matched_region_id: null,
        matched_source: null,
        reason: "fabricated for test",
      },
    ];
    expect(() => assertInvCs19(badVerdicts, original)).toThrow(/INV-CS-19/);
  });
});

// -----------------------------------------------------------------------------
// SECURITY-FIX 5 · no-bbox → automatic downgrade
// -----------------------------------------------------------------------------

describe("INV-CS-19 · SECURITY-FIX 5 · no-bbox path", () => {
  it("finding uden bbox_2d bliver verified=false og confidence-downgraded", () => {
    const noBox = { ...mkFinding({ confidence: 0.7 }), bbox_2d: undefined } as unknown as Finding;
    const evidence = mockAnatomicalEvidence(0);
    const { verdicts, findings } = sprgVerify([noBox], evidence);
    expect(verdicts[0]!.verified).toBe(false);
    expect(verdicts[0]!.reason).toMatch(/no bbox/i);
    const expected = +(0.7 * SPRG_UNVERIFIED_PENALTY).toFixed(4);
    expect(findings[0]!.confidence).toBe(expected);
  });
});

// -----------------------------------------------------------------------------
// Property test · SPRG er determineret + terminerer + har verdict-per-finding
// -----------------------------------------------------------------------------

describe("INV-CS-19 · property test · syntetiske findings", () => {
  it("sprgVerify returnerer verdicts.length === findings.length", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 8 }),
            label: fc.constantFrom(
              "Hallux valgus",
              "Plantar fasciitis",
              "Heel spur",
              "Metatarsalgia",
              "Ukendt fund",
            ),
            confidence: fc
              .integer({ min: 10, max: 100 })
              .map((n) => Math.fround(n / 100)),
            ai_generated: fc.constant(true),
            bbox_2d: fc.record({
              frame_index: fc.integer({ min: 0, max: 2 }),
              x: fc.integer({ min: 0, max: 600 }),
              y: fc.integer({ min: 0, max: 400 }),
              w: fc.integer({ min: 20, max: 200 }),
              h: fc.integer({ min: 20, max: 200 }),
            }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        (findings) => {
          const evidence = mockAnatomicalEvidence(0);
          const result = sprgVerify(findings as unknown as Finding[], evidence);
          expect(result.verdicts.length).toBe(findings.length);
          expect(result.findings.length).toBe(findings.length);
          // Assertion-invariant: assertInvCs19 må ikke kaste for eget output
          expect(() =>
            assertInvCs19(result.verdicts, findings as unknown as Finding[]),
          ).not.toThrow();
        },
      ),
      { numRuns: 50 },
    );
  });
});
