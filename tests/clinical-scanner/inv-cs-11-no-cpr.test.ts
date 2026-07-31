// INV-CS-11 no-CPR-in-scanner-runs test
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §6.3

import { describe, it, expect } from "vitest";
import { wrapWithGuards, createStubVlmCaller } from "@/lib/scanner/vlm-caller";
import { runPipeline } from "@/lib/scanner/pipeline";
import { createStubLifter, resetGpuBudget } from "@/lib/scanner/gpu-adapter";
import { containsRawCpr } from "@/lib/redact";

describe("INV-CS-11 · ingen råt CPR i scanner pipeline", () => {
  it("(a) wrapWithGuards redagterer CPR i clientContext før VLM-kald", async () => {
    let seenClientContext: unknown;
    const spyCaller = async (input: {
      clientContext: unknown;
      [k: string]: unknown;
    }) => {
      seenClientContext = input.clientContext;
      return createStubVlmCaller()(input as never);
    };
    const guarded = wrapWithGuards(spyCaller);
    await guarded({
      scanId: "s1",
      frameUrls: [],
      meshUrl: "",
      volumeMetrics: {},
      clientContext: {
        knownDiagnoses: ["Patient 010190-1234 har diabetes"],
      } as never,
    });
    expect(containsRawCpr(seenClientContext)).toBe(false);
  });

  it("(b) fuld pipeline stripper CPR fra input og output", async () => {
    await resetGpuBudget();
    const result = await runPipeline(
      { lifter: createStubLifter(), vlm: createStubVlmCaller() },
      {
        scanId: "s1",
        tenantId: "test-tenant-11111111-1111-1111-1111-111111111111",
        framesUrl: "stub://frames/s1/",
        framesCount: 24,
        calibrationMode: "monocular",
        clientContext: {
          ageBand: "40-49",
          sex: "F",
          knownDiagnoses: ["Diabetes noteret på 010190-1234 CPR-lookup"],
        },
      },
    );
    expect(result.status).toBe("done");
    if (result.status === "done") {
      // Findings og pipeline output må aldrig indeholde råt CPR
      expect(containsRawCpr(result.findings)).toBe(false);
    }
  });

  it("(c) direkte CPR i finding-reasoning ville blive fanget", () => {
    // Adversarial test: hvis en fremtidig VLM-caller kom med CPR i reasoning,
    // så ville findings-schema selv IKKE fange det (kun ai_generated).
    // Derfor er redaktion ANSVARET af wrapWithGuards + INV-CS-11 DB-CHECK.
    // Denne test dokumenterer den ansvarsdeling.
    const cprInReasoning = { ai_reasoning: "Klient 010190-1234 har..." };
    expect(containsRawCpr(cprInReasoning)).toBe(true);
    // → DB-CHECK constraint på scans/scanner_runs stopper det i persistens
  });
});
