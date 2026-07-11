// INV-NC-* runtime validators for Neural Configurator.
// Kontrakt: docs/harness/EPIC-3-Neural-Configurator.md §6

import type { OrthoticParams, ConfigurationStatus, BiophysicalMap } from "./schema";
import { isLocked } from "./schema";

/**
 * INV-NC-1: parameter-vektor må aldrig muteres efter status='locked'.
 * Kaster hvis caller forsøger at ændre parametre på låst config.
 */
export function assertMutable(currentStatus: ConfigurationStatus): void {
  if (isLocked(currentStatus)) {
    throw new Error(
      `INV-NC-1 violation: cannot mutate params when status='${currentStatus}'`,
    );
  }
}

/**
 * INV-NC-2: biofysical_map skal have ai_generated=true.
 */
export function assertBiophysicalAiGenerated(map: BiophysicalMap | null | undefined): void {
  if (!map) return;
  if (map.ai_generated !== true) {
    throw new Error("INV-NC-2 violation: biophysical_map missing ai_generated=true");
  }
  for (const r of map.regions) {
    if (r.ai_generated !== true) {
      throw new Error(
        `INV-NC-2 violation: biophysical region ${r.region_id} missing ai_generated`,
      );
    }
  }
}

/**
 * INV-NC-4: sent_to_lab kræver approval.
 */
export function assertApprovalForLab(input: {
  newStatus: ConfigurationStatus;
  approvedBy: string | null;
  approvedAt: string | null;
}): void {
  if (input.newStatus === "sent_to_lab" && (!input.approvedBy || !input.approvedAt)) {
    throw new Error(
      "INV-NC-4 violation: sent_to_lab requires approved_by and approved_at",
    );
  }
}

/**
 * INV-NC-3 range-check for hånd (ud over Zod).
 * Bruges når Zod ikke er tilgængelig i migration-agtige kontekster.
 */
export function assertParamRanges(p: OrthoticParams): void {
  const checks: Array<[keyof OrthoticParams, number, number]> = [
    ["heel_cup_depth_mm", 10, 35],
    ["arch_support_height_mm", 5, 30],
    ["metatarsal_pad_offset_mm", -10, 15],
    ["medial_flare_deg", 0, 12],
    ["lateral_flare_deg", 0, 12],
    ["forefoot_thickness_mm", 2, 8],
    ["heel_thickness_mm", 4, 15],
    ["shore_a_forefoot", 20, 55],
    ["shore_a_heel", 40, 75],
    ["posting_medial_deg", 0, 8],
    ["posting_lateral_deg", 0, 8],
    ["hallux_relief_mm", 0, 5],
    ["plantar_recess_zones", 0, 4],
    ["toe_break_position_pct", 60, 75],
    ["first_ray_cutout_mm", 0, 8],
    ["pronation_correction_deg", -6, 6],
  ];
  for (const [key, lo, hi] of checks) {
    const v = p[key] as number;
    if (!Number.isFinite(v) || v < lo || v > hi) {
      throw new Error(`INV-NC-3 violation: ${key}=${v} outside [${lo}, ${hi}]`);
    }
  }
}
