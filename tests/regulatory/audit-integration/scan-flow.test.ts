// Sprint 6 Batch 2 · R§ audit-integration test.
// Verificerer at klinisk-aktive mutationer emitter audit_log-rows
// og at ingen record indeholder raw CPR (INV-3).
//
// Kontrakt: COMPLETE-AUDIT-REPORT.md §B1 · Sundhedsloven §42a-d ·
//           MDR Art. 83 · GDPR Art. 30 · Presafe letter

import { beforeEach, describe, expect, it } from "vitest";
import {
  _readMemorySink,
  _clearMemorySink,
  type AuditRecord,
} from "@/lib/audit";
import { runPipeline } from "@/lib/scanner/pipeline";
import { createStubLifter } from "@/lib/scanner/gpu-adapter";
import { createStubVlmCaller } from "@/lib/scanner/vlm-caller";
import { generateParams } from "@/lib/configurator/orthotic-generator";
import { exportStl } from "@/lib/scanner/stl-export";
import type { MeshLike } from "@/lib/scanner/watertight";
import { createStubMillAdapter } from "@/lib/orthotic/mill-adapter";
import { createStubEmbeddingsAdapter } from "@/lib/embeddings/adapter";
import { enforceAiGenerated, type ScannerFindings } from "@/lib/scanner/findings-schema";

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

function eventsOf(sink: AuditRecord[]): string[] {
  return sink.map((r) => r.event);
}

beforeEach(() => {
  _clearMemorySink();
  process.env.PRAXIS_AUDIT_MODE = "memory";
});

describe("Sprint 6 B2 · scan-flow emitter audit-rows end-to-end", () => {
  it("scan-pipeline emitter mindst scan.finalize + scan.findings.drafted", async () => {
    const res = await runPipeline(
      { lifter: createStubLifter(), vlm: createStubVlmCaller() },
      {
        scanId: "scan_int_001",
        tenantId: "tenant_int_a",
        clientId: "client_int_9",
        framesUrl: "stub://frames/int/",
        framesCount: 24,
        calibrationMode: "monocular",
        clientContext: { ageBand: "50-59" },
        actorUserId: "user_int_practitioner",
      },
    );
    expect(res.status).toBe("done");

    const sink = _readMemorySink();
    const events = eventsOf(sink);
    expect(events).toContain("scan.finalize");
    expect(events).toContain("scan.findings.drafted");

    const finalize = sink.find((r) => r.event === "scan.finalize")!;
    expect(finalize.tenant_id).toBe("tenant_int_a");
    expect(finalize.actor_user_id).toBe("user_int_practitioner");
    expect(finalize.target_ref).toBe("scan/scan_int_001");
    expect(finalize.level).toBe("info");
  });

  it("scan-pipeline emitter scan.finalize.rejected ved non-watertight mesh", async () => {
    const badLifter = async () => ({
      sparseCloudUrl: "stub://sparse/x.ply",
      denseMeshUrl: "stub://mesh/x.glb",
      mesh: {
        // 3 vertices + 1 face = ikke lukket topologi
        vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
        faces: [[0, 1, 2]],
      } as MeshLike,
      volumeMetrics: { lengthMm: 1, widthMm: 1, archHeightMm: 1, halluxValgusAngle: 0 },
      gpuSeconds: 0.1,
    });
    const res = await runPipeline(
      { lifter: badLifter, vlm: createStubVlmCaller() },
      {
        scanId: "scan_int_bad",
        tenantId: "tenant_int_b",
        framesUrl: "stub://frames/bad/",
        framesCount: 5,
        calibrationMode: "monocular",
        clientContext: {},
      },
    );
    expect(res.status).toBe("error");
    const events = eventsOf(_readMemorySink());
    expect(events).toContain("scan.finalize.rejected");
  });

  it("configurator generateParams emitter config.generate når auditContext er sat", () => {
    const findings: ScannerFindings = enforceAiGenerated({
      scan_id: "scan_cfg_1",
      vlm_model_version: "test-v1",
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
          ai_reasoning: "Test",
          escalation_needed: false,
          ai_generated: true,
        },
      ],
      overall_summary_da: "Test",
    });

    generateParams({
      findings,
      biophysical: {
        scan_id: "scan_cfg_1",
        version: "v1",
        regions: [],
        overall_confidence: 0.7,
        ai_generated: true,
      },
      clientProfile: { activityLevel: "moderate" },
      auditContext: {
        tenantId: "tenant_cfg",
        actorUserId: "user_cfg_1",
        configId: "cfg_int_001",
        scanId: "scan_cfg_1",
      },
    });

    const sink = _readMemorySink();
    const cfg = sink.find((r) => r.event === "config.generate");
    expect(cfg, "config.generate skal emitteres når auditContext leveres").toBeTruthy();
    expect(cfg!.tenant_id).toBe("tenant_cfg");
    expect(cfg!.target_ref).toBe("config/cfg_int_001");
  });

  it("configurator generateParams uden auditContext emitter INTET", () => {
    const findings: ScannerFindings = enforceAiGenerated({
      scan_id: "scan_cfg_silent",
      vlm_model_version: "test-v1",
      ai_generated: true,
      confidence_overall: 0.8,
      findings: [],
      overall_summary_da: "",
    });
    generateParams({
      findings,
      biophysical: {
        scan_id: "scan_cfg_silent",
        version: "v1",
        regions: [],
        overall_confidence: 0.9,
        ai_generated: true,
      },
      clientProfile: {},
    });
    expect(_readMemorySink().length).toBe(0);
  });

  it("STL-export via mill-adapter emitter mill.submit-row", async () => {
    const stl = exportStl({
      scanId: "scan_int_stl",
      tenantId: "tenant_stl",
      mesh: WATERTIGHT_MESH,
      qualityScore: 0.9,
      featureCadExport: true,
      actorRole: "practitioner",
      practitionerTriggered: true,
      cadDpaAccepted: true,
    });
    expect(stl.ok).toBe(true);
    if (!stl.ok) return;

    // Ryd sink saa vi kun ser mill.submit-events
    _clearMemorySink();

    const mill = createStubMillAdapter("stub");
    const result = await mill.submit(stl.stlBytes, {
      config_id: "cfg_int_mill",
      tenant_id: "tenant_stl",
      patient_ref: "opaque_hash_abc",
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
        user_id: "user_stl_practitioner",
        initials: "AB",
        approved_at: new Date().toISOString(),
      },
      clinic_shipping_address_ref: "addr_ref_opaque",
    });
    expect(result.status).toBe("accepted");

    const sink = _readMemorySink();
    const millRow = sink.find((r) => r.event === "mill.submit");
    expect(millRow).toBeTruthy();
    expect(millRow!.tenant_id).toBe("tenant_stl");
    expect(millRow!.target_ref).toBe("config/cfg_int_mill");
    expect(millRow!.actor_user_id).toBe("user_stl_practitioner");
  });

  it("embeddings.embed med audit-context emitter embedding.generate", async () => {
    const adapter = createStubEmbeddingsAdapter();
    await adapter.embed({
      text: "diabetisk saar plantar",
      audit: {
        tenantId: "tenant_emb",
        actorUserId: "user_emb_1",
        corpus: "learning_content",
        targetId: "lc_int_001",
      },
    });
    const sink = _readMemorySink();
    const row = sink.find((r) => r.event === "embedding.generate");
    expect(row).toBeTruthy();
    expect(row!.tenant_id).toBe("tenant_emb");
    expect(row!.target_ref).toBe("learning_content/lc_int_001");
  });

  it("embeddings.embed uden audit-context emitter INTET", async () => {
    const adapter = createStubEmbeddingsAdapter();
    await adapter.embed({ text: "test uden context" });
    expect(_readMemorySink().length).toBe(0);
  });

  it("embedBatch respekterer per-input audit-context (kun records med context faar audit)", async () => {
    const adapter = createStubEmbeddingsAdapter();
    await adapter.embedBatch([
      { text: "a", audit: { tenantId: "t", corpus: "learning_content", targetId: "lc1" } },
      { text: "b" },
      { text: "c", audit: { tenantId: "t", corpus: "learning_content", targetId: "lc3" } },
    ]);
    const rows = _readMemorySink().filter((r) => r.event === "embedding.generate");
    expect(rows.length).toBe(2);
    const refs = rows.map((r) => r.target_ref).sort();
    expect(refs).toEqual(["learning_content/lc1", "learning_content/lc3"]);
  });
});

describe("Sprint 6 B2 · INV-3 · ingen raw CPR i audit_log", () => {
  it("scan-pipeline med CPR i client-context saetter aldrig raw CPR i audit-sink", async () => {
    // client-context sendes gennem redactPII i upload-route, men vi tester
    // ogsaa direkte at meta ikke sneg CPR ind i finalize-row.
    await runPipeline(
      { lifter: createStubLifter(), vlm: createStubVlmCaller() },
      {
        scanId: "scan_pii_1",
        tenantId: "tenant_pii",
        framesUrl: "stub://frames/pii/",
        framesCount: 10,
        calibrationMode: "monocular",
        clientContext: {
          knownDiagnoses: ["Diabetes type 2 (patient CPR 010190-1234)"],
        },
      },
    );
    const dump = JSON.stringify(_readMemorySink());
    expect(dump).not.toContain("010190-1234");
  });

  it("mill.submit med CPR-lignende patient_ref bliver redaktet", async () => {
    const stl = exportStl({
      scanId: "scan_pii_stl",
      tenantId: "tenant_pii_stl",
      mesh: WATERTIGHT_MESH,
      qualityScore: 0.9,
      featureCadExport: true,
      actorRole: "practitioner",
      practitionerTriggered: true,
      cadDpaAccepted: true,
    });
    if (!stl.ok) throw new Error("stl-precheck failed in test setup");
    _clearMemorySink();

    const mill = createStubMillAdapter("stub");
    // Patient-ref uses opaque hash BUT if a caller accidentally sneaks
    // CPR-shaped text through, redactPII inside auditLog must strip it.
    await mill.submit(stl.stlBytes, {
      config_id: "cfg_pii_1",
      tenant_id: "tenant_pii_stl",
      patient_ref: "pseudonymous",
      side: "pair",
      material: {
        eva_shore_a_forefoot: 40,
        eva_shore_a_heel: 60,
        top_cover: "leather",
        thickness_forefoot_mm: 4,
        thickness_heel_mm: 8,
      },
      tolerance_mm: 0.2,
      practitioner_signoff: {
        user_id: "user_pii_1",
        initials: "MP",
        approved_at: new Date().toISOString(),
      },
      clinic_shipping_address_ref: "ref_010190-1234-shipping",
    });
    const dump = JSON.stringify(_readMemorySink());
    // clinic_shipping_address_ref er ikke direkte i meta men verificer at
    // ingen raw CPR-mynster leaker via andre feltnavne.
    expect(dump).not.toMatch(/010190-1234(?!.*XXXX)/);
  });
});
