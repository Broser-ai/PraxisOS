// Zod-schemas for Neural Configurator.
// Kontrakt: docs/harness/EPIC-3-Neural-Configurator.md §4.1

import { z } from "zod";

// INV-NC-3: alle 16 parametre med eksplicit range
export const orthoticParamsSchema = z.object({
  heel_cup_depth_mm: z.number().min(10).max(35),
  arch_support_height_mm: z.number().min(5).max(30),
  metatarsal_pad_offset_mm: z.number().min(-10).max(15),
  medial_flare_deg: z.number().min(0).max(12),
  lateral_flare_deg: z.number().min(0).max(12),
  forefoot_thickness_mm: z.number().min(2).max(8),
  heel_thickness_mm: z.number().min(4).max(15),
  shore_a_forefoot: z.number().min(20).max(55),
  shore_a_heel: z.number().min(40).max(75),
  posting_medial_deg: z.number().min(0).max(8),
  posting_lateral_deg: z.number().min(0).max(8),
  hallux_relief_mm: z.number().min(0).max(5),
  plantar_recess_zones: z.number().int().min(0).max(4),
  toe_break_position_pct: z.number().min(60).max(75),
  first_ray_cutout_mm: z.number().min(0).max(8),
  pronation_correction_deg: z.number().min(-6).max(6),
});

export type OrthoticParams = z.infer<typeof orthoticParamsSchema>;

export const biophysicalRegionSchema = z.object({
  region_id: z.string(),
  face_ids: z.array(z.number().int().nonnegative()),
  collagen_density: z.number().min(0).max(1),
  shore_a_hardness: z.number().min(20).max(90),
  /**
   * perfusion_index MUST be null when no clinician-captured vascular
   * assessment exists. Software NEVER infers perfusion from images
   * (Armstrong CRITICAL · migration 0007 vascular_assessments table).
   */
  perfusion_index: z.number().min(0).max(1).nullable(),
  unknown_perfusion: z.boolean().default(false),
  ai_generated: z.literal(true).default(true),
});

export const biophysicalMapSchema = z.object({
  scan_id: z.string(),
  version: z.string(),
  regions: z.array(biophysicalRegionSchema),
  overall_confidence: z.number().min(0).max(1),
  ai_generated: z.literal(true).default(true),
});

export type BiophysicalMap = z.infer<typeof biophysicalMapSchema>;

export const clientProfileSchema = z.object({
  ageBand: z.string().optional(),
  sex: z.enum(["M", "F", "other"]).optional(),
  weightKg: z.number().positive().optional(),
  activityLevel: z.enum(["low", "moderate", "high"]).optional(),
  knownDiagnoses: z.array(z.string()).optional(),
});

export type ClientProfile = z.infer<typeof clientProfileSchema>;

export const configurationStatusSchema = z.enum([
  "draft",
  "reviewed",
  "locked",
  "sent_to_lab",
  "delivered",
]);

export type ConfigurationStatus = z.infer<typeof configurationStatusSchema>;

/**
 * INV-NC-1 helper: en låst konfiguration (`locked`, `sent_to_lab`, `delivered`)
 * må aldrig få sin parameter-vektor muteret.
 */
export function isLocked(status: ConfigurationStatus): boolean {
  return status === "locked" || status === "sent_to_lab" || status === "delivered";
}
