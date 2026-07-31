// Sprint 6 Batch 3 - Audit-completeness meta-test
// Kontrakt: COMPLETE-AUDIT-REPORT.md test-coverage every mutation-point emits
//
// Beviser at hver kendt klinisk/regulatorisk mutation-point emitter en
// audit_log-row. Dette er R-defense-in-depth: hvis et fremtidigt refactor
// fjerner et auditLog-kald, faelder DENNE test.

import { beforeEach, describe, expect, it } from "vitest";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { runPipeline } from "@/lib/scanner/pipeline";
import { createStubLifter, resetGpuBudget } from "@/lib/scanner/gpu-adapter";
import { createStubVlmCaller, type VlmCaller } from "@/lib/scanner/vlm-caller";
import { generateParams } from "@/lib/configurator/orthotic-generator";
import { runBiophysicalInversion } from "@/lib/configurator/biophysical-inversion";
import { enforceAiGenerated, type ScannerFindings } from "@/lib/scanner/findings-schema";
import { exportStl } from "@/lib/scanner/stl-export";
import { createStubMillAdapter } from "@/lib/orthotic/mill-adapter";
import { createStubEmbeddingsAdapter } from "@/lib/embeddings/adapter";
import { buildOrchestrator, type LLMCaller } from "@/lib/orchestrator";
import type { MeshLike } from "@/lib/scanner/watertight";
import type { AgentId } from "@/lib/agents";

const TENANT = "tenant-audit-complete-11111111-1111-1111-1111-111111111111";
const ACTOR = "user_audit_complete";

const WATERTIGHT_MESH: MeshLike = {
  vertices: [
    [0, 0, 0],
    [100, 0, 0],
    [50, 100, 0],
    [50, 50, 50],
  ],
  faces: [
    [0, 1, 2],
    [0, 3, 1],
    [0, 2, 3],
    [1, 3, 2],
  ],
};

const CLEAN_FINDINGS: ScannerFindings = enforceAiGenerated({
  scan_id: "scan_complete_1",
  vlm_model_version: "v1",
  ai_generated: true,
  confidence_overall: 0.8,
  findings: [
    {
      id: "f1",
      category: "biomechanical",
      label: "Hallux valgus mild",
      icd10_candidates: ["M20.1"],
      confidence: 0.85,
      severity: "low",
      ai_reasoning: "test",
      escalation_needed: false,
      ai_generated: true,
    },
  ],
  overall_summary_da: "test",
});

function makeRouteThenFinishStub(target: AgentId): LLMCaller {
  let routed = false;
  return async (input) => {
    if (input.jsonSchema) {
      if (!routed) {
        routed = true;
        return {
          content: JSON.stringify({ next: target, reason: "r" }),
          json: { next: target, reason: "r" },
          usage: { prompt: 1, completion: 1 },
        };
      }
      return {
        content: JSON.stringify({ next: "FINISH", reason: "done" }),
        json: { next: "FINISH", reason: "done" },
        usage: { prompt: 1, completion: 1 },
      };
    }
    return { content: "worker output", usage: { prompt: 1, completion: 1 } };
  };
}

function eventsInSink(): string[] {
  return _readMemorySink().map((r) => r.event);
}

beforeEach(async () => {
  _clearMemorySink();
  process.env.PRAXIS_AUDIT_MODE = "memory";
  await resetGpuBudget();
});

describe("Sprint 6 B3 - Audit-completeness - hver mutation-point emitter", () => {
  it("[scanner] scan.finalize + scan.findings.drafted emitteres paa happy path", async () => {
    const res = await runPipeline(
      { lifter: createStubLifter(), vlm: createStubVlmCaller() },
      {
        scanId: "scan_complete_finalize",
        tenantId: TENANT,
        framesUrl: "stub://frames/",
        framesCount: 20,
        calibrationMode: "monocular",
        clientContext: {},
        actorUserId: ACTOR,
      },
    );
    expect(res.status).toBe("done");
    const events = eventsInSink();
    expect(events, "scan.finalize skal emit").toContain("scan.finalize");
    expect(events, "scan.findings.drafted skal emit").toContain("scan.findings.drafted");
  });

  it("[scanner] scan.finalize.rejected emitteres ved INV-CS-1 non-watertight", async () => {
    const badLifter = async () => ({
      sparseCloudUrl: "stub://sparse/x.ply",
      denseMeshUrl: "stub://mesh/x.glb",
      mesh: {
        vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
        faces: [[0, 1, 2]],
      } as MeshLike,
      volumeMetrics: { lengthMm: 1, widthMm: 1, archHeightMm: 1, halluxValgusAngle: 0 },
      gpuSeconds: 0.1,
    });
    const res = await runPipeline(
      { lifter: badLifter, vlm: createStubVlmCaller() },
      {
        scanId: "scan_bad",
        tenantId: TENANT,
        framesUrl: "stub://",
        framesCount: 5,
        calibrationMode: "monocular",
        clientContext: {},
      },
    );
    expect(res.status).toBe("error");
    expect(eventsInSink()).toContain("scan.finalize.rejected");
  });

  it("[scanner] scan.finalize.error emitteres ved runtime-fejl (INV-CS-6 evil VLM)", async () => {
    const evilVlm: VlmCaller = async () => ({
      scan_id: "scan_evil_err",
      vlm_model_version: "evil",
      ai_generated: false,
      confidence_overall: 0.9,
      findings: [],
      overall_summary_da: "",
    }) as never;
    const res = await runPipeline(
      { lifter: createStubLifter(), vlm: evilVlm },
      {
        scanId: "scan_evil_err",
        tenantId: TENANT,
        framesUrl: "stub://",
        framesCount: 8,
        calibrationMode: "monocular",
        clientContext: {},
      },
    );
    expect(res.status).toBe("error");
    expect(eventsInSink()).toContain("scan.finalize.error");
  });

  it("[orchestrator] orchestrator.dispatch emitteres ved legit dispatch", async () => {
    const orch = buildOrchestrator({ llmCall: makeRouteThenFinishStub("aria") });
    await orch.invoke({
      tenantId: TENANT,
      actorRole: "owner",
      tenantMdrStatus: "ce_marked",
      origin: "api",
      messages: [{ role: "user", content: "book" }],
    });
    expect(eventsInSink()).toContain("orchestrator.dispatch");
  });

  it("[orchestrator] orchestrator.dispatch.denied emitteres paa INV-7 rolle-scope", async () => {
    const orch = buildOrchestrator({ llmCall: makeRouteThenFinishStub("niels") });
    const res = await orch.invoke({
      tenantId: TENANT,
      actorRole: "reception",
      tenantMdrStatus: "ce_marked",
      origin: "api",
      messages: [{ role: "user", content: "no access" }],
    });
    expect(res.status).toBe("error");
    const rows = _readMemorySink().filter((r) => r.event === "orchestrator.dispatch.denied");
    expect(rows.length).toBeGreaterThan(0);
    expect((rows[0]!.meta as Record<string, unknown>).reason).toContain("INV-7");
  });

  it("[orchestrator] orchestrator.dispatch.denied emitteres paa INV-CS-7 MDR-gate", async () => {
    const orch = buildOrchestrator({ llmCall: makeRouteThenFinishStub("liv") });
    const res = await orch.invoke({
      tenantId: TENANT,
      actorRole: "owner",
      tenantMdrStatus: "none",
      origin: "api",
      messages: [{ role: "user", content: "no mdr" }],
    });
    expect(res.status).toBe("error");
    const rows = _readMemorySink().filter((r) => r.event === "orchestrator.dispatch.denied");
    expect(rows.length).toBeGreaterThan(0);
    expect((rows[0]!.meta as Record<string, unknown>).reason).toContain("mdr_status");
  });

  it("[configurator] config.generate emitteres naar auditContext leveres", () => {
    const bp = runBiophysicalInversion({
      scanId: "s1",
      meshRegions: ["heel"],
      clientProfile: {},
    });
    generateParams({
      findings: CLEAN_FINDINGS,
      biophysical: bp,
      clientProfile: {},
      auditContext: { tenantId: TENANT, actorUserId: ACTOR, configId: "cfg_c1" },
    });
    expect(eventsInSink()).toContain("config.generate");
  });

  it("[orthotic] mill.submit emitteres ved stub-mill submit", async () => {
    const stl = exportStl({
      scanId: "scan_mill_c",
      tenantId: TENANT,
      mesh: WATERTIGHT_MESH,
      qualityScore: 0.9,
      featureCadExport: true,
      actorRole: "practitioner",
      practitionerTriggered: true,
      cadDpaAccepted: true,
    });
    expect(stl.ok).toBe(true);
    if (!stl.ok) return;
    _clearMemorySink();
    const mill = createStubMillAdapter("stub");
    const r = await mill.submit(stl.stlBytes, {
      config_id: "cfg_mill_complete",
      tenant_id: TENANT,
      patient_ref: "opaque",
      side: "left",
      material: {
        eva_shore_a_forefoot: 35,
        eva_shore_a_heel: 55,
        top_cover: "microfiber",
        thickness_forefoot_mm: 4,
        thickness_heel_mm: 8,
      },
      tolerance_mm: 0.2,
      practitioner_signoff: {
        user_id: ACTOR,
        initials: "AB",
        approved_at: new Date().toISOString(),
      },
      clinic_shipping_address_ref: "addr",
    });
    expect(r.status).toBe("accepted");
    expect(eventsInSink()).toContain("mill.submit");
  });

  it("[embeddings] embedding.generate emitteres naar audit-context leveres", async () => {
    const adapter = createStubEmbeddingsAdapter();
    await adapter.embed({
      text: "diabetisk saar plantar",
      audit: {
        tenantId: TENANT,
        actorUserId: ACTOR,
        corpus: "learning_content",
        targetId: "lc_ac_1",
      },
    });
    expect(eventsInSink()).toContain("embedding.generate");
  });

  it("[embeddings] embedding.generate emitteres IKKE uden audit-context (opt-in korrekthed)", async () => {
    const adapter = createStubEmbeddingsAdapter();
    await adapter.embed({ text: "silent" });
    expect(_readMemorySink().length).toBe(0);
  });

  it("[meta] enhver audit-row har tenant_id + level + event felter sat", () => {
    const bp = runBiophysicalInversion({
      scanId: "s_meta",
      meshRegions: ["heel"],
      clientProfile: {},
    });
    generateParams({
      findings: CLEAN_FINDINGS,
      biophysical: bp,
      clientProfile: {},
      auditContext: { tenantId: TENANT, actorUserId: ACTOR, configId: "cfg_meta" },
    });
    const rows = _readMemorySink();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(typeof r.event).toBe("string");
      expect(r.event.length).toBeGreaterThan(0);
      expect(["info", "warn", "error"]).toContain(r.level);
      expect(typeof r.ts).toBe("string");
      expect(r.tenant_id).toBe(TENANT);
    }
  });

  it("[meta] union af alle kendte mutation-events runtimes uden PII-leak", async () => {
    const bp = runBiophysicalInversion({
      scanId: "s_union",
      meshRegions: ["heel", "arch"],
      clientProfile: {},
    });
    generateParams({
      findings: CLEAN_FINDINGS,
      biophysical: bp,
      clientProfile: { knownDiagnoses: ["Patient 010190-1234 diabetes"] },
      auditContext: { tenantId: TENANT, actorUserId: ACTOR, configId: "cfg_union" },
    });
    await runPipeline(
      { lifter: createStubLifter(), vlm: createStubVlmCaller() },
      {
        scanId: "scan_union",
        tenantId: TENANT,
        framesUrl: "stub://",
        framesCount: 12,
        calibrationMode: "monocular",
        clientContext: { knownDiagnoses: ["Patient 010190-1234 diabetes"] },
        actorUserId: ACTOR,
      },
    );
    const orch = buildOrchestrator({ llmCall: makeRouteThenFinishStub("aria") });
    await orch.invoke({
      tenantId: TENANT,
      actorRole: "owner",
      tenantMdrStatus: "ce_marked",
      origin: "api",
      messages: [{ role: "user", content: "hi" }],
    });
    const dump = JSON.stringify(_readMemorySink());
    expect(dump).not.toContain("010190-1234");
    const events = new Set(_readMemorySink().map((r) => r.event));
    expect(events.has("config.generate")).toBe(true);
    expect(events.has("scan.finalize")).toBe(true);
    expect(events.has("scan.findings.drafted")).toBe(true);
    expect(events.has("orchestrator.dispatch")).toBe(true);
  });
});
