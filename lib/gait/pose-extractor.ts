// Marker-less pose extractor · MediaPipe Pose (browser) + fallback stub.
// Kontrakt: HUMANIZED-FRONTIER §Native motion platform · Prof. Mathis DeepLabCut
//
// PRINCIP:
//   Server-side stub returnerer scripted walking-sekvens (tests + dev).
//   Client-side MediaPipe kører via @mediapipe/pose i browseren (Sprint 5).
//   Adapter-interface holder så orchestrator ikke skal ændres.

import type {
  PoseExtractor,
  PoseExtractorConfig,
  PoseFrame,
} from "./pose-types";
import { makeSyntheticWalkingSequence } from "./pose-types";

// ---------------------------------------------------------------------------
// Stub extractor · deterministic walking-sequence
// ---------------------------------------------------------------------------

export function createStubPoseExtractor(): PoseExtractor {
  return {
    async extract(_videoUrl, config): Promise<PoseFrame[]> {
      // 6 sekunders scripted gang · ~10 hele skridt
      const frameCount = config.targetFps * 6;
      const raw = makeSyntheticWalkingSequence(frameCount, config.targetFps);
      return applyConfidenceFilter(raw, config.minLandmarkConfidence);
    },
  };
}

// ---------------------------------------------------------------------------
// MediaPipe extractor · placeholder (real impl kræver @mediapipe/pose)
// ---------------------------------------------------------------------------

export function createLiveMediaPipeExtractor(): PoseExtractor {
  return {
    async extract(videoUrl, config): Promise<PoseFrame[]> {
      if (!process.env.MEDIAPIPE_ENABLED) {
        console.log(
          `[gait] MediaPipe not enabled (MEDIAPIPE_ENABLED unset) · falling back to stub for ${videoUrl}`,
        );
        return createStubPoseExtractor().extract(videoUrl, config);
      }
      // Real impl: kør @mediapipe/pose i browser (client-side hydration)
      // eller Python-worker med mediapipe-python (server-side).
      // Adapter-interface bevaret så orchestrator ikke ændres.
      console.log(
        `[gait] MediaPipe live extractor not wired in this scaffold · using stub`,
      );
      return createStubPoseExtractor().extract(videoUrl, config);
    },
  };
}

export function createDefaultPoseExtractor(): PoseExtractor {
  if (!process.env.MEDIAPIPE_ENABLED || process.env.PRAXIS_GAIT_MODE === "stub") {
    return createStubPoseExtractor();
  }
  return createLiveMediaPipeExtractor();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Filtrér frames med low-visibility landmarks. Frames hvor kritiske joints
 * (ankles/heels) har visibility under threshold droppes helt.
 */
export function applyConfidenceFilter(
  frames: PoseFrame[],
  minConfidence: number,
): PoseFrame[] {
  return frames.filter((f) => {
    const critical = [27, 28, 29, 30]; // LEFT_ANKLE, RIGHT_ANKLE, LEFT_HEEL, RIGHT_HEEL
    return critical.every((id) => {
      const lm = f.landmarks.find((l) => l.id === id);
      return lm && lm.visibility >= minConfidence;
    });
  });
}
