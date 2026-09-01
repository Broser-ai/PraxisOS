/**
 * Del Pilar Nexus Roboflow shadow workflow constants.
 *
 * SHADOW_ONLY evaluation callers: `lib/scanner/shadow-inference.ts`.
 * Live patient path stays on Universe pins until
 * `approved_for_active_routing === true` AND `PRAXIS_ACTIVE_ROUTING_ENABLED`
 * AND `FOOT_VISION_CANARY_PERCENT > 0` (see `lib/scanner/active-routing.ts`).
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
export type ModelLaneStatus = "shadow" | "disabled" | "canary";
export type LandmarksDeploymentState = "candidate_untrained";

export type ShadowWorkflowConfig = {
  workspace: string;
  workflow: {
    id: string;
    slug: string;
    deployment_state: ShadowDeploymentState;
    approved_for_active_routing: boolean;
  };
  models: {
    segmentation: {
      endpoint: string;
      task: "instance-segmentation";
      status: ModelLaneStatus;
      classes: readonly string[];
    };
    candidates: {
      endpoint: string;
      task: "object-detection";
      status: ModelLaneStatus;
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
    /** Full live cutover — must stay false while canary < 100 / Universe primary. */
    active_routing: boolean;
    replaces_live_universe_pins: boolean;
    clinical_copy: string;
    notes: string;
  };
};

export type ShadowParallelLane = "segmentation" | "candidates";

export type ShadowParallelEndpoint = {
  lane: ShadowParallelLane;
  endpoint: string;
  status: "shadow" | "canary";
};

const cfg = shadowWorkflowJson as ShadowWorkflowConfig;

if (cfg.governance.replaces_live_universe_pins !== false) {
  throw new Error(
    "shadow-workflow: replaces_live_universe_pins must remain false until Broser full cutover (use FOOT_VISION_CANARY_PERCENT)",
  );
}
if (cfg.governance.active_routing !== false) {
  throw new Error(
    "shadow-workflow: governance.active_routing must remain false while Universe pins stay quality-gate primary (canary gate only)",
  );
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
 * Guard: parallel shadow eval may run while governance is unlocked, as long as
 * live Universe pins are not fully replaced and landmarks stay non-deployable.
 */
export function isShadowOnlyRoutingAllowed(): boolean {
  return (
    cfg.workflow.deployment_state === "shadow_only" &&
    cfg.governance.active_routing === false &&
    cfg.governance.replaces_live_universe_pins === false &&
    cfg.models.landmarks.deployable === false
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
 * Endpoints allowed for SHADOW_ONLY parallel inference.
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
 * Registry helper: a lane is deployable only if status is canary/active-shaped
 * AND governance allows. Landmarks stay false while untrained.
 * With canary percent 0, live path still uses Universe (see active-routing.ts).
 */
export function isModelLaneDeployable(
  lane: "segmentation" | "candidates" | "landmarks",
): boolean {
  switch (lane) {
    case "segmentation":
    case "candidates":
      // Deployable for canary selection only when governance approved;
      // live selection still requires PRAXIS_ACTIVE_ROUTING_ENABLED + canary > 0.
      return cfg.workflow.approved_for_active_routing === true;
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
 * Does not enable live Universe replacement. Call before any custom-endpoint
 * image upload for shadow eval.
 */
export function mayRunShadowOnlyImageInference(
  privacyEnv?: PrivacyGateEnv,
): boolean {
  if (!isShadowOnlyRoutingAllowed()) return false;
  if (cfg.models.landmarks.deployable !== false) return false;
  return maySendImagesToCustomRoboflow(privacyEnv);
}
