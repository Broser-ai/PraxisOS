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
import {
  DEL_PILAR_NEXUS_SHADOW_WORKFLOW,
  ROBOFLOW_SHADOW_APPROVED_FOR_ACTIVE_ROUTING,
  SHADOW_CANDIDATE_CLASSES,
  SHADOW_LANDMARKS_DEPLOYABLE,
  SHADOW_LANDMARKS_DEPLOYMENT_STATE,
  SHADOW_LANDMARKS_ENDPOINT,
  SHADOW_LANDMARKS_STATUS,
  SHADOW_SEGMENTATION_CLASSES,
  assertLandmarksNotDeployable,
  assertLandmarksNotSelectedForInference,
  isLandmarksEndpointRunnable,
  isModelLaneDeployable,
  isShadowOnlyRoutingAllowed,
  listShadowParallelInferenceEndpoints,
} from "@/lib/scanner/shadow-workflow";

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
      class: "candidate_open_wound",
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
          class: "candidate_heel_fissure",
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

describe("del pilar nexus shadow workflow registry", () => {
  it("keeps live cutover off, landmarks non-deployable, governance approved", () => {
    expect(ROBOFLOW_SHADOW_APPROVED_FOR_ACTIVE_ROUTING).toBe(true);
    expect(DEL_PILAR_NEXUS_SHADOW_WORKFLOW.workflow.deployment_state).toBe(
      "shadow_only",
    );
    expect(DEL_PILAR_NEXUS_SHADOW_WORKFLOW.governance.active_routing).toBe(
      false,
    );
    expect(
      DEL_PILAR_NEXUS_SHADOW_WORKFLOW.governance.replaces_live_universe_pins,
    ).toBe(false);
    expect(DEL_PILAR_NEXUS_SHADOW_WORKFLOW.workflow.id).toBe(
      "Z1TLmeAsa9GAWJg3xufe",
    );
    expect(SHADOW_LANDMARKS_DEPLOYABLE).toBe(false);
    expect(SHADOW_LANDMARKS_STATUS).toBe("disabled");
    expect(SHADOW_LANDMARKS_DEPLOYMENT_STATE).toBe("candidate_untrained");
    expect(SHADOW_LANDMARKS_ENDPOINT).toBe("praxisos");
    expect(isShadowOnlyRoutingAllowed()).toBe(true);
    expect(() => assertLandmarksNotDeployable()).not.toThrow();
    expect(() => assertLandmarksNotSelectedForInference()).not.toThrow();
  });

  it("rejects deployable landmarks while untrained and skips parallel inference", () => {
    expect(isLandmarksEndpointRunnable()).toBe(false);
    expect(isModelLaneDeployable("landmarks")).toBe(false);
    expect(isModelLaneDeployable("segmentation")).toBe(true);
    expect(isModelLaneDeployable("candidates")).toBe(true);

    const parallel = listShadowParallelInferenceEndpoints();
    expect(parallel.map((p) => p.lane)).toEqual(["segmentation", "candidates"]);
    expect(parallel.every((p) => p.status === "shadow")).toBe(true);
    expect(parallel.some((p) => p.endpoint === SHADOW_LANDMARKS_ENDPOINT)).toBe(
      false,
    );
  });

  it("exports shadow class lists matching annotation atlas", () => {
    expect([...SHADOW_SEGMENTATION_CLASSES]).toEqual([
      "foot",
      "toes_region",
      "heel_region",
    ]);
    expect([...SHADOW_CANDIDATE_CLASSES]).toEqual([
      "candidate_open_wound",
      "candidate_localised_hyperkeratosis",
      "candidate_heel_fissure",
    ]);
  });
});
