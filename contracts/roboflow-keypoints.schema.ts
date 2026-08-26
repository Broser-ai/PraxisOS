import { z } from "zod";

/**
 * Roboflow keypoint-detection response — parsed separately from detection.
 * Nested keypoints use { x, y, class_name, class_id, confidence }.
 * Strict schemas. Invisible/low-confidence points must not be invented downstream.
 */

export const RoboflowNestedKeypointSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    class_name: z.string().min(1),
    class_id: z.number().int(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const RoboflowKeypointsPredictionSchema = z
  .object({
    class: z.string().min(1),
    confidence: z.number().min(0).max(1),
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    keypoints: z.array(RoboflowNestedKeypointSchema),
  })
  .strict();

export const RoboflowKeypointsResponseSchema = z
  .object({
    time: z.number().optional(),
    image: z
      .object({
        width: z.number().positive(),
        height: z.number().positive(),
      })
      .strict()
      .optional(),
    predictions: z.array(RoboflowKeypointsPredictionSchema),
  })
  .strict();

export type RoboflowNestedKeypoint = z.infer<typeof RoboflowNestedKeypointSchema>;
export type RoboflowKeypointsPrediction = z.infer<
  typeof RoboflowKeypointsPredictionSchema
>;
export type RoboflowKeypointsResponse = z.infer<
  typeof RoboflowKeypointsResponseSchema
>;

const KEYPOINT_MIN_CONFIDENCE = 0.25;

export function isKeypointObservable(kp: RoboflowNestedKeypoint): boolean {
  return kp.confidence >= KEYPOINT_MIN_CONFIDENCE;
}

export function parseRoboflowKeypoints(data: unknown): RoboflowKeypointsResponse {
  return RoboflowKeypointsResponseSchema.parse(data);
}

export function safeParseRoboflowKeypoints(data: unknown) {
  return RoboflowKeypointsResponseSchema.safeParse(data);
}
