// Zod schemas for Adaptive E-Learning.
// Kontrakt: docs/harness/EPIC-4-ELearning.md §2, §4

import { z } from "zod";

export const languageSchema = z.enum(["da", "en"]);
export type Language = z.infer<typeof languageSchema>;

export const learningContentSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  body_md: z.string().min(1),
  tags: z.array(z.string()).default([]),
  source_url: z.string().url().min(8),   // INV-EL-2
  language: languageSchema.default("da"),
});
export type LearningContent = z.infer<typeof learningContentSchema>;

export const pathStepSchema = z.object({
  content_id: z.string(),
  order: z.number().int().min(0),
  status: z.enum(["pending", "in_progress", "done"]),
  completed_at: z.string().optional(),
});
export type PathStep = z.infer<typeof pathStepSchema>;

export const learningPathSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  client_id: z.string().optional(),
  scan_id: z.string().optional(),
  steps: z.array(pathStepSchema),
  progress_pct: z.number().min(0).max(100),
  status: z.enum(["active", "paused", "completed", "archived"]),
  language: languageSchema,
});
export type LearningPath = z.infer<typeof learningPathSchema>;

export const reflexionScoreSchema = z.object({
  factual_accuracy: z.number().min(0).max(1),
  evidence_citation: z.number().min(0).max(1),
  language_accessibility: z.number().min(0).max(1),
  client_relevance: z.number().min(0).max(1),
});
export type ReflexionScore = z.infer<typeof reflexionScoreSchema>;

export function meanScore(s: ReflexionScore): number {
  return (
    (s.factual_accuracy + s.evidence_citation + s.language_accessibility + s.client_relevance) / 4
  );
}
