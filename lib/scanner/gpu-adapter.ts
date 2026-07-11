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
    assertGpuBudget(input.tenantId, 30); // estimate: 30s
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN not set");
    }
    // Placeholder — real implementation ville POST'e til Replicate og poll'e.
    // For at holde denne fil selvstændig og testbar bruges stub-lifter i test.
    throw new Error("Replicate lifter not implemented in this scaffold");
  };
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
