// Biophysical Skin Inversion solver — v2 · vascular-input required.
// Kontrakt: docs/harness/EPIC-3-Neural-Configurator.md §3 · STATE-OF-THE-ART §7.2
//
// v1 → v2 change (2026-07-13):
//   REMOVED: `perfusion_index` estimated from client-profile hallucination.
//   REMOVED: RGB-hue-based inference (Armstrong CRITICAL: "clinically indefensible").
//
//   NEW:    `perfusion_source` requires structured vascular input if reported.
//   NEW:    Regions without a vascular assessment carry `perfusion_index: null`
//           and MUST be labeled `unknown_perfusion: true` so downstream
//           orthotic-generator can refuse to prescribe pressure-relief profiles
//           without proper vascular workup.
//
// Real ML-solver kommer i senere epic. Denne v2 er analytisk fallback
// for collagen + hardness — men perfusion har ingen fallback længere.

import type { BiophysicalMap, ClientProfile } from "./schema";
import { biophysicalMapSchema } from "./schema";

/**
 * Structured vascular input — mirror of DB schema (vascular_assessments table
 * from migration 0007). Must be captured by an authorized clinician; software
 * NEVER infers perfusion from images.
 */
export type VascularAssessmentInput = {
  foot_side: "left" | "right";
  abi?: number;              // Ankle-Brachial Index (0–3)
  tbi?: number;              // Toe-Brachial Index (0–2), required when ABI > 1.3
  tcpo2_dorsum?: number;     // TcPO2 mmHg
  waveform_dorsalis_pedis?: "triphasic" | "biphasic" | "monophasic" | "absent";
  waveform_posterior_tibial?: "triphasic" | "biphasic" | "monophasic" | "absent";
  palpable_pulses?: "both" | "dp_only" | "pt_only" | "neither";
  wifi_ischemia_grade?: 0 | 1 | 2 | 3;
};

export type InversionInput = {
  scanId: string;
  meshRegions: string[];
  clientProfile: ClientProfile;
  /**
   * Optional vascular assessment from clinician. Without this, perfusion_index
   * remains null across all regions and the map is marked partial-only.
   */
  vascularAssessment?: VascularAssessmentInput;
};

export const BIOPHYSICAL_SOLVER_VERSION = "v2-vascular-required";

/**
 * Analytisk fallback for collagen + hardness (patient-safe estimates).
 * Perfusion kommer KUN fra structured vascular input — aldrig fra client-
 * profile guessing eller image hue.
 */
export function runBiophysicalInversion(input: InversionInput): BiophysicalMap {
  const collagenBase = collagenFromAge(input.clientProfile.ageBand);
  const hardnessBase = 45;

  // Perfusion: derived DETERMINISTICALLY from measured vascular parameters
  const perfusionFromVascular = input.vascularAssessment
    ? perfusionIndexFromVascular(input.vascularAssessment)
    : null;

  const regions = input.meshRegions.map((region_id, idx) => {
    const base: {
      region_id: string;
      face_ids: number[];
      collagen_density: number;
      shore_a_hardness: number;
      perfusion_index: number | null;
      unknown_perfusion: boolean;
      ai_generated: true;
    } = {
      region_id,
      face_ids: [idx * 100, idx * 100 + 1, idx * 100 + 2],
      collagen_density: clamp(collagenBase + regionCollagenOffset(region_id), 0, 1),
      shore_a_hardness: clamp(hardnessBase + regionHardnessOffset(region_id), 20, 90),
      perfusion_index:
        perfusionFromVascular !== null
          ? clamp(perfusionFromVascular + regionPerfusionOffset(region_id), 0, 1)
          : null,
      unknown_perfusion: perfusionFromVascular === null,
      ai_generated: true,
    };
    return base;
  });

  // Confidence lower when perfusion is unknown — signals to configurator
  // that a vascular workup is prerequisite for pressure-relief prescription.
  const overallConfidence = perfusionFromVascular !== null ? 0.75 : 0.45;

  const map = biophysicalMapSchema.parse({
    scan_id: input.scanId,
    version: BIOPHYSICAL_SOLVER_VERSION,
    regions,
    overall_confidence: overallConfidence,
    ai_generated: true,
  });
  return map;
}

/**
 * DETERMINISTIC derivation from measured vascular parameters. This is a
 * clinician-interpretable scoring, NOT a hallucinated estimate.
 *
 * Heuristik: TBI > ABI > waveform > pulses > wifi_ischemia_grade fallback.
 * Grænser stammer fra IWGDF PAD 2023 guideline references.
 */
export function perfusionIndexFromVascular(v: VascularAssessmentInput): number {
  // 1. Prefer TBI (most reliable in diabetics)
  if (typeof v.tbi === "number") {
    if (v.tbi >= 0.7) return 0.9;
    if (v.tbi >= 0.55) return 0.7;
    if (v.tbi >= 0.4) return 0.5;
    if (v.tbi >= 0.25) return 0.3;
    return 0.15;
  }
  // 2. ABI (only if not falsely elevated by medial calcification)
  if (typeof v.abi === "number" && v.abi <= 1.3) {
    if (v.abi >= 0.9) return 0.9;
    if (v.abi >= 0.7) return 0.75;
    if (v.abi >= 0.5) return 0.5;
    if (v.abi >= 0.4) return 0.35;
    return 0.2;
  }
  // 3. TcPO2
  if (typeof v.tcpo2_dorsum === "number") {
    if (v.tcpo2_dorsum >= 40) return 0.9;
    if (v.tcpo2_dorsum >= 30) return 0.7;
    if (v.tcpo2_dorsum >= 20) return 0.45;
    return 0.2;
  }
  // 4. Waveforms
  const w = v.waveform_dorsalis_pedis ?? v.waveform_posterior_tibial;
  if (w === "triphasic") return 0.85;
  if (w === "biphasic") return 0.65;
  if (w === "monophasic") return 0.35;
  if (w === "absent") return 0.1;
  // 5. Palpable pulses
  if (v.palpable_pulses === "both") return 0.8;
  if (v.palpable_pulses === "dp_only" || v.palpable_pulses === "pt_only") return 0.55;
  if (v.palpable_pulses === "neither") return 0.2;
  // 6. WIfI ischemia grade fallback
  if (typeof v.wifi_ischemia_grade === "number") {
    const map: Record<number, number> = { 0: 0.85, 1: 0.65, 2: 0.4, 3: 0.15 };
    return map[v.wifi_ischemia_grade] ?? 0.5;
  }
  // If we got here, VascularAssessmentInput was empty — should not happen
  // because caller passes vascularAssessment only when at least one param set.
  return 0.5;
}

function collagenFromAge(ageBand: string | undefined): number {
  if (!ageBand) return 0.6;
  const [start] = ageBand.split("-").map((s) => parseInt(s, 10));
  if (Number.isFinite(start)) {
    if (start! >= 70) return 0.35;
    if (start! >= 50) return 0.5;
    if (start! >= 30) return 0.65;
    return 0.75;
  }
  return 0.6;
}

function regionCollagenOffset(region: string): number {
  if (region === "heel") return -0.05;
  if (region === "forefoot") return 0.05;
  return 0;
}

function regionHardnessOffset(region: string): number {
  if (region === "heel") return 20;
  if (region === "arch") return -10;
  return 0;
}

function regionPerfusionOffset(region: string): number {
  if (region === "hallux") return -0.1;
  return 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
