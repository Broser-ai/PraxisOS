// Sprint 6 Batch 3 · Scanner pipeline INV-CS-6 integration test
// Kontrakt: COMPLETE-AUDIT-REPORT.md §test-coverage · full pipeline INV-CS-6
//
// End-to-end coverage af INV-CS-6 (alle findings MUST have ai_generated=true)
// gennem hele scanner pipeline med fake VLM callers der forsoeger at slippe
// non-ai-generated data ud.

import { beforeEach, describe, expect, it } from "vitest";
import { runPipeline } from "@/lib/scanner/pipeline";
import { createStubLifter, resetGpuBudget } from "@/lib/scanner/gpu-adapter";
import { createStubVlmCaller, wrapWithGuards, type VlmCaller } from "@/lib/scanner/vlm-caller";
import { enforceAiGenerated } from "@/lib/scanner/findings-schema";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { containsRawCpr } from "@/lib/redact";

const TENANT = "tenant-cs6-int-11111111-1111-1111-1111-111111111111";

beforeEach(async () => {
  _clearMemorySink();
  process.env.PRAXIS_AUDIT_MODE = "memory";
  await resetGpuBudget();
});

describe("Sprint 6 B3 · Full pipeline INV-CS-6 + audit-completeness", () => {
  it("(a) pipeline med clean stub VLM: findings har ai_generated=true + audit-events emitteres", async () => {
    const result = await runPipeline(
      { lifter: createStubLifter(), vlm: createStubVlmCaller() },
      {
        scanId: "scan_cs6_ok",
        tenantId: TENANT,
        framesUrl: "stub://frames/cs6_ok/",
        framesCount: 24,
        calibrationMode: "monocular",
        clientContext: { ageBand: "40-49" },
        actorUserId: "user_cs6_prac",
      },
    );
    expect(result.status).toBe("done");
    if (result.status !== "done") return;
    expect(result.findings.ai_generated).toBe(true);
    for (const f of result.findings.findings) {
      expect(f.ai_generated).toBe(true);
    }

    const sink = _readMemorySink();
    const finalize = sink.find((r) => r.event === "scan.finalize");
    const drafted = sink.find((r) => r.event === "scan.findings.drafted");
    expect(finalize, "scan.finalize MUST emit").toBeTruthy();
    expect(drafted, "scan.findings.drafted MUST emit").toBeTruthy();
    expect((drafted!.meta as Record<string, unknown>).ai_generated).toBe(true);
  });

  it("(b) VLM der returnerer top-level ai_generated=false → runtime-error + audit", async () => {
    const evilVlm: VlmCaller = async () =>
      ({
        scan_id: "scan_evil_1",
        vlm_model_version: "evil-v1",
        ai_generated: false,
        confidence_overall: 0.9,
        findings: [],
        overall_summary_da: "evil",
      }) as never;

    const guarded = wrapWithGuards(evilVlm);
    await expect(
      guarded({
        scanId: "scan_evil_1",
        frameUrls: [],
        meshUrl: "",
        volumeMetrics: {},
        clientContext: {},
      }),
    ).rejects.toThrow();

    _clearMemorySink();
    const res = await runPipeline(
      { lifter: createStubLifter(), vlm: evilVlm },
      {
        scanId: "scan_evil_pipeline",
        tenantId: TENANT,
        framesUrl: "stub://frames/evil/",
        framesCount: 10,
        calibrationMode: "monocular",
        clientContext: {},
        actorUserId: "user_x",
      },
    );
    expect(res.status).toBe("error");
    const err = _readMemorySink().find((r) => r.event === "scan.finalize.error");
    expect(err, "scan.finalize.error MUST emit paa INV-CS-6 violation").toBeTruthy();
    expect(err!.level).toBe("error");
  });

  it("(c) VLM der returnerer én finding med ai_generated=false → guarden throws", async () => {
    const partiallyEvilVlm: VlmCaller = async (input) =>
      ({
        scan_id: input.scanId,
        vlm_model_version: "partial-v1",
        ai_generated: true,
        confidence_overall: 0.8,
        findings: [
          {
            id: "f_evil",
            category: "biomechanical",
            label: "Hallux valgus",
            icd10_candidates: ["M20.1"],
            confidence: 0.85,
            severity: "low",
            ai_reasoning: "test",
            escalation_needed: false,
            ai_generated: false,
          },
        ],
        overall_summary_da: "test",
      }) as never;

    const guarded = wrapWithGuards(partiallyEvilVlm);
    await expect(
      guarded({
        scanId: "scan_partial",
        frameUrls: [],
        meshUrl: "",
        volumeMetrics: {},
        clientContext: {},
      }),
    ).rejects.toThrow(/INV-CS-6|ai_generated/);
  });

  it("(d) enforceAiGenerated haandhaever INV-CS-6 selv paa nesteret objekt", () => {
    expect(() =>
      enforceAiGenerated({
        scan_id: "s",
        vlm_model_version: "v",
        ai_generated: false,
        confidence_overall: 0.5,
        findings: [],
        overall_summary_da: "",
      }),
    ).toThrow();
  });

  it("(e) fuld pipeline med CPR i clientContext → INV-CS-11 redakt + INV-CS-6 preserved", async () => {
    const result = await runPipeline(
      { lifter: createStubLifter(), vlm: createStubVlmCaller() },
      {
        scanId: "scan_cs6_pii",
        tenantId: TENANT,
        framesUrl: "stub://frames/pii/",
        framesCount: 15,
        calibrationMode: "monocular",
        clientContext: {
          ageBand: "30-39",
          knownDiagnoses: ["Diabetes noteret paa CPR 010190-1234"],
        },
        actorUserId: "user_pii",
      },
    );
    expect(result.status).toBe("done");
    if (result.status !== "done") return;
    expect(result.findings.ai_generated).toBe(true);
    for (const f of result.findings.findings) expect(f.ai_generated).toBe(true);
    expect(containsRawCpr(result.findings)).toBe(false);
    const dump = JSON.stringify(_readMemorySink());
    expect(dump).not.toContain("010190-1234");
  });

  it("(f) audit-events for én scan-koersel har PRAeCIS forventet event-set", async () => {
    await runPipeline(
      { lifter: createStubLifter(), vlm: createStubVlmCaller() },
      {
        scanId: "scan_cs6_events",
        tenantId: TENANT,
        framesUrl: "stub://frames/events/",
        framesCount: 20,
        calibrationMode: "aruco",
        clientContext: {},
        actorUserId: "user_ev",
      },
    );
    const events = _readMemorySink().map((r) => r.event).sort();
    expect(events).toEqual(["scan.finalize", "scan.findings.drafted"]);
  });
});
