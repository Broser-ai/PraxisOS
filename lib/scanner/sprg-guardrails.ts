// SPRG (Spatially-Precise Region Grounding) guardrails for the clinical scanner.
// Training-free framework that gates every VLM finding on anatomical evidence
// produced by a MedSAM-style segmenter. Findings whose bbox_2d does not fall
// inside any evidence region get flagged unverified and confidence-downgraded.
//
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §3.4 (SPRG), INV-CS-19
// Failsafe: MEDSAM_URL missing => mock regions (still gates deterministically).

import { z } from "zod";
import { bbox2dSchema, type Finding, type ScannerFindings } from "./findings-schema";
import { wrapWithGuards, type VlmCaller, type VlmInput } from "./vlm-caller";

// ---------------------------------------------------------------------------
// Constants & tunables
// ---------------------------------------------------------------------------

/** Confidence multiplier applied to findings that fail SPRG grounding. */
export const SPRG_UNVERIFIED_PENALTY = 0.6; // = 40 % downgrade

/** Canonical anatomical regions we always ground against. */
export const SPRG_REGION_IDS = [
  "heel",
  "arch",
  "forefoot",
  "hallux",
  "toes",
] as const;

export type SprgRegionId = (typeof SPRG_REGION_IDS)[number];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const anatomicalEvidenceSourceSchema = z.enum(["ROI-based", "None"]);

/**
 * A single anatomical evidence record — one region proposed by the segmenter,
 * with an optional semantic token (e.g. "arch-medial") used for prompt
 * grounding. `source` distinguishes real MedSAM output from the failsafe mock.
 */
export const anatomicalEvidenceSchema = z.object({
  region_id: z.enum(SPRG_REGION_IDS),
  bbox_2d: bbox2dSchema,
  semantic_token: z.string().min(1).max(80),
  source: anatomicalEvidenceSourceSchema,
});

export type AnatomicalEvidence = z.infer<typeof anatomicalEvidenceSchema>;

// ---------------------------------------------------------------------------
// MedSAM adapter
// ---------------------------------------------------------------------------

/**
 * MedSAM adapter contract — segments a single frame and returns anatomical
 * evidence for the canonical foot regions.
 */
export interface MedSamAdapter {
  segmentFrame(frameUrl: string, frameIndex: number): Promise<AnatomicalEvidence[]>;
}

/**
 * Deterministic mock regions covering the entire canonical region set.
 * Coordinates are in pixel-space of a nominal 640x480 frame; they are wide
 * enough to make plausible VLM boxes fall inside without being trivial.
 */
export function mockAnatomicalEvidence(frameIndex: number): AnatomicalEvidence[] {
  return [
    {
      region_id: "heel",
      bbox_2d: { frame_index: frameIndex, x: 40, y: 320, w: 160, h: 140 },
      semantic_token: "heel-plantar",
      source: "None",
    },
    {
      region_id: "arch",
      bbox_2d: { frame_index: frameIndex, x: 180, y: 260, w: 200, h: 160 },
      semantic_token: "arch-medial",
      source: "None",
    },
    {
      region_id: "forefoot",
      bbox_2d: { frame_index: frameIndex, x: 360, y: 240, w: 200, h: 160 },
      semantic_token: "forefoot-metatarsal",
      source: "None",
    },
    {
      region_id: "hallux",
      bbox_2d: { frame_index: frameIndex, x: 500, y: 220, w: 100, h: 120 },
      semantic_token: "hallux-distal",
      source: "None",
    },
    {
      region_id: "toes",
      bbox_2d: { frame_index: frameIndex, x: 420, y: 200, w: 180, h: 100 },
      semantic_token: "toes-2-5",
      source: "None",
    },
  ];
}

/**
 * Live MedSAM adapter — POSTs to `MEDSAM_URL` and expects a JSON payload of
 * anatomical evidence records. On any failure it degrades to `mockAnatomicalEvidence`.
 */
export function createMedSamAdapter(): MedSamAdapter {
  return {
    async segmentFrame(frameUrl, frameIndex) {
      const url = process.env.MEDSAM_URL;
      if (!url) {
        // Failsafe #1: no URL configured -> mock regions
        return mockAnatomicalEvidence(frameIndex);
      }
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ frame_url: frameUrl, frame_index: frameIndex }),
        });
        if (!res.ok) throw new Error(`MedSAM ${res.status}`);
        const raw = await res.json();
        const list = Array.isArray(raw) ? raw : raw?.regions;
        const parsed = z.array(anatomicalEvidenceSchema).parse(list);
        return parsed.length > 0 ? parsed : mockAnatomicalEvidence(frameIndex);
      } catch (err) {
        console.log("MedSAM error, using mock regions:", (err as Error).message);
        return mockAnatomicalEvidence(frameIndex);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// SPRG verification
// ---------------------------------------------------------------------------

/**
 * Result of gating a single finding through SPRG.
 * `verified=false` findings have already had their confidence downgraded.
 */
export interface SprgVerdict {
  finding: Finding;
  verified: boolean;
  matched_region_id: SprgRegionId | null;
  reason: string;
}

/**
 * Returns true if `box` lies fully inside `region` on the same frame.
 * Frame mismatch is an automatic fail — SPRG never grounds across frames.
 */
function bboxWithin(
  box: NonNullable<Finding["bbox_2d"]>,
  region: AnatomicalEvidence["bbox_2d"],
): boolean {
  if (box.frame_index !== region.frame_index) return false;
  return (
    box.x >= region.x &&
    box.y >= region.y &&
    box.x + box.w <= region.x + region.w &&
    box.y + box.h <= region.y + region.h
  );
}

/**
 * Core SPRG gate.
 *
 * For every finding:
 *   - if it has no bbox_2d       -> unverified, 40% confidence downgrade
 *   - if bbox_2d ⊄ any evidence  -> unverified, 40% confidence downgrade
 *   - otherwise                  -> verified, confidence unchanged
 *
 * The returned findings are re-emitted in the same order with the mutation
 * applied so downstream `enforceAiGenerated` still works.
 */
export function sprgVerify(
  findings: Finding[],
  evidence: AnatomicalEvidence[],
): { findings: Finding[]; verdicts: SprgVerdict[] } {
  const verdicts: SprgVerdict[] = [];
  const gated: Finding[] = findings.map((f) => {
    if (!f.bbox_2d) {
      const downgraded = { ...f, confidence: +(f.confidence * SPRG_UNVERIFIED_PENALTY).toFixed(4) };
      verdicts.push({
        finding: downgraded,
        verified: false,
        matched_region_id: null,
        reason: "no bbox_2d — cannot ground",
      });
      return downgraded;
    }
    const hit = evidence.find((e) => bboxWithin(f.bbox_2d!, e.bbox_2d));
    if (!hit) {
      const downgraded = { ...f, confidence: +(f.confidence * SPRG_UNVERIFIED_PENALTY).toFixed(4) };
      verdicts.push({
        finding: downgraded,
        verified: false,
        matched_region_id: null,
        reason: "bbox_2d outside all anatomical regions",
      });
      return downgraded;
    }
    verdicts.push({
      finding: f,
      verified: true,
      matched_region_id: hit.region_id,
      reason: `grounded in ${hit.region_id} (${hit.semantic_token})`,
    });
    return f;
  });
  return { findings: gated, verdicts };
}

// ---------------------------------------------------------------------------
// INV-CS-19 assertion
// ---------------------------------------------------------------------------

/**
 * INV-CS-19 — "Every clinically-actionable finding MUST be either anatomically
 * grounded via SPRG or explicitly marked as confidence-downgraded".
 *
 * Throws if a verdict violates the invariant (verified=false but confidence
 * was not actually reduced). Safe to call in tests and at pipeline boundaries.
 */
export function assertInvCs19(verdicts: SprgVerdict[], original: Finding[]): void {
  if (verdicts.length !== original.length) {
    throw new Error(
      `INV-CS-19 violation: verdict count ${verdicts.length} != findings ${original.length}`,
    );
  }
  for (let i = 0; i < verdicts.length; i++) {
    const v = verdicts[i];
    const before = original[i];
    if (!v.verified) {
      const expected = +(before.confidence * SPRG_UNVERIFIED_PENALTY).toFixed(4);
      if (Math.abs(v.finding.confidence - expected) > 1e-6) {
        throw new Error(
          `INV-CS-19 violation: finding ${before.id} unverified but confidence ` +
            `${v.finding.confidence} != expected ${expected}`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Higher-order caller wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps a raw VLM caller with:
 *   1. redaction + INV-CS-6 (`wrapWithGuards`)
 *   2. SPRG grounding against MedSAM evidence
 *   3. INV-CS-19 assertion on the resulting verdicts
 *
 * The returned caller has the same signature so it drops into existing
 * pipelines. Callers who want the verdicts can consume them via the returned
 * `ScannerFindings.overall_summary_da` prefix (`[SPRG: n/m grounded] …`).
 */
export function wrapWithSprgGuardrails(
  caller: VlmCaller,
  adapter: MedSamAdapter = createMedSamAdapter(),
): VlmCaller {
  const guarded = wrapWithGuards(caller);
  return async (input: VlmInput): Promise<ScannerFindings> => {
    const raw = await guarded(input);

    // Collect evidence for every referenced frame (dedupe by index)
    const frameIndexes = new Set<number>();
    for (const f of raw.findings) {
      if (f.bbox_2d) frameIndexes.add(f.bbox_2d.frame_index);
    }
    // Always segment at least frame 0 so bbox-less findings still have context
    if (frameIndexes.size === 0) frameIndexes.add(0);

    const evidence: AnatomicalEvidence[] = [];
    for (const idx of frameIndexes) {
      const url = input.frameUrls[idx] ?? input.frameUrls[0] ?? "";
      const regions = await adapter.segmentFrame(url, idx);
      evidence.push(...regions);
    }

    const originalFindings = raw.findings.map((f) => ({ ...f }));
    const { findings: gated, verdicts } = sprgVerify(raw.findings, evidence);
    assertInvCs19(verdicts, originalFindings);

    const groundedCount = verdicts.filter((v) => v.verified).length;
    return {
      ...raw,
      findings: gated,
      overall_summary_da: `[SPRG: ${groundedCount}/${verdicts.length} grounded] ${raw.overall_summary_da}`,
    };
  };
}
