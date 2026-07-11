// Biophysical Skin Inversion solver — stub-implementation (v1-analytical).
// Kontrakt: docs/harness/EPIC-3-Neural-Configurator.md §3
//
// Real ML-solver kommer i senere epic. Denne v1 er analytisk fallback:
// baseret på klient-profil + skanning-region-decomposition.

import type { BiophysicalMap, ClientProfile } from "./schema";
import { biophysicalMapSchema } from "./schema";

export type InversionInput = {
  scanId: string;
  meshRegions: string[];              // fx ["hallux", "heel", "arch", "midfoot", "forefoot"]
  clientProfile: ClientProfile;
};

export const BIOPHYSICAL_SOLVER_VERSION = "v1-analytical-stub";

/**
 * Analytisk fallback: mapper klient-profil til biofysiske region-egenskaber
 * baseret på simple kliniske heuristikker.
 */
export function runBiophysicalInversion(input: InversionInput): BiophysicalMap {
  const collagenBase = collagenFromAge(input.clientProfile.ageBand);
  const perfusionBase = perfusionFromClient(input.clientProfile);
  const hardnessBase = 45; // Shore A midt-værdi

  const regions = input.meshRegions.map((region_id, idx) => ({
    region_id,
    face_ids: [idx * 100, idx * 100 + 1, idx * 100 + 2], // stub face-ids
    collagen_density: clamp(collagenBase + regionCollagenOffset(region_id), 0, 1),
    shore_a_hardness: clamp(hardnessBase + regionHardnessOffset(region_id), 20, 90),
    perfusion_index: clamp(perfusionBase + regionPerfusionOffset(region_id), 0, 1),
    ai_generated: true as const,
  }));

  const map = biophysicalMapSchema.parse({
    scan_id: input.scanId,
    version: BIOPHYSICAL_SOLVER_VERSION,
    regions,
    overall_confidence: 0.65,   // stub confidence
    ai_generated: true,
  });
  return map;
}

function collagenFromAge(ageBand: string | undefined): number {
  if (!ageBand) return 0.6;
  const [start] = ageBand.split("-").map((s) => parseInt(s, 10));
  if (Number.isFinite(start)) {
    if (start! >= 70) return 0.35;
    if (start! >= 50) return 0.5;
    if (start! >= 30) return 0.65;
    return 0.75;
  }
  return 0.6;
}

function perfusionFromClient(profile: ClientProfile): number {
  if (profile.knownDiagnoses?.some((d) => d.toLowerCase().includes("diabet"))) return 0.35;
  if (profile.activityLevel === "high") return 0.8;
  if (profile.activityLevel === "low") return 0.5;
  return 0.65;
}

function regionCollagenOffset(region: string): number {
  if (region === "heel") return -0.05;
  if (region === "forefoot") return 0.05;
  return 0;
}

function regionHardnessOffset(region: string): number {
  if (region === "heel") return 20;    // hælhud er hårdere
  if (region === "arch") return -10;   // buen er blødere
  return 0;
}

function regionPerfusionOffset(region: string): number {
  if (region === "hallux") return -0.1; // storetæ har lavere perfusion typisk
  return 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
