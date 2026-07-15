// Gait-metric computation · smartphone-alternative til Vicon/Qualisys.
// Kontrakt: FRONTIER-STANDARD (Cavanagh/Davis/Nigg) · HUMANIZED-FRONTIER §Motion
//
// PRINCIP:
//   Fra MediaPipe pose-frames beregner vi kliniske gait-metrics der matcher
//   Plug-in Gait / OFM standard-outputs så tæt som muligt. Target: Cohen's
//   kappa ≥ 0.7 vs Qualisys ground truth i pilot-studie.

import { MEDIAPIPE_POSE_LANDMARK_IDS, type PoseFrame } from "./pose-types";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type GaitEvent = {
  event_type: "heel_strike" | "toe_off";
  foot_side: "left" | "right";
  frame_index: number;
  timestamp_ms: number;
};

export type GaitSessionMetrics = {
  frame_count: number;
  duration_s: number;
  cadence_steps_per_min: number;
  step_count: number;
  step_count_left: number;
  step_count_right: number;
  mean_step_time_ms: number;
  step_time_symmetry_index: number;       // 0..1 (1 = perfect symmetry)
  ground_contact_time_left_ms: number;
  ground_contact_time_right_ms: number;
  vertical_oscillation_hip_mm: number;
  events: GaitEvent[];
  quality: {
    frames_used: number;
    frames_dropped_low_confidence: number;
    reliable_estimate: boolean;
  };
};

// ---------------------------------------------------------------------------
// Event detection · heel-strike + toe-off
// ---------------------------------------------------------------------------

/**
 * Heel-strike detektor: leder efter STIGENDE FLANKE af heel-y (foden går fra
 * swing til ground contact).
 *
 * Image y-akse: y=0 top, y=1 bund. Foden på gulvet = højeste y (længst nede).
 * Heel-strike = transitionen fra swing (lav y) til stance (høj y).
 *
 * Vi bruger et vindue (default 15 frames = 500ms @30fps) til at kræve at:
 *   y[i] > y[i-window]   (foden var i luften før)
 *   y[i] ≈ y[i+window]   (foden er på jorden nu · plateau)
 * Detektorens skarphed er kalibreret så én heel-strike detekteres per
 * gang-cyklus per side.
 */
export function detectHeelStrikes(
  frames: PoseFrame[],
  side: "left" | "right",
  windowFrames = 15,
): GaitEvent[] {
  const heelId =
    side === "left"
      ? MEDIAPIPE_POSE_LANDMARK_IDS.LEFT_HEEL
      : MEDIAPIPE_POSE_LANDMARK_IDS.RIGHT_HEEL;

  const heelYs = frames.map((f) => {
    const lm = f.landmarks.find((l) => l.id === heelId);
    return lm ? lm.y : null;
  });

  const events: GaitEvent[] = [];
  // Threshold: y skal være steget mindst 60% af sekvensens y-range
  const validYs = heelYs.filter((y): y is number => y !== null);
  if (validYs.length === 0) return events;
  const yRange = Math.max(...validYs) - Math.min(...validYs);
  const risingThreshold = yRange * 0.6;

  for (let i = windowFrames; i < heelYs.length - 3; i++) {
    const y = heelYs[i];
    const yPrev = heelYs[i - windowFrames];
    if (y === null || yPrev === null) continue;

    // Rising edge: y skal være steget merkbart fra window-frames før
    if (y - yPrev < risingThreshold) continue;

    // Og y skal være rimeligt konstant frem (plateau · ground contact)
    const yNext3 = heelYs[i + 3];
    if (yNext3 === null) continue;
    if (Math.abs(y - yNext3) > yRange * 0.15) continue;

    events.push({
      event_type: "heel_strike",
      foot_side: side,
      frame_index: frames[i]!.frame_index,
      timestamp_ms: frames[i]!.timestamp_ms,
    });
  }

  return dedupeCloseEvents(events, 350); // min 350ms mellem heel-strikes samme fod
}

/**
 * Toe-off detektor: leder efter FALDENDE FLANKE af toe-y (foden går fra
 * ground contact til swing-fase).
 *
 * Toe-off er den TEMPORALT MODSATTE transition af heel-strike: toen forlader
 * gulvet. y falder fra stance-plateau (høj y) til swing (lav y).
 */
export function detectToeOffs(
  frames: PoseFrame[],
  side: "left" | "right",
  windowFrames = 15,
): GaitEvent[] {
  const toeId =
    side === "left"
      ? MEDIAPIPE_POSE_LANDMARK_IDS.LEFT_FOOT_INDEX
      : MEDIAPIPE_POSE_LANDMARK_IDS.RIGHT_FOOT_INDEX;

  const toeYs = frames.map((f) => {
    const lm = f.landmarks.find((l) => l.id === toeId);
    return lm ? lm.y : null;
  });

  const events: GaitEvent[] = [];
  const validYs = toeYs.filter((y): y is number => y !== null);
  if (validYs.length === 0) return events;
  const yRange = Math.max(...validYs) - Math.min(...validYs);
  const fallingThreshold = yRange * 0.6;

  for (let i = 3; i < toeYs.length - windowFrames; i++) {
    const y = toeYs[i];
    const yNext = toeYs[i + windowFrames];
    if (y === null || yNext === null) continue;

    // Falling edge: y skal falde merkbart frem
    if (y - yNext < fallingThreshold) continue;

    // Og y var rimeligt konstant tidligere (var på jorden)
    const yPrev3 = toeYs[i - 3];
    if (yPrev3 === null) continue;
    if (Math.abs(y - yPrev3) > yRange * 0.15) continue;

    events.push({
      event_type: "toe_off",
      foot_side: side,
      frame_index: frames[i]!.frame_index,
      timestamp_ms: frames[i]!.timestamp_ms,
    });
  }

  return dedupeCloseEvents(events, 350);
}

function dedupeCloseEvents(events: GaitEvent[], minGapMs: number): GaitEvent[] {
  const sorted = [...events].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  const out: GaitEvent[] = [];
  for (const e of sorted) {
    const last = out[out.length - 1];
    if (!last || e.timestamp_ms - last.timestamp_ms >= minGapMs) {
      out.push(e);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Vertical oscillation (hip-marker vertical range)
// ---------------------------------------------------------------------------

export function computeHipVerticalOscillationMm(frames: PoseFrame[]): number {
  const hipYs: number[] = [];
  for (const f of frames) {
    const left = f.landmarks.find(
      (l) => l.id === MEDIAPIPE_POSE_LANDMARK_IDS.LEFT_HIP,
    );
    const right = f.landmarks.find(
      (l) => l.id === MEDIAPIPE_POSE_LANDMARK_IDS.RIGHT_HIP,
    );
    if (left && right) {
      const scale = f.world_scale_mm_per_pixel ?? 1;
      hipYs.push(((left.y + right.y) / 2) * 1000 * scale);
    }
  }
  if (hipYs.length < 2) return 0;
  const max = Math.max(...hipYs);
  const min = Math.min(...hipYs);
  return +(max - min).toFixed(2);
}

// ---------------------------------------------------------------------------
// Main aggregation
// ---------------------------------------------------------------------------

export function computeGaitMetrics(
  filteredFrames: PoseFrame[],
  droppedFrameCount = 0,
): GaitSessionMetrics {
  const frameCount = filteredFrames.length;
  const durationS =
    frameCount > 0
      ? (filteredFrames[frameCount - 1]!.timestamp_ms - filteredFrames[0]!.timestamp_ms) / 1000
      : 0;

  const leftHeelStrikes = detectHeelStrikes(filteredFrames, "left");
  const rightHeelStrikes = detectHeelStrikes(filteredFrames, "right");
  const leftToeOffs = detectToeOffs(filteredFrames, "left");
  const rightToeOffs = detectToeOffs(filteredFrames, "right");

  const stepCountLeft = leftHeelStrikes.length;
  const stepCountRight = rightHeelStrikes.length;
  const stepCount = stepCountLeft + stepCountRight;

  const cadence = durationS > 0 ? (stepCount / durationS) * 60 : 0;

  // Mean step-time fra alle heel-strikes sorteret
  const allStrikes = [...leftHeelStrikes, ...rightHeelStrikes].sort(
    (a, b) => a.timestamp_ms - b.timestamp_ms,
  );
  const stepTimes: number[] = [];
  for (let i = 1; i < allStrikes.length; i++) {
    stepTimes.push(allStrikes[i]!.timestamp_ms - allStrikes[i - 1]!.timestamp_ms);
  }
  const meanStepTime =
    stepTimes.length > 0
      ? stepTimes.reduce((a, b) => a + b, 0) / stepTimes.length
      : 0;

  const symmetryIndex = symmetryFromStepTimes(leftHeelStrikes, rightHeelStrikes);
  const gctLeft = groundContactTime(leftHeelStrikes, leftToeOffs);
  const gctRight = groundContactTime(rightHeelStrikes, rightToeOffs);

  const events: GaitEvent[] = [
    ...leftHeelStrikes,
    ...rightHeelStrikes,
    ...leftToeOffs,
    ...rightToeOffs,
  ].sort((a, b) => a.timestamp_ms - b.timestamp_ms);

  const verticalOsc = computeHipVerticalOscillationMm(filteredFrames);

  // Reliable estimate kriterier: ≥ 4 sekunders data OG ≥ 6 heel-strikes total
  const reliable = durationS >= 4 && stepCount >= 6;

  return {
    frame_count: frameCount,
    duration_s: +durationS.toFixed(3),
    cadence_steps_per_min: +cadence.toFixed(1),
    step_count: stepCount,
    step_count_left: stepCountLeft,
    step_count_right: stepCountRight,
    mean_step_time_ms: +meanStepTime.toFixed(1),
    step_time_symmetry_index: +symmetryIndex.toFixed(3),
    ground_contact_time_left_ms: +gctLeft.toFixed(1),
    ground_contact_time_right_ms: +gctRight.toFixed(1),
    vertical_oscillation_hip_mm: verticalOsc,
    events,
    quality: {
      frames_used: frameCount,
      frames_dropped_low_confidence: droppedFrameCount,
      reliable_estimate: reliable,
    },
  };
}

function symmetryFromStepTimes(
  leftStrikes: GaitEvent[],
  rightStrikes: GaitEvent[],
): number {
  if (leftStrikes.length < 2 || rightStrikes.length < 2) return 1;
  const leftTimes: number[] = [];
  for (let i = 1; i < leftStrikes.length; i++) {
    leftTimes.push(leftStrikes[i]!.timestamp_ms - leftStrikes[i - 1]!.timestamp_ms);
  }
  const rightTimes: number[] = [];
  for (let i = 1; i < rightStrikes.length; i++) {
    rightTimes.push(rightStrikes[i]!.timestamp_ms - rightStrikes[i - 1]!.timestamp_ms);
  }
  const meanL = mean(leftTimes);
  const meanR = mean(rightTimes);
  if (meanL <= 0 || meanR <= 0) return 1;
  const ratio = Math.min(meanL, meanR) / Math.max(meanL, meanR);
  return ratio;
}

function groundContactTime(
  heelStrikes: GaitEvent[],
  toeOffs: GaitEvent[],
): number {
  const contactTimes: number[] = [];
  for (const hs of heelStrikes) {
    const nextTo = toeOffs.find((t) => t.timestamp_ms > hs.timestamp_ms);
    if (nextTo && nextTo.timestamp_ms - hs.timestamp_ms < 2000) {
      contactTimes.push(nextTo.timestamp_ms - hs.timestamp_ms);
    }
  }
  return contactTimes.length > 0 ? mean(contactTimes) : 0;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
