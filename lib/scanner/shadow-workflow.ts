/**
 * Del Pilar Nexus Roboflow shadow workflow constants.
 *
 * SHADOW_ONLY evaluation callers: `lib/scanner/shadow-inference.ts`.
 * Do NOT use these endpoints for live routing, quality gate, or patient response
 * unless `approved_for_active_routing === true` (currently false) and Broser
 * promotion gates in docs/vision/model-governance.md are met.
 *
 * Landmarks (`praxisos`) stay candidate_untrained / deployable:false and are
 * excluded from shadow parallel inference until status allows — see
 * docs/vision/landmarks-training-brief.md and docs/vision/promotion/.
 */
import shadowWorkflowJson from "@/docs/vision/workflows/del-pilar-nexus-shadow-evaluation.json";
import {
  maySendImagesToCustomRoboflow,
  type PrivacyGateEnv,
} from "@/lib/scanner/privacy-gate";

export type ShadowDeploymentState = "shadow_only";
export type ModelLaneStatus = "shadow" | "disabled";
export type LandmarksDeploymentState = "candidate_untrained";

export type ShadowWorkflowConfig = {
  workspace: string;
  workflow: {
    id: string;
    slug: string;
    deployment_state: ShadowDeploymentState;
    approved_for_active_routing: false;
  };
  models: {
    segmentation: {
      endpoint: string;
      task: "instance-segmentation";
      status: "shadow";
      classes: readonly string[];
    };
    candidates: {
      endpoint: string;
      task: "object-detection";
      status: "shadow";
      classes: readonly string[];
    };
    landmarks: {
      endpoint: string;
      task: "keypoint-detection";
      deployment_state: LandmarksDeploymentState;
      status: "disabled";
      deployable: false;
    };
  };
  video: {
    sources: readonly string[];
    frame_sampling_fps: number;
  };
  governance: {
    active_routing: false;
    replaces_live_universe_pins: false;
    clinical_copy: string;
    notes: string;
  };
};

export type ShadowParallelLane = "segmentation" | "candidates";

export type ShadowParallelEndpoint = {
  lane: ShadowParallelLane;
  endpoint: string;
  status: "shadow";
};

const cfg = shadowWorkflowJson as ShadowWorkflowConfig;

if (cfg.workflow.approved_for_active_routing !== false) {
  throw new Error(
    "shadow-workflow: approved_for_active_routing must remain false until Broser promotion",
  );
}
if (cfg.governance.active_routing !== false) {
  throw new Error("shadow-workflow: active_routing must remain false");
}
if (cfg.models.landmarks.deployable !== false) {
  throw new Error("shadow-workflow: landmarks must not be deployable");
}
if (cfg.models.landmarks.status !== "disabled") {
  throw new Error("shadow-workflow: landmarks status must be disabled while untrained");
}
if (cfg.models.landmarks.deployment_state !== "candidate_untrained") {
  throw new Error(
    "shadow-workflow: landmarks deployment_state must be candidate_untrained until trained",
  );
}

/** Full shadow workflow document (shared with docs/vision/workflows/). */
export const DEL_PILAR_NEXUS_SHADOW_WORKFLOW: ShadowWorkflowConfig = cfg;

export const ROBOFLOW_SHADOW_WORKSPACE = cfg.workspace;
export const ROBOFLOW_SHADOW_WORKFLOW_ID = cfg.workflow.id;
export const ROBOFLOW_SHADOW_WORKFLOW_SLUG = cfg.workflow.slug;
export const ROBOFLOW_SHADOW_APPROVED_FOR_ACTIVE_ROUTING =
  cfg.workflow.approved_for_active_routing;

export const SHADOW_SEGMENTATION_ENDPOINT = cfg.models.segmentation.endpoint;
export const SHADOW_SEGMENTATION_CLASSES = cfg.models.segmentation.classes;
export const SHADOW_CANDIDATES_ENDPOINT = cfg.models.candidates.endpoint;
export const SHADOW_CANDIDATE_CLASSES = cfg.models.candidates.classes;
export const SHADOW_LANDMARKS_ENDPOINT = cfg.models.landmarks.endpoint;
export const SHADOW_LANDMARKS_DEPLOYABLE = cfg.models.landmarks.deployable;
export const SHADOW_LANDMARKS_STATUS = cfg.models.landmarks.status;
export const SHADOW_LANDMARKS_DEPLOYMENT_STATE =
  cfg.models.landmarks.deployment_state;

/**
 * Guard: shadow workflow may only be used for evaluation logging — never live routing.
 * Callers must keep approved_for_active_routing false and leave Universe pins as the live path.
 */
export function isShadowOnlyRoutingAllowed(): boolean {
  return (
    cfg.workflow.deployment_state === "shadow_only" &&
    cfg.workflow.approved_for_active_routing === false &&
    cfg.governance.active_routing === false &&
    cfg.governance.replaces_live_universe_pins === false
  );
}

/**
 * Landmarks are not runnable for shadow parallel inference (or any deployable
 * path) while candidate_untrained / disabled / deployable:false.
 */
export function isLandmarksEndpointRunnable(): boolean {
  const { deployable, status, deployment_state } = cfg.models.landmarks;
  return (
    Boolean(deployable) &&
    status !== "disabled" &&
    deployment_state !== "candidate_untrained"
  );
}

export function assertLandmarksNotDeployable(): void {
  if (
    cfg.models.landmarks.deployable ||
    cfg.models.landmarks.status !== "disabled" ||
    cfg.models.landmarks.deployment_state !== "candidate_untrained"
  ) {
    throw new Error(
      "Landmarks are candidate_untrained / disabled — not deployable",
    );
  }
  if (isLandmarksEndpointRunnable()) {
    throw new Error("Landmarks must not be runnable until trained + adjudicated");
  }
}

/**
 * Reject selecting landmarks for any deployable / active / parallel-shadow path
 * while untrained. Call before enqueueing inference to `praxisos`.
 */
export function assertLandmarksNotSelectedForInference(): void {
  assertLandmarksNotDeployable();
  if (isLandmarksEndpointRunnable()) {
    throw new Error("Landmarks endpoint must not be selected for inference");
  }
}

/**
 * Endpoints allowed for future SHADOW_ONLY parallel inference.
 * Landmarks are intentionally omitted until deployable + status allows.
 */
export function listShadowParallelInferenceEndpoints(): readonly ShadowParallelEndpoint[] {
  assertLandmarksNotSelectedForInference();
  return [
    {
      lane: "segmentation",
      endpoint: cfg.models.segmentation.endpoint,
      status: "shadow",
    },
    {
      lane: "candidates",
      endpoint: cfg.models.candidates.endpoint,
      status: "shadow",
    },
  ] as const;
}

/**
 * Registry helper: a lane is deployable only if status is canary/active-shaped.
 * Landmarks stay false while untrained regardless of caller requests.
 */
export function isModelLaneDeployable(
  lane: "segmentation" | "candidates" | "landmarks",
): boolean {
  switch (lane) {
    case "segmentation":
    case "candidates":
      // Shadow candidates are not production-deployable; active routing remains off.
      return false;
    case "landmarks":
      return isLandmarksEndpointRunnable();
    default: {
      const _exhaustive: never = lane;
      return _exhaustive;
    }
  }
}

/**
 * True only when shadow-only config is intact AND privacy-gate is open.
 * Does not enable active routing. Call before any custom-endpoint image upload.
 */
export function mayRunShadowOnlyImageInference(
  privacyEnv?: PrivacyGateEnv,
): boolean {
  if (!isShadowOnlyRoutingAllowed()) return false;
  if (cfg.workflow.approved_for_active_routing !== false) return false;
  if (cfg.models.landmarks.deployable !== false) return false;
  return maySendImagesToCustomRoboflow(privacyEnv);
}
