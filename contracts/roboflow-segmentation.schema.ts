import { z } from "zod";

/**
 * Roboflow instance-segmentation / region response for foot isolation.
 * Normalized box fields match detection; optional polygon `points`.
 * Strict schemas.
 */

export const RoboflowPolygonPointSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .strict();

export const RoboflowSegmentationPredictionSchema = z
  .object({
    class: z.string().min(1),
    confidence: z.number().min(0).max(1),
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    points: z.array(RoboflowPolygonPointSchema).optional(),
  })
  .strict();

export const RoboflowSegmentationResponseSchema = z
  .object({
    time: z.number().optional(),
    image: z
      .object({
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .strict()
      .optional(),
    predictions: z.array(RoboflowSegmentationPredictionSchema),
  })
  .strict();

export type RoboflowSegmentationPrediction = z.infer<
  typeof RoboflowSegmentationPredictionSchema
>;
export type RoboflowSegmentationResponse = z.infer<
  typeof RoboflowSegmentationResponseSchema
>;

export function footDetectedFromSegmentation(
  res: RoboflowSegmentationResponse,
  minConfidence = 0.35,
): { detected: boolean; confidence: number } {
  const best = res.predictions.reduce(
    (max, p) => Math.max(max, p.confidence),
    0,
  );
  if (res.predictions.length === 0) {
    return { detected: false, confidence: 0 };
  }
  return {
    detected: best >= minConfidence,
    confidence: best,
  };
}

export function parseRoboflowSegmentation(
  data: unknown,
): RoboflowSegmentationResponse {
  return RoboflowSegmentationResponseSchema.parse(data);
}

export function safeParseRoboflowSegmentation(data: unknown) {
  return RoboflowSegmentationResponseSchema.safeParse(data);
}
