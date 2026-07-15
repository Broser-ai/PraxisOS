// Marker-less gait analysis · pose-estimation types.
// Kontrakt: STATE-OF-THE-ART §9 Sprint 4 · HUMANIZED-FRONTIER §Motion
// Basis: MediaPipe Pose (33-keypoint) + DeepLabCut kompatibilitet.

import { z } from "zod";

// ---------------------------------------------------------------------------
// MediaPipe Pose 33-keypoint model (subset til gait: lower-body)
// ---------------------------------------------------------------------------

export const MEDIAPIPE_POSE_LANDMARK_IDS = {
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,   // storetå
  RIGHT_FOOT_INDEX: 32,
} as const;

export type PoseLandmarkId = (typeof MEDIAPIPE_POSE_LANDMARK_IDS)[keyof typeof MEDIAPIPE_POSE_LANDMARK_IDS];

export const landmarkSchema = z.object({
  id: z.number().int().min(0).max(32),
  x: z.number(),          // normalized 0..1 image-coord
  y: z.number(),          // normalized 0..1 image-coord
  z: z.number(),          // relative depth (MediaPipe z-approximation)
  visibility: z.number().min(0).max(1),   // per-joint confidence
});
export type Landmark = z.infer<typeof landmarkSchema>;

export const poseFrameSchema = z.object({
  frame_index: z.number().int().nonnegative(),
  timestamp_ms: z.number().nonnegative(),
  landmarks: z.array(landmarkSchema),
  world_scale_mm_per_pixel: z.number().positive().optional(),  // fra kalibrering
});
export type PoseFrame = z.infer<typeof poseFrameSchema>;

// ---------------------------------------------------------------------------
// Extractor interface
// ---------------------------------------------------------------------------

export type PoseExtractorConfig = {
  targetFps: number;              // downsample video til denne fps
  minLandmarkConfidence: number;  // filter joints med visibility < threshold
  smoothingWindow?: number;       // rolling-median smoothing (frames)
};

export interface PoseExtractor {
  extract(videoUrl: string, config: PoseExtractorConfig): Promise<PoseFrame[]>;
}

// ---------------------------------------------------------------------------
// Sample scripted data (til stub + tests)
// ---------------------------------------------------------------------------

/**
 * Generate deterministic scripted walking-pattern for tests.
 * Simulerer patient der går fra venstre til højre foran kameraet, 4 skridt.
 */
export function makeSyntheticWalkingSequence(
  frameCount: number,
  fps = 30,
): PoseFrame[] {
  const out: PoseFrame[] = [];
  const cadenceHz = 1.7;   // ~102 steps/min · normalt gang-tempo
  for (let i = 0; i < frameCount; i++) {
    const t = i / fps;
    const phase = Math.sin(t * cadenceHz * Math.PI * 2);
    const legPhase = Math.cos(t * cadenceHz * Math.PI);
    out.push({
      frame_index: i,
      timestamp_ms: (i / fps) * 1000,
      landmarks: [
        // Hips (venstre + højre) — oscillate slightly vertical
        {
          id: MEDIAPIPE_POSE_LANDMARK_IDS.LEFT_HIP,
          x: 0.48,
          y: 0.55 + phase * 0.005,
          z: 0,
          visibility: 0.95,
        },
        {
          id: MEDIAPIPE_POSE_LANDMARK_IDS.RIGHT_HIP,
          x: 0.52,
          y: 0.55 + phase * 0.005,
          z: 0,
          visibility: 0.95,
        },
        // Knees — swing forward/backward opposite to hips
        {
          id: MEDIAPIPE_POSE_LANDMARK_IDS.LEFT_KNEE,
          x: 0.47 + legPhase * 0.03,
          y: 0.72,
          z: 0,
          visibility: 0.92,
        },
        {
          id: MEDIAPIPE_POSE_LANDMARK_IDS.RIGHT_KNEE,
          x: 0.53 - legPhase * 0.03,
          y: 0.72,
          z: 0,
          visibility: 0.92,
        },
        // Ankles + heels (ground contact toggles per leg)
        {
          id: MEDIAPIPE_POSE_LANDMARK_IDS.LEFT_ANKLE,
          x: 0.46 + legPhase * 0.04,
          y: 0.9,
          z: 0,
          visibility: 0.9,
        },
        {
          id: MEDIAPIPE_POSE_LANDMARK_IDS.RIGHT_ANKLE,
          x: 0.54 - legPhase * 0.04,
          y: 0.9,
          z: 0,
          visibility: 0.9,
        },
        {
          id: MEDIAPIPE_POSE_LANDMARK_IDS.LEFT_HEEL,
          x: 0.46 + legPhase * 0.04,
          y: 0.94 - Math.max(0, legPhase) * 0.03,
          z: 0,
          visibility: 0.88,
        },
        {
          id: MEDIAPIPE_POSE_LANDMARK_IDS.RIGHT_HEEL,
          x: 0.54 - legPhase * 0.04,
          y: 0.94 - Math.max(0, -legPhase) * 0.03,
          z: 0,
          visibility: 0.88,
        },
        {
          id: MEDIAPIPE_POSE_LANDMARK_IDS.LEFT_FOOT_INDEX,
          x: 0.45 + legPhase * 0.04,
          y: 0.96 - Math.max(0, legPhase) * 0.03,
          z: 0,
          visibility: 0.85,
        },
        {
          id: MEDIAPIPE_POSE_LANDMARK_IDS.RIGHT_FOOT_INDEX,
          x: 0.55 - legPhase * 0.04,
          y: 0.96 - Math.max(0, -legPhase) * 0.03,
          z: 0,
          visibility: 0.85,
        },
      ],
      world_scale_mm_per_pixel: 3.5,   // ~3.5mm per normalized-pixel-unit
    });
  }
  return out;
}
