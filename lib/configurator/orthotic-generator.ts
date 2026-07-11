// Parametric orthotic generator.
// Kontrakt: docs/harness/EPIC-3-Neural-Configurator.md §4.2

import {
  orthoticParamsSchema,
  type OrthoticParams,
  type BiophysicalMap,
  type ClientProfile,
} from "./schema";
import type { ScannerFindings } from "../scanner/findings-schema";

export type GeneratorInput = {
  findings: ScannerFindings;
  biophysical: BiophysicalMap;
  clientProfile: ClientProfile;
};

/** Default midpoint parameters. */
export function defaultParams(): OrthoticParams {
  return orthoticParamsSchema.parse({
    heel_cup_depth_mm: 20,
    arch_support_height_mm: 15,
    metatarsal_pad_offset_mm: 0,
    medial_flare_deg: 4,
    lateral_flare_deg: 4,
    forefoot_thickness_mm: 4,
    heel_thickness_mm: 8,
    shore_a_forefoot: 35,
    shore_a_heel: 55,
    posting_medial_deg: 0,
    posting_lateral_deg: 0,
    hallux_relief_mm: 0,
    plantar_recess_zones: 0,
    toe_break_position_pct: 68,
    first_ray_cutout_mm: 0,
    pronation_correction_deg: 0,
  });
}

/**
 * Deterministisk mapping fra findings + biofysik + klient til parameter-vektor.
 * INV-NC-3 håndhæves ved final Zod-parse (clamps + range-check).
 */
export function generateParams(input: GeneratorInput): OrthoticParams {
  const p = { ...defaultParams() };

  // 1. Kliniske findings → parameter-nudges
  for (const f of input.findings.findings) {
    const label = f.label.toLowerCase();
    if (label.includes("hallux valgus") || label.includes("valgus")) {
      p.posting_medial_deg = clamp(p.posting_medial_deg + 2, 0, 8);
      p.hallux_relief_mm = clamp(p.hallux_relief_mm + 1, 0, 5);
    }
    if (label.includes("callus") || label.includes("hyperkerat")) {
      p.metatarsal_pad_offset_mm = clamp(p.metatarsal_pad_offset_mm + 3, -10, 15);
      p.shore_a_forefoot = clamp(p.shore_a_forefoot - 5, 20, 55);
    }
    if (label.includes("arch") || label.includes("pes planus")) {
      p.arch_support_height_mm = clamp(p.arch_support_height_mm + 5, 5, 30);
      p.pronation_correction_deg = clamp(p.pronation_correction_deg - 2, -6, 6);
    }
    if (label.includes("ulcer") || label.includes("saar") || label.includes("sår")) {
      p.plantar_recess_zones = clamp(p.plantar_recess_zones + 1, 0, 4);
      p.heel_thickness_mm = clamp(p.heel_thickness_mm - 1, 4, 15);
    }
  }

  // 2. Klient-profil (diabetes, aktivitet)
  const dx = (input.clientProfile.knownDiagnoses ?? []).join(" ").toLowerCase();
  if (dx.includes("diabet")) {
    p.plantar_recess_zones = clamp(p.plantar_recess_zones + 1, 0, 4);
    p.shore_a_forefoot = clamp(p.shore_a_forefoot - 5, 20, 55);
  }
  if (input.clientProfile.activityLevel === "high") {
    p.heel_thickness_mm = clamp(p.heel_thickness_mm + 1, 4, 15);
  }

  // 3. Biofysik: bruger overall_confidence som blødt smooth-factor
  const bpConfidence = input.biophysical.overall_confidence;
  if (bpConfidence < 0.5) {
    // Ved lav konfidens: fald tilbage til defaults for shore-værdier
    p.shore_a_forefoot = (p.shore_a_forefoot + 35) / 2;
    p.shore_a_heel = (p.shore_a_heel + 55) / 2;
  }

  // Final validation (INV-NC-3)
  return orthoticParamsSchema.parse(p);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
