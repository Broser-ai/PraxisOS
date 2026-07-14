// Roboflow MCP Server client — computer vision dataset + træning + inference.
// Kontrakt: EPIC-2 Clinical Scanner § VLM co-inference (fod-læsion detection)
//
// Failsafe #1: hvis ROBOFLOW_API_KEY mangler → deterministisk mock (INV-CS-6 kompatibel).
//
// SECURITY-FIXES efter innovation-swarm HIGH-verify (2026-07-13):
// 1. `callMcpTool` throws SANITIZED error — raw response body ryger IKKE i Error.message
//    → forhindrer Authorization-header leak via Vercel serverless logs på 4xx debug-svar.
// 2. `Buffer.from(...).toString('base64')` erstattet med runtime-agnostisk `mockIdFrom()`
//    → Buffer er Node-only global; ville throw ReferenceError i Next.js Edge runtime.
// 3. Wire-schema for real Roboflow API-response afkoblet fra `ai_generated: literal(true)`
//    → INV-CS-6-tagging sker efter successful parse, aldrig i schema-parsning selv.
//    → Real API-svar ville ellers altid fejle → silent-degrade til blank findings.

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

/**
 * Runtime-agnostisk deterministisk hash til mock-id'er.
 * Erstatter `Buffer.from(str).toString('base64')` som crashede i Edge runtime.
 * Bruger simpel djb2-inspireret hash → base36 → truncated. Nok til at give
 * distinkte mock-id'er pr. imageUrl uden at afhænge af Node's Buffer.
 */
function mockIdFrom(input: string, length = 12): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  const unsigned = hash < 0 ? -hash : hash;
  return unsigned.toString(36).padStart(length, "0").slice(0, length);
}

/**
 * Sanitize sensitive tokens ud af strings før logging.
 * Roboflow debug 4xx-bodies kan indeholde echoed Authorization-headers.
 */
function scrubSecrets(s: string): string {
  return s
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
    .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[A-Za-z0-9._\-]+/gi, "$1[REDACTED]")
    .replace(/(authorization["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, "$1[REDACTED]");
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

// ---------------------------------------------------------------------------
// Wire schema for Roboflow API-response (NO ai_generated)
// ---------------------------------------------------------------------------
//
// Real Roboflow API returnerer IKKE ai_generated. INV-CS-6-tagging sker
// EFTER successful parse — se runInference() nedenfor.

const RoboflowRawDetectionSchema = z.object({
  id: z.string().optional(),
  class: z.string().optional(),   // Roboflow bruger typisk "class"
  category: z.string().optional(), // vi mapper til vores enum
  label: z.string().optional(),
  confidence: z.number().min(0).max(1),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  bbox_2d: z
    .object({
      frame_index: z.number().int().nonnegative().default(0),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .optional(),
  severity: z.enum(["low", "medium", "high"]).optional(),
});

const RoboflowRawInferenceResponseSchema = z.object({
  scan_id: z.string().optional(),
  image_id: z.string().optional(),
  confidence_overall: z.number().min(0).max(1).optional(),
  predictions: z.array(RoboflowRawDetectionSchema).optional(),
  findings: z.array(RoboflowRawDetectionSchema).optional(),
});

// ScannerFindings-kompatibel struktur (INV-CS-6 · ai_generated:true påføres af os)
export const InferenceDetectionSchema = z.object({
  id: z.string(),
  category: z
    .enum(["biomechanical", "dermatological", "vascular", "neurological", "other"])
    .default("dermatological"),
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
// Internal — MCP JSON-RPC style dispatch over fetch (SANITIZED errors)
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
    // FIX: raw body må ALDRIG i Error.message (kan indeholde echoed Authorization).
    // Log body separat med scrubSecrets så Vercel-logs ikke får rå key.
    const rawBody = await res.text().catch(() => "");
    if (rawBody) console.log(`[roboflow ${tool}] upstream body: ${scrubSecrets(rawBody)}`);
    throw new Error(`Roboflow MCP ${res.status} on ${tool}`);
  }

  const data = await res.json();
  return outputSchema.parse(data?.result ?? data);
}

/**
 * Map Roboflow's raw response → vores ScannerFindings-kompatible struktur
 * med ai_generated: true påført AF OS (ikke fra wire).
 */
function mapRoboflowResponseToFindings(
  raw: unknown,
  fallbackScanId: string
): z.infer<typeof RunInferenceOutputSchema> {
  const parsed = RoboflowRawInferenceResponseSchema.parse(raw);
  const rawDetections = parsed.predictions ?? parsed.findings ?? [];

  const findings = rawDetections.map((d, i): z.infer<typeof InferenceDetectionSchema> => {
    const bbox = d.bbox_2d ?? {
      frame_index: 0,
      x: d.x ?? 0,
      y: d.y ?? 0,
      w: d.width ?? 0,
      h: d.height ?? 0,
    };
    const label = d.label ?? d.class ?? "unknown";
    const category = normalizeCategory(d.category ?? d.class);
    return {
      id: d.id ?? `rf_${i}`,
      category,
      label,
      confidence: d.confidence,
      bbox_2d: bbox,
      severity: d.severity ?? "low",
      ai_generated: true,
    };
  });

  const avgConfidence =
    findings.length > 0
      ? findings.reduce((a, f) => a + f.confidence, 0) / findings.length
      : parsed.confidence_overall ?? 0;

  return {
    scan_id: parsed.scan_id ?? parsed.image_id ?? fallbackScanId,
    ai_generated: true,
    confidence_overall: parsed.confidence_overall ?? avgConfidence,
    findings,
  };
}

function normalizeCategory(
  raw: string | undefined
): z.infer<typeof InferenceDetectionSchema>["category"] {
  if (!raw) return "dermatological";
  const s = raw.toLowerCase();
  if (s.includes("bone") || s.includes("valgus") || s.includes("arch") || s.includes("gait"))
    return "biomechanical";
  if (s.includes("perfus") || s.includes("vascular") || s.includes("ischem"))
    return "vascular";
  if (s.includes("neuro") || s.includes("nerve")) return "neurological";
  if (
    s.includes("callus") ||
    s.includes("ulcer") ||
    s.includes("verruca") ||
    s.includes("wart") ||
    s.includes("eczema") ||
    s.includes("skin")
  )
    return "dermatological";
  return "other";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
    // Error.message er nu sanitized (kun status + tool-navn)
    console.log("Roboflow listDatasets error, falling back to mock:", (err as Error).message);
    return { datasets: [] };
  }
}

export async function uploadImageForAnnotation(
  input: z.infer<typeof UploadImageInputSchema>
): Promise<z.infer<typeof UploadImageOutputSchema>> {
  const parsed = UploadImageInputSchema.parse(input);
  const { apiKey } = getRoboflowConfig();
  if (!apiKey) {
    missingKeyLog("uploadImageForAnnotation");
    return {
      image_id: `img_mock_${mockIdFrom(parsed.imageUrl, 12)}`,
      dataset_id: parsed.datasetId,
      status: "accepted",
      message: "mock upload accepted",
    };
  }
  try {
    return await callMcpTool("roboflow.datasets.upload_image", parsed, UploadImageOutputSchema);
  } catch (err) {
    console.log(
      "Roboflow uploadImageForAnnotation error, falling back to mock:",
      (err as Error).message
    );
    return {
      image_id: `img_err_${mockIdFrom(parsed.imageUrl, 8)}`,
      dataset_id: parsed.datasetId,
      status: "rejected",
      message: (err as Error).message,
    };
  }
}

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
      job_id: `job_err_${mockIdFrom(`${parsed.datasetId}-${parsed.version}`, 10)}`,
      dataset_id: parsed.datasetId,
      status: "failed",
    };
  }
}

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
    return await callMcpTool(
      "roboflow.inference.deploy",
      parsed,
      DeployEndpointOutputSchema
    );
  } catch (err) {
    console.log(
      "Roboflow deployInferenceEndpoint error, falling back to mock:",
      (err as Error).message
    );
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
 * Real API-svar parses med RAW schema (uden ai_generated), MAPPES derefter til
 * ScannerFindings-shape med ai_generated: true påført af os. Dette forhindrer
 * silent-degrade-til-blank som var HIGH-verify-findet fra innovation-swarm.
 */
export async function runInference(
  input: z.infer<typeof RunInferenceInputSchema>
): Promise<z.infer<typeof RunInferenceOutputSchema>> {
  const parsed = RunInferenceInputSchema.parse(input);
  const { url, apiKey } = getRoboflowConfig();
  const fallbackScanId = `scan_${mockIdFrom(parsed.imageUrl, 10)}`;

  if (!apiKey) {
    missingKeyLog("runInference");
    return {
      scan_id: `scan_mock_${mockIdFrom(parsed.imageUrl, 10)}`,
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
    // NB: bruger direkte fetch mod endpointUrl (real Roboflow deployment)
    // fordi runInference går imod det deployede model-endpoint, ikke MCP tools-call.
    const res = await fetch(parsed.endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        image: parsed.imageUrl,
        confidence: parsed.confidenceThreshold,
      }),
    });
    if (!res.ok) {
      const rawBody = await res.text().catch(() => "");
      if (rawBody) console.log(`[roboflow runInference] upstream body: ${scrubSecrets(rawBody)}`);
      throw new Error(`Roboflow inference ${res.status}`);
    }
    const rawJson = await res.json();
    // Map raw wire → ScannerFindings + ai_generated:true (INV-CS-6)
    return mapRoboflowResponseToFindings(rawJson, fallbackScanId);
  } catch (err) {
    console.log("Roboflow runInference error, falling back to mock:", (err as Error).message);
    // NB: fallback returnerer 0 confidence + tom findings-array, IKKE en synthesized "callus"
    // — det ville være silent-lying. Caller kan tjekke findings.length === 0.
    return {
      scan_id: `scan_err_${mockIdFrom(parsed.imageUrl, 10)}`,
      ai_generated: true,
      confidence_overall: 0,
      findings: [],
    };
  }
}

export async function autoLabelImage(
  input: z.infer<typeof AutoLabelInputSchema>
): Promise<z.infer<typeof AutoLabelOutputSchema>> {
  const parsed = AutoLabelInputSchema.parse(input);
  const { apiKey } = getRoboflowConfig();
  if (!apiKey) {
    missingKeyLog("autoLabelImage");
    return {
      image_id: `img_mock_${mockIdFrom(parsed.imageUrl, 12)}`,
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
      image_id: `img_err_${mockIdFrom(parsed.imageUrl, 8)}`,
      labels: [],
    };
  }
}
