// GPU-lift adapter (INV-CS-14 cost-loft haandhaeves her).
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md paragraph 11 beslutning 1
//
// Interface `GpuLifter` saa vi kan skifte mellem Replicate (MVP) og
// egne A100/H100-workers senere uden at roere pipeline-koden.
//
// Sprint 6 B5: cost-tracking flyttet fra lokal Map til SharedStore saa
// budget-haandhaevelsen holder paa tvaers af serverless-instances. Uden det
// kunne en angriber ramme forskellige warm-instances og omgaa CS-14.

import type { MeshLike } from "./watertight";
import {
  getDefaultSharedStore,
  setDefaultSharedStore,
  type SharedStore,
} from "@/lib/shared-store/adapter";
import { createMemorySharedStore } from "@/lib/shared-store/memory-store";

export type LiftInput = {
  scanId: string;
  tenantId: string;
  framesUrl: string;
  framesCount: number;
  calibrationMode: "aruco" | "monocular";
};

export type LiftOutput = {
  sparseCloudUrl: string;
  denseMeshUrl: string;
  mesh: MeshLike;
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
// Cost-tracking (INV-CS-14) via SharedStore
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
export const GPU_HOURLY_LIMIT_SEC = 300;

function budgetKey(tenantId: string): string {
  return `gpu:budget:hourly:${tenantId}`;
}

/**
 * Kaster hvis tenanten ville overskride CS-14 cost-loft. Bruger SharedStore
 * saa haandhaevelsen holder paa tvaers af serverless-instances.
 */
export async function assertGpuBudget(
  tenantId: string,
  requestedSeconds: number,
  store: SharedStore = getDefaultSharedStore(),
): Promise<void> {
  const current = await store.getCounter(budgetKey(tenantId));
  if (current + requestedSeconds > GPU_HOURLY_LIMIT_SEC) {
    throw new Error(
      `INV-CS-14 violation: tenant ${tenantId} would exceed ${GPU_HOURLY_LIMIT_SEC}s/hour GPU budget`,
    );
  }
}

/**
 * Registrer forbrug. Foerste gang i en time saetter vi TTL saa bucketten
 * ruller efter HOUR_MS.
 */
export async function recordGpuUsage(
  tenantId: string,
  seconds: number,
  store: SharedStore = getDefaultSharedStore(),
): Promise<void> {
  const key = budgetKey(tenantId);
  const existing = await store.getCounter(key);
  if (existing === 0) {
    await store.setCounterWithTtl(key, seconds, HOUR_MS);
  } else {
    await store.incrementCounter(key, seconds);
  }
}

/**
 * Testing/admin helper. Med tenantId: nulstiller kun den tenants bucket.
 * Uden tenantId: nulstiller HELE default-store'n (behaviourpreserving for
 * legacy tests der ryddede den lokale Map). Multi-tenant prod boer altid
 * bruge den tenant-scopede variant.
 */
export async function resetGpuBudget(
  tenantId?: string,
  store: SharedStore = getDefaultSharedStore(),
): Promise<void> {
  if (tenantId) {
    await store.resetCounter(budgetKey(tenantId));
    return;
  }
  // Ingen enumerate-API i SharedStore-kontrakten - swap default-store i
  // stedet saa alle counters (inkl. rate-limit) starter forfra.
  setDefaultSharedStore(createMemorySharedStore());
}

// ---------------------------------------------------------------------------
// Replicate adapter (real) - kaldes kun hvis REPLICATE_API_TOKEN er sat.
// ---------------------------------------------------------------------------

// Sprint 6 blocker B7 · fail-closed clinical guard
function assertGpuStubAllowed(reason: string): void {
  const isProd = process.env.NODE_ENV === "production";
  const allow = process.env.PRAXIS_GPU_ALLOW_STUB === "1";
  if (isProd && !allow) {
    throw new Error(
      `[scanner/gpu] Refuser stub-lift i produktion (${reason}). ` +
      "Fake mesh + volumeMetrics kan ende i clinical findings via SPRG. " +
      "Sæt PRAXIS_GPU_ALLOW_STUB=1 kun for dev-tests.",
    );
  }
}

export function createReplicateLifter(): GpuLifter {
  return async (input) => {
    const stub = createStubLifter();

    if (!process.env.REPLICATE_API_TOKEN) {
      console.log("API Key Missing (REPLICATE_API_TOKEN) - falling back to stub lifter");
      assertGpuStubAllowed("REPLICATE_API_TOKEN missing");
      return stub(input);
    }

    await assertGpuBudget(input.tenantId, 30);

    try {
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

      await recordGpuUsage(input.tenantId, gpuSeconds);

      const stubOutput = await stub(input);
      return {
        sparseCloudUrl: (output.sparse_url as string) ?? stubOutput.sparseCloudUrl,
        denseMeshUrl: (output.mesh_url as string) ?? stubOutput.denseMeshUrl,
        mesh: stubOutput.mesh,
        volumeMetrics:
          (output.volume_metrics as LiftOutput["volumeMetrics"]) ??
          stubOutput.volumeMetrics,
        gpuSeconds,
      };
    } catch (err) {
      console.log("Live Replicate error, falling back to stub:", (err as Error).message);
      assertGpuStubAllowed(`Replicate error: ${(err as Error).message}`);
      return stub(input);
    }
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ---------------------------------------------------------------------------
// Stub-lifter - deterministisk output til tests og lokal dev.
// ---------------------------------------------------------------------------

export function createStubLifter(): GpuLifter {
  return async (input) => {
    await assertGpuBudget(input.tenantId, 1);
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
    await recordGpuUsage(input.tenantId, 1);
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
