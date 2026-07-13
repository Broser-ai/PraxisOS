// Roboflow MCP Server client — computer vision dataset + træning + inference.
// Kontrakt: EPIC-2 Clinical Scanner § VLM co-inference (fod-læsion detection)
// Failsafe: hvis ROBOFLOW_API_KEY mangler → deterministisk mock (INV-CS-6 kompatibel).

import { z } from "zod";

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

const ROBOFLOW_MCP_URL_DEFAULT = "https://mcp.roboflow.com";

function getRoboflowConfig(): { url: string; apiKey: string | undefined } {
  return {
    url: process.env.ROBOFLOW_MCP_URL ?? ROBOFLOW_MCP_URL_DEFAULT,
    apiKey: process.env.ROBOFLOW_API_KEY,
  };
}

function missingKeyLog(fn: string): void {
  console.log(`API Key Missing (ROBOFLOW_API_KEY) — ${fn} falling back to deterministic mock`);
}

// ---------------------------------------------------------------------------
// Roboflow MCP tool-navne (typed enum for orchestrator dispatch)
// ---------------------------------------------------------------------------

export type RoboflowMcpTool =
  | "roboflow.datasets.list"
  | "roboflow.datasets.upload_image"
  | "roboflow.train.start"
  | "roboflow.inference.deploy"
  | "roboflow.inference.run"
  | "roboflow.autolabel.image";

// ---------------------------------------------------------------------------
// Zod-schemas · Input + Output pr. tool
// ---------------------------------------------------------------------------

export const DatasetSchema = z.object({
  id: z.string(),
  name: z.string(),
  workspace: z.string(),
  version: z.number().int().nonnegative(),
  classes: z.array(z.string()).default([]),
  images_count: z.number().int().nonnegative().default(0),
});
export type Dataset = z.infer<typeof DatasetSchema>;

export const ListDatasetsInputSchema = z.object({
  workspace: z.string().optional(),
});
export const ListDatasetsOutputSchema = z.object({
  datasets: z.array(DatasetSchema),
});

export const UploadImageInputSchema = z.object({
  datasetId: z.string().min(1),
  imageUrl: z.string().url(),
  split: z.enum(["train", "valid", "test"]).default("train"),
  labels: z
    .array(
      z.object({
        class: z.string(),
        bbox: z.object({
          x: z.number(),
          y: z.number(),
          w: z.number(),
          h: z.number(),
        }),
      })
    )
    .optional(),
});
export const UploadImageOutputSchema = z.object({
  image_id: z.string(),
  dataset_id: z.string(),
  status: z.enum(["queued", "accepted", "rejected"]),
  message: z.string().optional(),
});

export const TrainModelInputSchema = z.object({
  datasetId: z.string().min(1),
  version: z.number().int().nonnegative(),
  modelType: z.enum(["yolov8", "yolov11", "rf-detr"]).default("yolov11"),
  epochs: z.number().int().positive().max(500).default(100),
});
export const TrainModelOutputSchema = z.object({
  job_id: z.string(),
  dataset_id: z.string(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  eta_seconds: z.number().int().nonnegative().optional(),
});

export const DeployEndpointInputSchema = z.object({
  modelId: z.string().min(1),
  version: z.number().int().nonnegative(),
  region: z.enum(["eu-west", "us-east", "us-west"]).default("eu-west"),
});
export const DeployEndpointOutputSchema = z.object({
  endpoint_url: z.string().url(),
  model_id: z.string(),
  version: z.number().int().nonnegative(),
  region: z.string(),
  status: z.enum(["provisioning", "ready", "failed"]),
});

// Scanner-Findings-kompatibel struktur (ScannerFindings §3)
export const InferenceDetectionSchema = z.object({
  id: z.string(),
  category: z.enum(["biomechanical", "dermatological", "vascular", "neurological", "other"]).default("dermatological"),
  label: z.string(),
  confidence: z.number().min(0).max(1),
  bbox_2d: z.object({
    frame_index: z.number().int().nonnegative().default(0),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  severity: z.enum(["low", "medium", "high"]).default("low"),
  ai_generated: z.literal(true),
});
export const RunInferenceInputSchema = z.object({
  endpointUrl: z.string().url(),
  imageUrl: z.string().url(),
  confidenceThreshold: z.number().min(0).max(1).default(0.4),
});
export const RunInferenceOutputSchema = z.object({
  scan_id: z.string(),
  ai_generated: z.literal(true),
  confidence_overall: z.number().min(0).max(1),
  findings: z.array(InferenceDetectionSchema),
});

export const AutoLabelInputSchema = z.object({
  datasetId: z.string().min(1),
  imageUrl: z.string().url(),
  promptClasses: z.array(z.string()).min(1),
});
export const AutoLabelOutputSchema = z.object({
  image_id: z.string(),
  labels: z.array(
    z.object({
      class: z.string(),
      confidence: z.number().min(0).max(1),
      bbox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    })
  ),
});

// ---------------------------------------------------------------------------
// Internal — MCP JSON-RPC style dispatch over fetch
// ---------------------------------------------------------------------------

async function callMcpTool<T>(
  tool: RoboflowMcpTool,
  params: Record<string, unknown>,
  outputSchema: z.ZodType<T>
): Promise<T> {
  const { url, apiKey } = getRoboflowConfig();
  if (!apiKey) throw new Error("no-api-key"); // caller handles fallback

  const res = await fetch(`${url}/mcp/tools/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ tool, params }),
  });

  if (!res.ok) {
    throw new Error(`Roboflow MCP ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = await res.json();
  return outputSchema.parse(data?.result ?? data);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List datasets tilgængelige i det konfigurerede Roboflow workspace.
 * Failsafe: returnerer deterministisk mock hvis ROBOFLOW_API_KEY mangler.
 */
export async function listDatasets(
  input: z.infer<typeof ListDatasetsInputSchema> = {}
): Promise<z.infer<typeof ListDatasetsOutputSchema>> {
  const parsed = ListDatasetsInputSchema.parse(input);
  const { apiKey } = getRoboflowConfig();
  if (!apiKey) {
    missingKeyLog("listDatasets");
    return {
      datasets: [
        {
          id: "ds_mock_foot_lesions",
          name: "praxisos-foot-lesions",
          workspace: parsed.workspace ?? "praxisos-mock",
          version: 1,
          classes: ["callus", "ulcer", "hallux_valgus", "melanoma_suspect"],
          images_count: 0,
        },
      ],
    };
  }
  try {
    return await callMcpTool("roboflow.datasets.list", parsed, ListDatasetsOutputSchema);
  } catch (err) {
    console.log("Roboflow listDatasets error, falling back to mock:", (err as Error).message);
    return { datasets: [] };
  }
}

/**
 * Upload et billede (URL-referencet) til et dataset for manuel eller AI-assisteret annotering.
 * Failsafe: returnerer deterministisk mock hvis ROBOFLOW_API_KEY mangler.
 */
export async function uploadImageForAnnotation(
  input: z.infer<typeof UploadImageInputSchema>
): Promise<z.infer<typeof UploadImageOutputSchema>> {
  const parsed = UploadImageInputSchema.parse(input);
  const { apiKey } = getRoboflowConfig();
  if (!apiKey) {
    missingKeyLog("uploadImageForAnnotation");
    return {
      image_id: `img_mock_${Buffer.from(parsed.imageUrl).toString("base64").slice(0, 12)}`,
      dataset_id: parsed.datasetId,
      status: "accepted",
      message: "mock upload accepted",
    };
  }
  try {
    return await callMcpTool("roboflow.datasets.upload_image", parsed, UploadImageOutputSchema);
  } catch (err) {
    console.log("Roboflow uploadImageForAnnotation error, falling back to mock:", (err as Error).message);
    return {
      image_id: `img_err_${Date.now()}`,
      dataset_id: parsed.datasetId,
      status: "rejected",
      message: (err as Error).message,
    };
  }
}

/**
 * Start et træningsjob for en dataset-version. Returnerer job_id til polling.
 * Failsafe: returnerer deterministisk mock med queued job_id hvis ROBOFLOW_API_KEY mangler.
 */
export async function trainModel(
  input: z.infer<typeof TrainModelInputSchema>
): Promise<z.infer<typeof TrainModelOutputSchema>> {
  const parsed = TrainModelInputSchema.parse(input);
  const { apiKey } = getRoboflowConfig();
  if (!apiKey) {
    missingKeyLog("trainModel");
    return {
      job_id: `job_mock_${parsed.datasetId}_v${parsed.version}`,
      dataset_id: parsed.datasetId,
      status: "queued",
      eta_seconds: 1800,
    };
  }
  try {
    return await callMcpTool("roboflow.train.start", parsed, TrainModelOutputSchema);
  } catch (err) {
    console.log("Roboflow trainModel error, falling back to mock:", (err as Error).message);
    return {
      job_id: `job_err_${Date.now()}`,
      dataset_id: parsed.datasetId,
      status: "failed",
    };
  }
}

/**
 * Deploy en trænet model som hosted inference-endpoint (returnerer HTTPS-URL).
 * Failsafe: returnerer deterministisk mock endpoint URL hvis ROBOFLOW_API_KEY mangler.
 */
export async function deployInferenceEndpoint(
  input: z.infer<typeof DeployEndpointInputSchema>
): Promise<z.infer<typeof DeployEndpointOutputSchema>> {
  const parsed = DeployEndpointInputSchema.parse(input);
  const { apiKey } = getRoboflowConfig();
  if (!apiKey) {
    missingKeyLog("deployInferenceEndpoint");
    return {
      endpoint_url: `https://mock.roboflow.com/${parsed.modelId}/v${parsed.version}`,
      model_id: parsed.modelId,
      version: parsed.version,
      region: parsed.region,
      status: "ready",
    };
  }
  try {
    return await callMcpTool("roboflow.inference.deploy", parsed, DeployEndpointOutputSchema);
  } catch (err) {
    console.log("Roboflow deployInferenceEndpoint error, falling back to mock:", (err as Error).message);
    return {
      endpoint_url: `https://mock.roboflow.com/${parsed.modelId}/v${parsed.version}`,
      model_id: parsed.modelId,
      version: parsed.version,
      region: parsed.region,
      status: "failed",
    };
  }
}

/**
 * Kør inference på et enkelt billede mod et deployet endpoint.
 * Failsafe: returnerer deterministisk mock med ScannerFindings-kompatibel struktur
 * (ai_generated=true, confidence_overall, findings[]) hvis ROBOFLOW_API_KEY mangler.
 */
export async function runInference(
  input: z.infer<typeof RunInferenceInputSchema>
): Promise<z.infer<typeof RunInferenceOutputSchema>> {
  const parsed = RunInferenceInputSchema.parse(input);
  const { apiKey } = getRoboflowConfig();
  if (!apiKey) {
    missingKeyLog("runInference");
    return {
      scan_id: `scan_mock_${Buffer.from(parsed.imageUrl).toString("base64").slice(0, 10)}`,
      ai_generated: true,
      confidence_overall: 0.78,
      findings: [
        {
          id: "rf_mock_1",
          category: "dermatological",
          label: "Callus (hyperkeratose)",
          confidence: 0.86,
          bbox_2d: { frame_index: 0, x: 210, y: 380, w: 90, h: 70 },
          severity: "low",
          ai_generated: true,
        },
      ],
    };
  }
  try {
    return await callMcpTool("roboflow.inference.run", parsed, RunInferenceOutputSchema);
  } catch (err) {
    console.log("Roboflow runInference error, falling back to mock:", (err as Error).message);
    return {
      scan_id: `scan_err_${Date.now()}`,
      ai_generated: true,
      confidence_overall: 0,
      findings: [],
    };
  }
}

/**
 * Auto-label et billede med Roboflow's grounded auto-annotation (SAM/GroundingDINO-lignende).
 * Failsafe: returnerer deterministisk mock med een label pr. promptClass hvis ROBOFLOW_API_KEY mangler.
 */
export async function autoLabelImage(
  input: z.infer<typeof AutoLabelInputSchema>
): Promise<z.infer<typeof AutoLabelOutputSchema>> {
  const parsed = AutoLabelInputSchema.parse(input);
  const { apiKey } = getRoboflowConfig();
  if (!apiKey) {
    missingKeyLog("autoLabelImage");
    return {
      image_id: `img_mock_${Buffer.from(parsed.imageUrl).toString("base64").slice(0, 12)}`,
      labels: parsed.promptClasses.map((cls, i) => ({
        class: cls,
        confidence: 0.7,
        bbox: { x: 100 + i * 20, y: 100 + i * 20, w: 80, h: 60 },
      })),
    };
  }
  try {
    return await callMcpTool("roboflow.autolabel.image", parsed, AutoLabelOutputSchema);
  } catch (err) {
    console.log("Roboflow autoLabelImage error, falling back to mock:", (err as Error).message);
    return {
      image_id: `img_err_${Date.now()}`,
      labels: [],
    };
  }
}
