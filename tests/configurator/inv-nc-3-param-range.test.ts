// INV-NC-3 parameter-range test
// Kontrakt: docs/harness/EPIC-3-Neural-Configurator.md §6

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { generateParams, defaultParams } from "@/lib/configurator/orthotic-generator";
import { assertParamRanges } from "@/lib/configurator/constraints";
import { runBiophysicalInversion } from "@/lib/configurator/biophysical-inversion";
import type { ScannerFindings } from "@/lib/scanner/findings-schema";

describe("INV-NC-3 · alle 16 parametre altid inden for range", () => {
  it("(a) defaultParams passer alle constraints", () => {
    expect(() => assertParamRanges(defaultParams())).not.toThrow();
  });

  it("(b) generateParams med tomme findings → default-tæt vektor", () => {
    const findings: ScannerFindings = {
      scan_id: "s1",
      vlm_model_version: "v1",
      ai_generated: true,
      confidence_overall: 0.8,
      findings: [],
      overall_summary_da: "",
    };
    const bp = runBiophysicalInversion({
      scanId: "s1",
      meshRegions: ["heel", "arch", "forefoot"],
      clientProfile: {},
    });
    const p = generateParams({ findings, biophysical: bp, clientProfile: {} });
    expect(() => assertParamRanges(p)).not.toThrow();
  });

  it("(c) property-based · 200 syntetiske findings-sæt → parametre altid valid", async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }),
            category: fc.constantFrom("dermatological", "biomechanical", "vascular", "other"),
            label: fc.constantFrom(
              "hallux valgus",
              "callus",
              "arch drop",
              "diabetisk ulcer",
              "generic finding",
            ),
            icd10_candidates: fc.constant([]),
            confidence: fc.double({ min: 0.5, max: 1, noNaN: true }),
            severity: fc.constantFrom("low", "medium", "high"),
            ai_reasoning: fc.string(),
            escalation_needed: fc.boolean(),
            ai_generated: fc.constant(true as const),
          }),
          { maxLength: 8 },
        ),
        fc.record({
          ageBand: fc.constantFrom("20-29", "40-49", "70-79", undefined),
          activityLevel: fc.constantFrom("low", "moderate", "high", undefined),
          knownDiagnoses: fc.constantFrom(["diabet type 2"], ["hypertension"], [], undefined),
        }),
        (findingsArray, profile) => {
          const findings: ScannerFindings = {
            scan_id: "s1",
            vlm_model_version: "v1",
            ai_generated: true,
            confidence_overall: 0.75,
            findings: findingsArray as ScannerFindings["findings"],
            overall_summary_da: "",
          };
          const bp = runBiophysicalInversion({
            scanId: "s1",
            meshRegions: ["heel", "arch", "forefoot", "hallux"],
            clientProfile: profile,
          });
          const p = generateParams({ findings, biophysical: bp, clientProfile: profile });
          // Aldrig throw
          expect(() => assertParamRanges(p)).not.toThrow();
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("(d) extreme findings-input clamps til range (ingen leak over max)", () => {
    // Simulerer VLM der returnerer masser af hallux valgus + callus + arch — worst-case for clamping
    const findings: ScannerFindings = {
      scan_id: "s1",
      vlm_model_version: "v1",
      ai_generated: true,
      confidence_overall: 0.9,
      findings: Array.from({ length: 20 }, (_, i) => ({
        id: `f${i}`,
        category: "biomechanical" as const,
        label: i % 3 === 0 ? "hallux valgus" : i % 3 === 1 ? "callus" : "arch drop",
        icd10_candidates: [],
        confidence: 0.9,
        severity: "high" as const,
        ai_reasoning: "",
        escalation_needed: false,
        ai_generated: true as const,
      })),
      overall_summary_da: "",
    };
    const bp = runBiophysicalInversion({
      scanId: "s1",
      meshRegions: ["heel", "arch", "forefoot"],
      clientProfile: { activityLevel: "high" },
    });
    const p = generateParams({ findings, biophysical: bp, clientProfile: { activityLevel: "high" } });
    expect(() => assertParamRanges(p)).not.toThrow();
    expect(p.posting_medial_deg).toBeLessThanOrEqual(8);
    expect(p.metatarsal_pad_offset_mm).toBeLessThanOrEqual(15);
    expect(p.arch_support_height_mm).toBeLessThanOrEqual(30);
  });
});
