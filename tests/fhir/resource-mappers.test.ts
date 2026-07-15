// FHIR R5 resource-mapper tests
// Kontrakt: STATE-OF-THE-ART §7.5

import { describe, it, expect } from "vitest";
import {
  mapFindingToObservation,
  mapScanSessionToDiagnosticReport,
  mapOrthoticConfigToDeviceRequest,
  SNOMED_FOOT_FINDINGS,
  SNOMED_SYSTEM,
  ICD10_SYSTEM,
  type ScannerFindingLike,
} from "@/lib/fhir/resource-mappers";

const sampleFinding: ScannerFindingLike = {
  id: "finding_001",
  label: "Mild hallux valgus",
  category: "biomechanical",
  confidence: 0.87,
  bbox_2d: { frame_index: 0, x: 510, y: 240, w: 80, h: 90 },
  severity: "low",
  ai_reasoning: "Angle estimeret ~14°.",
  icd10_candidates: ["M20.1"],
  ai_generated: true,
};

describe("mapFindingToObservation", () => {
  it("returns Observation with resourceType + status='preliminary'", () => {
    const obs = mapFindingToObservation({
      finding: sampleFinding,
      patientId: "client_a",
      vlmModelVersion: "claude-sonnet-5-2026-01",
    });
    expect(obs.resourceType).toBe("Observation");
    expect(obs.status).toBe("preliminary");
    expect(obs.id).toBe("finding_001");
    expect(obs.subject.reference).toBe("Patient/client_a");
  });

  it("SNOMED code is used as primary coding when label matches", () => {
    const obs = mapFindingToObservation({
      finding: sampleFinding,
      patientId: "client_a",
    });
    const snomedEntry = obs.code.coding.find((c) => c.system === SNOMED_SYSTEM);
    expect(snomedEntry?.code).toBe(SNOMED_FOOT_FINDINGS.hallux_valgus!.code);
  });

  it("ICD-10 codes added as secondary coding", () => {
    const obs = mapFindingToObservation({
      finding: sampleFinding,
      patientId: "client_a",
    });
    const icd = obs.code.coding.find((c) => c.system === ICD10_SYSTEM);
    expect(icd?.code).toBe("M20.1");
  });

  it("AI provenance extensions carry ai_generated + confidence + model version", () => {
    const obs = mapFindingToObservation({
      finding: sampleFinding,
      patientId: "client_a",
      vlmModelVersion: "claude-sonnet-5-2026-01",
    });
    const exts = obs.extension ?? [];
    const aiGen = exts.find((e) => e.url.endsWith("ai-generated"));
    const aiConf = exts.find((e) => e.url.endsWith("ai-confidence"));
    const aiModel = exts.find((e) => e.url.endsWith("ai-model-version"));
    expect(aiGen?.valueBoolean).toBe(true);
    expect(aiConf?.valueDecimal).toBe(0.87);
    expect(aiModel?.valueString).toBe("claude-sonnet-5-2026-01");
  });

  it("no SNOMED-match falls back to text-only code", () => {
    const obs = mapFindingToObservation({
      finding: {
        ...sampleFinding,
        label: "Unmatched-label-xyz",
        icd10_candidates: undefined,
      },
      patientId: "client_a",
    });
    expect(obs.code.coding.length).toBe(0);
    expect(obs.code.text).toBe("Unmatched-label-xyz");
  });
});

describe("mapScanSessionToDiagnosticReport", () => {
  it("aggregates finding-ids as Observation references", () => {
    const report = mapScanSessionToDiagnosticReport({
      scanId: "scan_001",
      patientId: "client_a",
      findingIds: ["finding_001", "finding_002"],
      overallSummary: "Mild hallux valgus + callus MTH2.",
    });
    expect(report.resourceType).toBe("DiagnosticReport");
    expect(report.result?.length).toBe(2);
    expect(report.result?.[0]?.reference).toBe("Observation/finding_001");
    expect(report.conclusion).toContain("hallux valgus");
  });
});

describe("mapOrthoticConfigToDeviceRequest", () => {
  it("returns DeviceRequest with parameter per 16-vektor field", () => {
    const request = mapOrthoticConfigToDeviceRequest({
      configurationId: "config_001",
      patientId: "client_a",
      orthoticParams: {
        heel_cup_depth_mm: 20,
        arch_support_height_mm: 15,
        forefoot_thickness_mm: 4,
        shore_a_heel: 55,
      },
      status: "draft",
    });
    expect(request.resourceType).toBe("DeviceRequest");
    expect(request.status).toBe("draft");
    expect(request.intent).toBe("proposal");
    expect(request.parameter?.length).toBe(4);
    const heelCup = request.parameter?.find(
      (p) => p.code.coding[0]?.code === "heel_cup_depth_mm",
    );
    expect(heelCup?.valueQuantity?.value).toBe(20);
    expect(heelCup?.valueQuantity?.unit).toBe("mm");
  });
});

describe("SNOMED refset · Sprint 3 expansion", () => {
  it("catalog has at least 60 curated concepts", () => {
    expect(Object.keys(SNOMED_FOOT_FINDINGS).length).toBeGreaterThanOrEqual(60);
  });

  it("all codes use SNOMED CT system URI", () => {
    for (const [key, coding] of Object.entries(SNOMED_FOOT_FINDINGS)) {
      expect(coding.system).toBe(SNOMED_SYSTEM);
      expect(coding.code).toMatch(/^\d+$/);
      expect(coding.display).toBeTruthy();
    }
  });
});
