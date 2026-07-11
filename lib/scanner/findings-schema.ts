// Zod-schema for VLM findings (INV-CS-6).
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §3.2

import { z } from "zod";

export const findingCategorySchema = z.enum([
  "dermatological",
  "biomechanical",
  "vascular",
  "other",
]);

export const findingSeveritySchema = z.enum(["low", "medium", "high"]);

export const bbox2dSchema = z.object({
  frame_index: z.number().int().min(0),
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().positive(),
  h: z.number().positive(),
});

export const bbox3dSchema = z.object({
  face_ids: z.array(z.number().int().nonnegative()),
});

export const findingSchema = z.object({
  id: z.string(),
  category: findingCategorySchema,
  label: z.string().min(1).max(200),
  icd10_candidates: z.array(z.string()).max(10),
  confidence: z.number().min(0).max(1),
  bbox_2d: bbox2dSchema.optional(),
  bbox_3d: bbox3dSchema.optional(),
  severity: findingSeveritySchema,
  ai_reasoning: z.string().max(2000),
  differential_diagnoses: z.array(z.string()).max(10).optional(),
  escalation_needed: z.boolean(),
  // INV-CS-6: håndhævet via default(true) + .refine
  ai_generated: z.literal(true).default(true),
});

export const scannerFindingsSchema = z.object({
  scan_id: z.string(),
  vlm_model_version: z.string().min(1),
  ai_generated: z.literal(true).default(true),
  confidence_overall: z.number().min(0).max(1),
  findings: z.array(findingSchema),
  overall_summary_da: z.string().max(4000),
});

export type Finding = z.infer<typeof findingSchema>;
export type ScannerFindings = z.infer<typeof scannerFindingsSchema>;

/**
 * INV-CS-6 verifier — refuses to accept findings uden ai_generated=true.
 * Returnerer clean findings ellers throwed.
 */
export function enforceAiGenerated(payload: unknown): ScannerFindings {
  const parsed = scannerFindingsSchema.parse(payload);
  for (const f of parsed.findings) {
    if (f.ai_generated !== true) {
      throw new Error(`INV-CS-6 violation: finding ${f.id} not marked ai_generated`);
    }
  }
  if (parsed.ai_generated !== true) {
    throw new Error("INV-CS-6 violation: scannerFindings.ai_generated must be true");
  }
  return parsed;
}
