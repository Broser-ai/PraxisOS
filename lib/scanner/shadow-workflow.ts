/**
 * Del Pilar Nexus Roboflow shadow workflow constants.
 *
 * Registry + config only. Do NOT wire alpha-pipeline / live routing to these
 * endpoints unless `approved_for_active_routing === true` (currently false)
 * and Broser promotion gates in docs/vision/model-governance.md are met.
 */
import shadowWorkflowJson from "@/docs/vision/workflows/del-pilar-nexus-shadow-evaluation.json";

export type ShadowDeploymentState = "shadow_only";
export type ModelLaneStatus = "shadow" | "disabled";

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
      deployment_state: "candidate_untrained";
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

/**
 * Guard for any future caller: never treat this workflow as live routing.
 * Prefer registry+config only until Broser enables an explicit SHADOW_ONLY path
 * that does not replace Universe pins.
 */
export function isShadowOnlyRoutingAllowed(): boolean {
  return (
    cfg.workflow.deployment_state === "shadow_only" &&
    cfg.workflow.approved_for_active_routing === false &&
    cfg.governance.active_routing === false &&
    cfg.governance.replaces_live_universe_pins === false
  );
}

export function assertLandmarksNotDeployable(): void {
  if (cfg.models.landmarks.deployable || cfg.models.landmarks.status !== "disabled") {
    throw new Error("Landmarks are candidate_untrained / disabled — not deployable");
  }
}
