// FHIR repository · abstraction over Supabase for FHIR-endpoint HTTP-lag.
// Kontrakt: HUMANIZED-FRONTIER-BLUEPRINT §7.5 · STATE-OF-THE-ART §7.5
//
// PRINCIP:
//   HTTP-endpoints (app/api/fhir/R5/*) taler kun med dette repository.
//   Repository har to modes:
//     - live:  Supabase RLS-scope'd query (kræver tenant-context)
//     - stub:  In-memory determined mock til dev + tests
//   Auto-selection: hvis SUPABASE_SERVICE_ROLE_KEY mangler → stub

import type { ScannerFindingLike } from "./resource-mappers";

// ---------------------------------------------------------------------------
// Repository types (subset af interne domain-shapes)
// ---------------------------------------------------------------------------

export type ScanRecord = {
  id: string;
  tenant_id: string;
  client_id: string;
  encounter_id?: string;
  practitioner_id?: string;
  performed_at: string;    // ISO
  vlm_model_version?: string;
  overall_summary_da?: string;
  findings: ScannerFindingLike[];
  imaging_study_url?: string;
};

export type OrthoticConfigRecord = {
  id: string;
  tenant_id: string;
  client_id: string;
  encounter_id?: string;
  practitioner_id?: string;
  scan_id?: string;
  status: "draft" | "reviewed" | "locked" | "sent_to_lab" | "delivered";
  orthotic_params: Record<string, number>;
  authored_at: string;
};

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface FhirRepository {
  getScan(scanId: string, tenantId: string): Promise<ScanRecord | null>;
  getFinding(
    findingId: string,
    tenantId: string,
  ): Promise<{ scan: ScanRecord; finding: ScannerFindingLike } | null>;
  getOrthoticConfig(
    configId: string,
    tenantId: string,
  ): Promise<OrthoticConfigRecord | null>;
}

// ---------------------------------------------------------------------------
// Stub repository · deterministic samples til dev + tests
// ---------------------------------------------------------------------------

const STUB_SCANS: ScanRecord[] = [
  {
    id: "scan_stub_001",
    tenant_id: "bypilar",
    client_id: "client_stub_a",
    encounter_id: "enc_stub_001",
    practitioner_id: "prac_stub_pilar",
    performed_at: "2026-07-13T10:15:00Z",
    vlm_model_version: "claude-sonnet-5-2026-01",
    overall_summary_da:
      "[SPRG: 2/2 ROI-grounded] Mild hallux valgus + callus under 2. metatarsalhoved. Ingen tegn på ulceration.",
    findings: [
      {
        id: "finding_stub_a1",
        label: "Mild hallux valgus",
        category: "biomechanical",
        confidence: 0.87,
        bbox_2d: { frame_index: 0, x: 510, y: 240, w: 80, h: 90 },
        severity: "low",
        ai_reasoning: "Angle estimeret ~14°, under klinisk threshold for indgreb.",
        icd10_candidates: ["M20.1"],
        ai_generated: true,
      },
      {
        id: "finding_stub_a2",
        label: "Callus under 2. metatarsalhoved",
        category: "dermatological",
        confidence: 0.91,
        bbox_2d: { frame_index: 0, x: 380, y: 260, w: 60, h: 55 },
        severity: "low",
        ai_reasoning: "Hyperkeratose lokaliseret til MTH2, typisk for pes planus-relateret overload.",
        icd10_candidates: ["L84"],
        ai_generated: true,
      },
    ],
    imaging_study_url: "supabase://scans/mesh/scan_stub_001.glb",
  },
];

const STUB_CONFIGS: OrthoticConfigRecord[] = [
  {
    id: "config_stub_001",
    tenant_id: "bypilar",
    client_id: "client_stub_a",
    encounter_id: "enc_stub_001",
    practitioner_id: "prac_stub_pilar",
    scan_id: "scan_stub_001",
    status: "reviewed",
    orthotic_params: {
      heel_cup_depth_mm: 20,
      arch_support_height_mm: 18,
      metatarsal_pad_offset_mm: 3,
      medial_flare_deg: 4,
      lateral_flare_deg: 4,
      forefoot_thickness_mm: 4,
      heel_thickness_mm: 8,
      shore_a_forefoot: 32,
      shore_a_heel: 55,
      posting_medial_deg: 2,
      posting_lateral_deg: 0,
      hallux_relief_mm: 1,
      plantar_recess_zones: 1,
      toe_break_position_pct: 68,
      first_ray_cutout_mm: 0,
      pronation_correction_deg: -1,
    },
    authored_at: "2026-07-13T10:30:00Z",
  },
];

export function createStubRepository(): FhirRepository {
  return {
    async getScan(scanId, tenantId) {
      const scan = STUB_SCANS.find((s) => s.id === scanId && s.tenant_id === tenantId);
      return scan ?? null;
    },
    async getFinding(findingId, tenantId) {
      for (const scan of STUB_SCANS) {
        if (scan.tenant_id !== tenantId) continue;
        const finding = scan.findings.find((f) => f.id === findingId);
        if (finding) return { scan, finding };
      }
      return null;
    },
    async getOrthoticConfig(configId, tenantId) {
      const config = STUB_CONFIGS.find((c) => c.id === configId && c.tenant_id === tenantId);
      return config ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Live Supabase repository · placeholder
// ---------------------------------------------------------------------------

export function createLiveRepository(): FhirRepository {
  // Real impl bruger @supabase/supabase-js med RLS-scope pr. tenant.
  // Ikke wired op i dette scaffold — bruger stub.
  console.log(
    "[fhir/repository] Live Supabase mode not wired up in this scaffold — using stub",
  );
  return createStubRepository();
}

export function createDefaultRepository(): FhirRepository {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PRAXIS_DB === "mock") {
    return createStubRepository();
  }
  return createLiveRepository();
}
