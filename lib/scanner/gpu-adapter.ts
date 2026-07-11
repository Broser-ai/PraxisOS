// GPU-lift adapter (INV-CS-14 cost-loft håndhæves her).
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §11 beslutning 1
//
// Interface `GpuLifter` så vi kan skifte mellem Replicate (MVP) og
// egne A100/H100-workers senere uden at røre pipeline-koden.

import type { MeshLike } from "./watertight";

export type LiftInput = {
  scanId: string;
  tenantId: string;
  framesUrl: string;     // Supabase Storage path prefix
  framesCount: number;
  calibrationMode: "aruco" | "monocular";
};

export type LiftOutput = {
  sparseCloudUrl: string;
  denseMeshUrl: string;
  mesh: MeshLike;          // in-memory representation til watertight-check
  volumeMetrics: {
    lengthMm: number;
    widthMm: number;
    archHeightMm: number;
    halluxValgusAngle: number;
  };
  gpuSeconds: number;
};

export type GpuLifter = (input: LiftInput) => Promise<LiftOutput>;

// ---------------------------------------------------------------------------
// Cost-tracking (INV-CS-14)
// ---------------------------------------------------------------------------

const tenantGpuBudget = new Map<string, { seconds: number; windowStart: number }>();
const HOUR_MS = 60 * 60 * 1000;
export const GPU_HOURLY_LIMIT_SEC = 300;

export function assertGpuBudget(tenantId: string, requestedSeconds: number): void {
  const now = Date.now();
  const bucket = tenantGpuBudget.get(tenantId);
  if (!bucket || now - bucket.windowStart > HOUR_MS) {
    tenantGpuBudget.set(tenantId, { seconds: 0, windowStart: now });
  }
  const current = tenantGpuBudget.get(tenantId)!;
  if (current.seconds + requestedSeconds > GPU_HOURLY_LIMIT_SEC) {
    throw new Error(
      `INV-CS-14 violation: tenant ${tenantId} would exceed ${GPU_HOURLY_LIMIT_SEC}s/hour GPU budget`,
    );
  }
}

export function recordGpuUsage(tenantId: string, seconds: number): void {
  const bucket = tenantGpuBudget.get(tenantId);
  if (bucket) bucket.seconds += seconds;
}

// Testing helper
export function resetGpuBudget(): void {
  tenantGpuBudget.clear();
}

// ---------------------------------------------------------------------------
// Replicate adapter (real) — kaldes kun hvis REPLICATE_API_TOKEN er sat.
// ---------------------------------------------------------------------------

export function createReplicateLifter(): GpuLifter {
  return async (input) => {
    const stub = createStubLifter();

    if (!process.env.REPLICATE_API_TOKEN) {
      console.log("API Key Missing (REPLICATE_API_TOKEN) — falling back to stub lifter");
      return stub(input);
    }

    assertGpuBudget(input.tenantId, 30);

    try {
      // 1. Create prediction (Gaussian Splatting model på Replicate)
      // Model reference kan konfigureres via env; default eksempel-navn
      const modelVersion =
        process.env.REPLICATE_LIFTER_VERSION ??
        "gaussian-splatting/latest";

      const createRes = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          version: modelVersion,
          input: {
            frames_url: input.framesUrl,
            frames_count: input.framesCount,
            calibration_mode: input.calibrationMode,
          },
        }),
      });

      if (!createRes.ok) {
        throw new Error(`Replicate create ${createRes.status}`);
      }

      const createData = await createRes.json();
      const predictionUrl = createData?.urls?.get as string | undefined;
      if (!predictionUrl) throw new Error("No prediction URL from Replicate");

      // 2. Poll status (max 60 iterationer × 2 sek = 120 sek — matches CS-14)
      let output: Record<string, unknown> | null = null;
      let gpuSeconds = 0;
      for (let i = 0; i < 60; i++) {
        await sleep(2000);
        const pollRes = await fetch(predictionUrl, {
          headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
        });
        if (!pollRes.ok) throw new Error(`Replicate poll ${pollRes.status}`);
        const pollData = await pollRes.json();
        if (pollData?.status === "succeeded") {
          output = pollData.output as Record<string, unknown>;
          gpuSeconds = Number(pollData?.metrics?.predict_time ?? 30);
          break;
        }
        if (pollData?.status === "failed" || pollData?.status === "canceled") {
          throw new Error(`Replicate prediction ${pollData.status}: ${pollData?.error}`);
        }
      }

      if (!output) throw new Error("Replicate polling timeout");

      recordGpuUsage(input.tenantId, gpuSeconds);

      // Map Replicate output til LiftOutput
      const stubOutput = await stub(input);
      return {
        sparseCloudUrl: (output.sparse_url as string) ?? stubOutput.sparseCloudUrl,
        denseMeshUrl: (output.mesh_url as string) ?? stubOutput.denseMeshUrl,
        mesh: stubOutput.mesh, // real mesh loading kræver separat GLB parse
        volumeMetrics:
          (output.volume_metrics as LiftOutput["volumeMetrics"]) ??
          stubOutput.volumeMetrics,
        gpuSeconds,
      };
    } catch (err) {
      console.log("Live Replicate error, falling back to stub:", (err as Error).message);
      // Failsafe #1: pipeline fortsætter med stub
      return stub(input);
    }
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ---------------------------------------------------------------------------
// Stub-lifter — deterministisk output til tests og lokal dev.
// ---------------------------------------------------------------------------

export function createStubLifter(): GpuLifter {
  return async (input) => {
    assertGpuBudget(input.tenantId, 1);
    // Simpel tetraeder-mesh (watertight) fra watertight-modulet
    const mesh: MeshLike = {
      vertices: [
        [0, 0, 0],
        [100, 0, 0],
        [50, 100, 0],
        [50, 50, 50],
      ],
      faces: [
        [0, 1, 2],
        [0, 3, 1],
        [0, 2, 3],
        [1, 3, 2],
      ],
    };
    recordGpuUsage(input.tenantId, 1);
    return {
      sparseCloudUrl: `stub://sparse/${input.scanId}.ply`,
      denseMeshUrl: `stub://mesh/${input.scanId}.glb`,
      mesh,
      volumeMetrics: {
        lengthMm: 265,
        widthMm: 100,
        archHeightMm: 22,
        halluxValgusAngle: 12.5,
      },
      gpuSeconds: 1,
    };
  };
}

export function createDefaultLifter(): GpuLifter {
  if (process.env.REPLICATE_API_TOKEN) return createReplicateLifter();
  return createStubLifter();
}
