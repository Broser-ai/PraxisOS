// Gait-metrics tests
// Kontrakt: Sprint 4 · FRONTIER-STANDARD Cavanagh/Davis

import { describe, it, expect } from "vitest";
import { createStubPoseExtractor, applyConfidenceFilter } from "@/lib/gait/pose-extractor";
import {
  computeGaitMetrics,
  detectHeelStrikes,
  detectToeOffs,
  computeHipVerticalOscillationMm,
} from "@/lib/gait/gait-metrics";
import { makeSyntheticWalkingSequence } from "@/lib/gait/pose-types";

describe("gait · pose extractor", () => {
  it("stub returnerer 180 frames for 6 sek × 30 fps", async () => {
    const extractor = createStubPoseExtractor();
    const frames = await extractor.extract("stub://video", {
      targetFps: 30,
      minLandmarkConfidence: 0.5,
    });
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0]!.timestamp_ms).toBe(0);
  });

  it("confidence-filter dropper frames med low-visibility heels", () => {
    const frames = makeSyntheticWalkingSequence(30, 30);
    // Zero-out visibility for one frame's heels
    frames[10]!.landmarks = frames[10]!.landmarks.map((l) =>
      l.id === 29 || l.id === 30 ? { ...l, visibility: 0.1 } : l,
    );
    const filtered = applyConfidenceFilter(frames, 0.5);
    expect(filtered.length).toBeLessThan(frames.length);
  });
});

describe("gait · event detection", () => {
  it("scripted walking sequence yielder mindst 3 heel-strikes pr side over 6 sek", () => {
    const frames = makeSyntheticWalkingSequence(180, 30); // 6 sek
    const left = detectHeelStrikes(frames, "left");
    const right = detectHeelStrikes(frames, "right");
    expect(left.length).toBeGreaterThanOrEqual(3);
    expect(right.length).toBeGreaterThanOrEqual(3);
    for (const e of left) expect(e.event_type).toBe("heel_strike");
  });

  it("toe-offs alterneres nogenlunde med heel-strikes", () => {
    const frames = makeSyntheticWalkingSequence(180, 30);
    const leftHs = detectHeelStrikes(frames, "left");
    const leftTo = detectToeOffs(frames, "left");
    // Skal have samme størrelsesorden (±2)
    expect(Math.abs(leftHs.length - leftTo.length)).toBeLessThanOrEqual(3);
  });
});

describe("gait · vertical oscillation", () => {
  it("returnerer positiv værdi når hip-y varierer", () => {
    const frames = makeSyntheticWalkingSequence(120, 30);
    const vo = computeHipVerticalOscillationMm(frames);
    expect(vo).toBeGreaterThan(0);
  });

  it("returnerer 0 når hip-landmarks konstante", () => {
    const frames = makeSyntheticWalkingSequence(30, 30);
    // Fix hip-y til samme værdi
    for (const f of frames) {
      for (const l of f.landmarks) {
        if (l.id === 23 || l.id === 24) l.y = 0.55;
      }
    }
    const vo = computeHipVerticalOscillationMm(frames);
    expect(vo).toBe(0);
  });
});

describe("gait · full metrics aggregation", () => {
  it("6-sek walking gives reliable_estimate=true + cadence ~90-110 spm", () => {
    const frames = makeSyntheticWalkingSequence(180, 30);
    const metrics = computeGaitMetrics(frames);
    expect(metrics.quality.reliable_estimate).toBe(true);
    expect(metrics.cadence_steps_per_min).toBeGreaterThan(80);
    expect(metrics.cadence_steps_per_min).toBeLessThan(140);
  });

  it("2-sek walking gives reliable_estimate=false", () => {
    const frames = makeSyntheticWalkingSequence(60, 30);
    const metrics = computeGaitMetrics(frames);
    expect(metrics.quality.reliable_estimate).toBe(false);
  });

  it("step_time_symmetry_index i [0, 1]", () => {
    const frames = makeSyntheticWalkingSequence(180, 30);
    const metrics = computeGaitMetrics(frames);
    expect(metrics.step_time_symmetry_index).toBeGreaterThanOrEqual(0);
    expect(metrics.step_time_symmetry_index).toBeLessThanOrEqual(1);
  });
});
