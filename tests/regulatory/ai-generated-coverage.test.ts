// C9 · INV-CS-6 ai_generated marker på tutor + gait
// Kontrakt: samme invariant som lib/scanner/findings-schema.ts §INV-CS-6,
// udvidet til Adaptive E-Learning tutor-output og gait-metrics.
//
// Beviser at BEGGE output-overflader eksplicit markerer ai_generated: true,
// så downstream (audit, UI, regulatory export) aldrig kan forveksle
// algoritme/AI-genereret indhold med klinikerens eget input.

import { describe, it, expect } from "vitest";
import {
  runReflexionLoop,
  createStubTutor,
  createHighScoreReflexion,
  createNeverAcceptReflexion,
} from "@/lib/learning/reflexion-tutor";
import { computeGaitMetrics } from "@/lib/gait/gait-metrics";
import { makeSyntheticWalkingSequence } from "@/lib/gait/pose-types";

describe("INV-CS-6 · tutor-output er markeret ai_generated", () => {
  it("accepteret output (iteration 1) har ai_generated === true", async () => {
    const result = await runReflexionLoop(
      createStubTutor(),
      createHighScoreReflexion(),
      {
        clientQuery: "Hvad er hallux valgus?",
        retrievedContent: [],
        language: "da",
      },
    );
    expect(result.final.ai_generated).toBe(true);
  });

  it("output efter max-iterations (aldrig accepteret) har stadig ai_generated === true", async () => {
    const result = await runReflexionLoop(
      createStubTutor(),
      createNeverAcceptReflexion(),
      {
        clientQuery: "Hvad er en callus?",
        retrievedContent: [],
        language: "da",
      },
    );
    expect(result.final.ai_generated).toBe(true);
  });
});

describe("INV-CS-6 · gait-metrics er markeret ai_generated", () => {
  it("computeGaitMetrics() output har ai_generated === true", () => {
    const frames = makeSyntheticWalkingSequence(180, 30);
    const metrics = computeGaitMetrics(frames);
    expect(metrics.ai_generated).toBe(true);
  });

  it("ai_generated === true selv ved kort/upålidelig sekvens", () => {
    const frames = makeSyntheticWalkingSequence(60, 30);
    const metrics = computeGaitMetrics(frames);
    expect(metrics.quality.reliable_estimate).toBe(false);
    expect(metrics.ai_generated).toBe(true);
  });
});
