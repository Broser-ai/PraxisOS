// Vitest suite for Roboflow MCP client — failsafe + schema validation.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  listDatasets,
  uploadImageForAnnotation,
  runInference,
  trainModel,
  deployInferenceEndpoint,
  RunInferenceOutputSchema,
  UploadImageInputSchema,
} from "../../lib/roboflow/mcp-client";

describe("Roboflow MCP client — failsafe mode (no API key)", () => {
  const originalKey = process.env.ROBOFLOW_API_KEY;

  beforeEach(() => {
    delete process.env.ROBOFLOW_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) process.env.ROBOFLOW_API_KEY = originalKey;
  });

  it("listDatasets returns deterministic mock when no key is set", async () => {
    const res = await listDatasets({ workspace: "praxisos-mock" });
    expect(res.datasets).toHaveLength(1);
    expect(res.datasets[0].id).toBe("ds_mock_foot_lesions");
    expect(res.datasets[0].workspace).toBe("praxisos-mock");
    expect(res.datasets[0].classes).toContain("callus");
  });

  it("uploadImageForAnnotation validates input via zod (rejects bad URL)", async () => {
    // Direct schema check — non-URL string should fail parse
    expect(() =>
      UploadImageInputSchema.parse({ datasetId: "ds_1", imageUrl: "not-a-url" })
    ).toThrow();

    // Valid input passes through to mock
    const ok = await uploadImageForAnnotation({
      datasetId: "ds_1",
      imageUrl: "https://example.com/foot.jpg",
    });
    expect(ok.status).toBe("accepted");
    expect(ok.dataset_id).toBe("ds_1");
    expect(ok.image_id).toMatch(/^img_mock_/);
  });

  it("runInference mock returns ScannerFindings-compatible structure", async () => {
    const res = await runInference({
      endpointUrl: "https://mock.roboflow.com/m/v1",
      imageUrl: "https://example.com/foot.jpg",
    });
    // Schema round-trip proves ScannerFindings-compatible shape
    const parsed = RunInferenceOutputSchema.parse(res);
    expect(parsed.ai_generated).toBe(true);
    expect(parsed.confidence_overall).toBeGreaterThan(0);
    expect(parsed.findings.length).toBeGreaterThan(0);
    for (const f of parsed.findings) {
      expect(f.ai_generated).toBe(true);
      expect(f.bbox_2d).toBeDefined();
      expect(f.confidence).toBeGreaterThanOrEqual(0);
      expect(f.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("trainModel returns a queued job_id in mock mode", async () => {
    const res = await trainModel({ datasetId: "ds_1", version: 3, modelType: "yolov11" });
    expect(res.job_id).toBe("job_mock_ds_1_v3");
    expect(res.status).toBe("queued");
    expect(res.dataset_id).toBe("ds_1");
    expect(res.eta_seconds).toBeGreaterThan(0);
  });

  it("deployInferenceEndpoint returns a valid HTTPS endpoint URL", async () => {
    const res = await deployInferenceEndpoint({
      modelId: "model_abc",
      version: 2,
      region: "eu-west",
    });
    expect(res.endpoint_url).toMatch(/^https:\/\//);
    expect(res.endpoint_url).toContain("model_abc");
    expect(res.endpoint_url).toContain("v2");
    expect(res.status).toBe("ready");
    expect(res.region).toBe("eu-west");
  });
});
