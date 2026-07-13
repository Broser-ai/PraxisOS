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

// ===========================================================================
// SHAPEDIVER (variant 4 graft) · Live validation (non-throwing, UI-oriented)
// ===========================================================================

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  /** Stable ID for test assertions and telemetry. */
  code: string;
  severity: ValidationSeverity;
  /** Keys involved — used to color the offending sliders. */
  keys: Array<keyof OrthoticParams>;
  /** Short Danish message shown to the clinician. */
  message: string;
};

const RANGE_TABLE: Array<[keyof OrthoticParams, number, number]> = [
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

/**
 * Pure function. Returns all constraint violations as structured issues.
 * Used by the UI to render error state without throwing. Server-side callers
 * must still use assertParamRanges() to hard-fail out-of-range writes.
 */
export function validateParams(p: OrthoticParams): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. INV-NC-3 range-check (soft — returns instead of throwing)
  for (const [key, lo, hi] of RANGE_TABLE) {
    const v = p[key] as number;
    if (!Number.isFinite(v) || v < lo || v > hi) {
      issues.push({
        code: "NC-3-range",
        severity: "error",
        keys: [key],
        message: `${key} = ${v} ligger uden for [${lo}, ${hi}]`,
      });
    }
  }

  // 2. Heel-cup depth vs. heel thickness (physical feasibility).
  if (p.heel_cup_depth_mm > p.heel_thickness_mm * 3) {
    issues.push({
      code: "NC-X-heelcup-vs-thickness",
      severity: "error",
      keys: ["heel_cup_depth_mm", "heel_thickness_mm"],
      message:
        "Hælkop-dybde overstiger 3× hæltykkelse — vælg dybere hæl eller lavere cup.",
    });
  }

  // 3. Shore-A: heel should be at least as firm as forefoot.
  if (p.shore_a_heel < p.shore_a_forefoot) {
    issues.push({
      code: "NC-X-shore-inversion",
      severity: "warning",
      keys: ["shore_a_heel", "shore_a_forefoot"],
      message:
        "Shore-A hæl er blødere end forfod — normalt anbefales fastere hæl.",
    });
  }

  // 4. Medial vs. lateral posting imbalance.
  const postingDiff = Math.abs(p.posting_medial_deg - p.posting_lateral_deg);
  if (postingDiff > 4) {
    issues.push({
      code: "NC-X-posting-imbalance",
      severity: "warning",
      keys: ["posting_medial_deg", "posting_lateral_deg"],
      message:
        "Stor posting-forskel (>4°) — vurdér om det er klinisk indiceret.",
    });
  }

  // 5. Recess zones need supporting thickness.
  if (p.plantar_recess_zones >= 3 && p.forefoot_thickness_mm < 4) {
    issues.push({
      code: "NC-X-recess-needs-thickness",
      severity: "error",
      keys: ["plantar_recess_zones", "forefoot_thickness_mm"],
      message:
        "≥3 recess-zoner kræver forfod-tykkelse ≥4 mm for at bevare integritet.",
    });
  }

  // 6. Hallux relief + 1st ray cutout must not destabilize.
  if (p.hallux_relief_mm + p.first_ray_cutout_mm > 10) {
    issues.push({
      code: "NC-X-first-ray-overload",
      severity: "warning",
      keys: ["hallux_relief_mm", "first_ray_cutout_mm"],
      message:
        "Samlet hallux + 1. stråle-fjernelse > 10 mm kan destabilisere forfoden.",
    });
  }

  // 7. Aggressive pronation correction without posting support.
  if (Math.abs(p.pronation_correction_deg) >= 4 && p.posting_medial_deg === 0) {
    issues.push({
      code: "NC-X-pronation-without-posting",
      severity: "warning",
      keys: ["pronation_correction_deg", "posting_medial_deg"],
      message:
        "Stærk pronation-korrektion uden medial posting — overvej at tilføje posting.",
    });
  }

  return issues;
}

/** True if there are no error-severity issues. Warnings do not block Save. */
export function isValid(p: OrthoticParams): boolean {
  return !validateParams(p).some((i) => i.severity === "error");
}
