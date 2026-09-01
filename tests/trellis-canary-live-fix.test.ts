import { describe, expect, it } from "vitest";
import {
  ROBOFLOW_DETECT_HOST,
  ROBOFLOW_SERVERLESS_HOST,
  buildRoboflowInferUrl,
  isRoboflowUndeployedStatus,
  isWorkspaceQualifiedModelId,
  roboflowInferenceHost,
} from "@/lib/scanner/roboflow-infer";
import {
  extractMeshUrl,
  parseOwnerName,
  parseVersionPin,
  runTrellisMeshPrediction,
} from "@/lib/scanner/trellis-mesh";

describe("roboflow-infer host selection", () => {
  it("treats workspace/project/version as custom", () => {
    expect(
      isWorkspaceQualifiedModelId(
        "michaelba2712-gmail-com/praxisos-foot-candidates/1",
      ),
    ).toBe(true);
    expect(isWorkspaceQualifiedModelId("foot-ulcer/1")).toBe(false);
  });

  it("routes custom models to serverless and Universe to detect", () => {
    expect(
      roboflowInferenceHost(
        "michaelba2712-gmail-com/praxisos-foot-seg/1",
      ),
    ).toBe(ROBOFLOW_SERVERLESS_HOST);
    expect(roboflowInferenceHost("foot-ulcer/1")).toBe(ROBOFLOW_DETECT_HOST);
    expect(
      buildRoboflowInferUrl(
        "michaelba2712-gmail-com/praxisos-foot-candidates/1",
        "key",
      ),
    ).toContain("serverless.roboflow.com");
  });

  it("maps undeployed statuses", () => {
    expect(isRoboflowUndeployedStatus(405)).toBe(true);
    expect(isRoboflowUndeployedStatus(404)).toBe(true);
    expect(isRoboflowUndeployedStatus(400)).toBe(false);
  });
});

describe("trellis-mesh helpers", () => {
  it("parses owner/name and version pins", () => {
    expect(parseOwnerName("firtoz/trellis")).toEqual({
      owner: "firtoz",
      name: "trellis",
    });
    expect(
      parseVersionPin(
        "firtoz/trellis:e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c",
      ),
    ).toBe("e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c");
    expect(
      parseVersionPin(
        "e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c",
      ),
    ).toBe("e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c");
    expect(parseVersionPin("firtoz/trellis")).toBeNull();
  });

  it("extracts Trellis model_file GLB URL", () => {
    expect(
      extractMeshUrl({
        model_file: "https://replicate.delivery/example/mesh.glb",
        color_video: "https://replicate.delivery/example/color.mp4",
      }),
    ).toBe("https://replicate.delivery/example/mesh.glb");
  });

  it("falls back to versioned predictions when models API 404s", async () => {
    const calls: string[] = [];
    const fetchFn: typeof fetch = async (url, init) => {
      const u = String(url);
      calls.push(`${init?.method ?? "GET"} ${u}`);
      if (u.includes("/v1/models/firtoz/trellis/predictions")) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ detail: "not found" }),
        } as Response;
      }
      if (u === "https://api.replicate.com/v1/models/firtoz/trellis") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            latest_version: {
              id: "e8f6c45206993f297372f5436b90350817bd9b4a0d52d2a76df50c1c8afa2b3c",
            },
          }),
        } as Response;
      }
      if (u === "https://api.replicate.com/v1/predictions") {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          version?: string;
          input?: { generate_model?: boolean; images?: string[] };
        };
        expect(body.version).toMatch(/^e8f6c452/);
        expect(body.input?.generate_model).toBe(true);
        expect(body.input?.images?.[0]).toContain("https://");
        return {
          ok: true,
          status: 201,
          json: async () => ({
            status: "succeeded",
            output: {
              model_file: "https://replicate.delivery/pbxt/test-mesh.glb",
            },
          }),
        } as Response;
      }
      throw new Error(`unexpected fetch ${u}`);
    };

    const result = await runTrellisMeshPrediction({
      imageUrl: "https://example.com/foot.jpg",
      token: "r8_test",
      fetchFn,
    });

    expect(result.polledOk).toBe(true);
    expect(result.meshUrl).toBe("https://replicate.delivery/pbxt/test-mesh.glb");
    expect(calls.some((c) => c.includes("/v1/predictions"))).toBe(true);
  });

  it("surfaces HTTP 402 insufficient credit clearly", async () => {
    const fetchFn: typeof fetch = async (url, init) => {
      const u = String(url);
      if (u.includes("/models/firtoz/trellis/predictions")) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ detail: "not found" }),
        } as Response;
      }
      if (u.includes("/v1/models/firtoz/trellis") && !u.includes("predictions")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            latest_version: { id: "abc123" },
          }),
        } as Response;
      }
      if (u.endsWith("/v1/predictions") && init?.method === "POST") {
        return {
          ok: false,
          status: 402,
          json: async () => ({
            detail: "You have insufficient credit",
            status: 402,
          }),
        } as Response;
      }
      throw new Error(`unexpected ${u}`);
    };

    const result = await runTrellisMeshPrediction({
      imageUrl: "https://example.com/foot.jpg",
      token: "r8_test",
      versionPin: "abc123",
      fetchFn,
    });
    expect(result.polledOk).toBe(false);
    expect(result.note).toMatch(/HTTP 402/);
    expect(result.note).toMatch(/insufficient credit/i);
  });
});
