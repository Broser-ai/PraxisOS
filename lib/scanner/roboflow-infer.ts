/**
 * Roboflow inference URL helpers.
 *
 * Universe pins work on detect.roboflow.com; private workspace models
 * (workspace/project/version) should use serverless.roboflow.com — the
 * current inference host per Roboflow API reference.
 */

export const ROBOFLOW_DETECT_HOST = "https://detect.roboflow.com";
export const ROBOFLOW_SERVERLESS_HOST = "https://serverless.roboflow.com";

/**
 * Workspace-qualified model ids look like `workspace/project/version`
 * (two slashes). Universe pins are `project/version` (one slash).
 */
export function isWorkspaceQualifiedModelId(modelId: string): boolean {
  const parts = modelId.split("/").filter(Boolean);
  return parts.length >= 3;
}

/**
 * Host for a model id. Custom Del Pilar Nexus endpoints are workspace-qualified
 * and must hit serverless; Universe pins stay on detect for compatibility.
 */
export function roboflowInferenceHost(modelId: string): string {
  const override = process.env.ROBOFLOW_INFER_HOST?.trim();
  if (override) return override.replace(/\/$/, "");
  return isWorkspaceQualifiedModelId(modelId)
    ? ROBOFLOW_SERVERLESS_HOST
    : ROBOFLOW_DETECT_HOST;
}

export function buildRoboflowInferUrl(modelId: string, apiKey: string): string {
  const host = roboflowInferenceHost(modelId);
  return `${host}/${modelId}?api_key=${encodeURIComponent(apiKey)}`;
}

/** HTTP statuses that mean the model version is missing / not deployable. */
export function isRoboflowUndeployedStatus(status: number): boolean {
  return status === 404 || status === 405;
}
