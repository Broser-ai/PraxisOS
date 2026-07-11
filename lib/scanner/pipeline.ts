// Scanner-pipeline orkestrator (Level 1 → 2 → 3).
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §2, §3

import { checkWatertight } from "./watertight";
import type { GpuLifter } from "./gpu-adapter";
import type { VlmCaller } from "./vlm-caller";
import { wrapWithGuards } from "./vlm-caller";
import type { ScannerFindings } from "./findings-schema";

export const PIPELINE_TIMEOUT_MS = 180_000; // INV-CS-13

export type PipelineInput = {
  scanId: string;
  tenantId: string;
  clientId?: string;
  framesUrl: string;
  framesCount: number;
  calibrationMode: "aruco" | "monocular";
  clientContext: {
    ageBand?: string;
    sex?: "M" | "F" | "other";
    knownDiagnoses?: string[];
  };
};

export type PipelineResult =
  | {
      status: "done";
      denseMeshUrl: string;
      watertight: boolean;
      qualityScore: number;
      findings: ScannerFindings;
      gpuSeconds: number;
      latencyMs: number;
    }
  | {
      status: "error" | "aborted";
      error: { code: string; message: string };
      latencyMs: number;
    };

export type PipelineDeps = {
  lifter: GpuLifter;
  vlm: VlmCaller;
};

export async function runPipeline(
  deps: PipelineDeps,
  input: PipelineInput,
): Promise<PipelineResult> {
  const startedAt = Date.now();
  const timeout = new Promise<PipelineResult>((resolve) =>
    setTimeout(
      () =>
        resolve({
          status: "aborted",
          error: { code: "PIPELINE_TIMEOUT", message: `> ${PIPELINE_TIMEOUT_MS}ms` },
          latencyMs: Date.now() - startedAt,
        }),
      PIPELINE_TIMEOUT_MS,
    ),
  );
  const work = (async (): Promise<PipelineResult> => {
    try {
      // Level 2: Geometric lifting
      const lifted = await deps.lifter({
        scanId: input.scanId,
        tenantId: input.tenantId,
        framesUrl: input.framesUrl,
        framesCount: input.framesCount,
        calibrationMode: input.calibrationMode,
      });

      // INV-CS-1: watertight-check
      const wt = checkWatertight(lifted.mesh);
      if (!wt.isWatertight) {
        return {
          status: "error",
          error: {
            code: "INV-CS-1",
            message: `Mesh not watertight: ${wt.reasons.join("; ")}`,
          },
          latencyMs: Date.now() - startedAt,
        };
      }

      // Level 3: VLM findings (wrap with redact + INV-CS-6 guard)
      const vlmGuarded = wrapWithGuards(deps.vlm);
      const findings = await vlmGuarded({
        scanId: input.scanId,
        frameUrls: [], // populated by caller when real
        meshUrl: lifted.denseMeshUrl,
        volumeMetrics: lifted.volumeMetrics as unknown as Record<string, number>,
        clientContext: input.clientContext,
      });

      const qualityScore = estimateQuality(wt.eulerCharacteristic, input.framesCount);

      return {
        status: "done",
        denseMeshUrl: lifted.denseMeshUrl,
        watertight: true,
        qualityScore,
        findings,
        gpuSeconds: lifted.gpuSeconds,
        latencyMs: Date.now() - startedAt,
      };
    } catch (e) {
      const err = e as Error;
      const code = err.message.startsWith("INV-CS-") ? err.message.split(":")[0]! : "RUNTIME_ERROR";
      return {
        status: "error",
        error: { code, message: err.message },
        latencyMs: Date.now() - startedAt,
      };
    }
  })();

  return Promise.race([work, timeout]);
}

function estimateQuality(euler: number, framesCount: number): number {
  // Simpel heuristik: baseret på topologi og frame-count
  let q = 0.5;
  if (euler === 2) q += 0.3;
  if (framesCount >= 20) q += 0.15;
  if (framesCount >= 30) q += 0.05;
  return Math.min(1, q);
}
