// INV-CS-6 ai_generated håndhævelse test
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §6.2

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { enforceAiGenerated } from "@/lib/scanner/findings-schema";
import { createStubVlmCaller, wrapWithGuards } from "@/lib/scanner/vlm-caller";

describe("INV-CS-6 · alle findings SKAL være ai_generated", () => {
  it("(a) stub VLM caller returnerer ai_generated=true", async () => {
    const caller = createStubVlmCaller();
    const out = await caller({
      scanId: "s1",
      frameUrls: [],
      meshUrl: "stub://mesh/s1.glb",
      volumeMetrics: {},
      clientContext: {},
    });
    expect(out.ai_generated).toBe(true);
    for (const f of out.findings) expect(f.ai_generated).toBe(true);
  });

  it("(b) enforceAiGenerated throws hvis top-level ai_generated mangler", () => {
    expect(() =>
      enforceAiGenerated({
        scan_id: "s1",
        vlm_model_version: "v1",
        confidence_overall: 0.5,
        findings: [],
        overall_summary_da: "",
      } as unknown),
    ).not.toThrow(); // default(true) sætter det automatisk

    expect(() =>
      enforceAiGenerated({
        scan_id: "s1",
        vlm_model_version: "v1",
        ai_generated: false, // falsk værdi
        confidence_overall: 0.5,
        findings: [],
        overall_summary_da: "",
      } as unknown),
    ).toThrow();
  });

  it("(c) enforceAiGenerated throws hvis en enkelt finding mangler flag", () => {
    expect(() =>
      enforceAiGenerated({
        scan_id: "s1",
        vlm_model_version: "v1",
        ai_generated: true,
        confidence_overall: 0.8,
        findings: [
          {
            id: "f1",
            category: "biomechanical",
            label: "test",
            icd10_candidates: [],
            confidence: 0.9,
            severity: "low",
            ai_reasoning: "test",
            escalation_needed: false,
            ai_generated: false,
          },
        ],
        overall_summary_da: "",
      } as unknown),
    ).toThrow();
  });

  it("(d) property-based · 100 syntetiske findings-arrays → ai_generated altid enforced", async () => {
    await fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            category: fc.constantFrom("dermatological", "biomechanical", "vascular", "other"),
            label: fc.string({ minLength: 1, maxLength: 100 }),
            icd10_candidates: fc.array(fc.string({ maxLength: 10 }), { maxLength: 5 }),
            confidence: fc.double({ min: 0, max: 1, noNaN: true }),
            severity: fc.constantFrom("low", "medium", "high"),
            ai_reasoning: fc.string({ maxLength: 500 }),
            escalation_needed: fc.boolean(),
          }),
          { minLength: 0, maxLength: 10 },
        ),
        (findings) => {
          // Default(true) skal automatisk sætte ai_generated
          const validated = enforceAiGenerated({
            scan_id: "s1",
            vlm_model_version: "v1",
            confidence_overall: 0.5,
            findings,
            overall_summary_da: "",
          });
          for (const f of validated.findings) {
            expect(f.ai_generated).toBe(true);
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("(e) wrapWithGuards fanger raw VLM der forsøger at slippe ai_generated=false ud", async () => {
    const evilCaller = async () =>
      ({
        scan_id: "s1",
        vlm_model_version: "v1",
        ai_generated: false, // evil
        confidence_overall: 0.9,
        findings: [],
        overall_summary_da: "",
      }) as never;
    const guarded = wrapWithGuards(evilCaller);
    await expect(
      guarded({
        scanId: "s1",
        frameUrls: [],
        meshUrl: "",
        volumeMetrics: {},
        clientContext: {},
      }),
    ).rejects.toThrow();
  });
});
