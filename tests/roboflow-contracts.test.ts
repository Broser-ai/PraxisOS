import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectionClinicianCopy,
  safeParseRoboflowDetection,
} from "@/contracts/roboflow-detection.schema";
import {
  footDetectedFromSegmentation,
  safeParseRoboflowSegmentation,
} from "@/contracts/roboflow-segmentation.schema";
import {
  isKeypointObservable,
  safeParseRoboflowKeypoints,
} from "@/contracts/roboflow-keypoints.schema";

const fixtureDir = join(process.cwd(), "tests/fixtures/roboflow");

function load(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtureDir, name), "utf8"));
}

describe("roboflow contracts (strict Zod)", () => {
  it("parses detection fixture with normalized bbox contract", () => {
    const parsed = safeParseRoboflowDetection(
      load("detection-candidate-open-wound.json"),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const p0 = parsed.data.predictions[0]!;
    expect(p0).toMatchObject({
      class: "ulcer_dfu",
      confidence: 0.81,
      x: 640,
      y: 520,
      width: 120,
      height: 95,
    });
    const copy = detectionClinicianCopy(p0);
    expect(copy).toMatch(/Kandidatområde registreret/);
    expect(copy.toLowerCase()).not.toContain("ulcer detected");
  });

  it("rejects detection payloads with unknown keys (strict)", () => {
    const parsed = safeParseRoboflowDetection({
      predictions: [
        {
          class: "callus",
          confidence: 0.5,
          x: 1,
          y: 2,
          width: 3,
          height: 4,
          detection_id: "extra-not-allowed",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("parses segmentation fixture including polygon points", () => {
    const parsed = safeParseRoboflowSegmentation(load("segmentation-foot.json"));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.predictions[0]?.points?.length).toBe(4);
    const foot = footDetectedFromSegmentation(parsed.data);
    expect(foot.detected).toBe(true);
    expect(foot.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("parses keypoints separately with nested class_name/class_id", () => {
    const parsed = safeParseRoboflowKeypoints(
      load("keypoints-visible-foot.json"),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const kps = parsed.data.predictions[0]?.keypoints ?? [];
    expect(kps[0]).toMatchObject({
      class_name: "heel_center",
      class_id: 0,
      confidence: 0.91,
    });
    expect(kps.every(isKeypointObservable)).toBe(true);
  });

  it("rejects malformed Roboflow payload for all three contracts", () => {
    const raw = load("malformed-response.json");
    expect(safeParseRoboflowDetection(raw).success).toBe(false);
    expect(safeParseRoboflowSegmentation(raw).success).toBe(false);
    expect(safeParseRoboflowKeypoints(raw).success).toBe(false);
  });
});
