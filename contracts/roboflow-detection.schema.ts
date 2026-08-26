import { z } from "zod";

/**
 * Roboflow object-detection response → normalized downstream contract:
 * { class, confidence, x, y, width, height }
 *
 * Strict: unknown keys rejected. Candidate findings only — not diagnosis.
 */

export const RoboflowDetectionPredictionSchema = z
  .object({
    class: z.string().min(1),
    confidence: z.number().min(0).max(1),
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  })
  .strict();

export const RoboflowDetectionResponseSchema = z
  .object({
    time: z.number().optional(),
    image: z
      .object({
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .strict()
      .optional(),
    predictions: z.array(RoboflowDetectionPredictionSchema),
  })
  .strict();

export type RoboflowDetectionPrediction = z.infer<
  typeof RoboflowDetectionPredictionSchema
>;
export type RoboflowDetectionResponse = z.infer<
  typeof RoboflowDetectionResponseSchema
>;

/** Kliniker-sikkert label — aldrig «ulcer detected». */
export function detectionClinicianCopy(
  pred: RoboflowDetectionPrediction,
): string {
  return `Kandidatområde registreret (${pred.class}, ${Math.round(pred.confidence * 100)}%); kræver kliniker-review.`;
}

export function parseRoboflowDetection(
  data: unknown,
): RoboflowDetectionResponse {
  return RoboflowDetectionResponseSchema.parse(data);
}

export function safeParseRoboflowDetection(data: unknown) {
  return RoboflowDetectionResponseSchema.safeParse(data);
}
