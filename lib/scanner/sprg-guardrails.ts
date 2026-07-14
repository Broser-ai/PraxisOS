// SPRG (Spatially-Precise Region Grounding) guardrails for the clinical scanner.
// Training-free framework that gates every VLM finding on anatomical evidence
// produced by a MedSAM-style segmenter. Findings whose bbox_2d does not fall
// inside any evidence region — OR whose label does not match the semantically-
// plausible region set — get flagged unverified and confidence-downgraded.
//
// Kontrakt: docs/harness/EPIC-2-Clinical-Scanner.md §3.4 (SPRG), INV-CS-19
//
// SECURITY-FIXES efter innovation-swarm HIGH-verify (2026-07-13):
// 1. `source: 'None' | 'ROI-based'` propageres til SprgVerdict + summary-prefix
//    → clinician kan skelne mellem 'grounded mod fake data' og 'grounded mod real MedSAM'.
// 2. Mock-fallback er nu OPT-IN via PRAXIS_SPRG_ALLOW_MOCK=1 — throws ellers i prod
//    → forhindrer INV-CS-19 fra at blive false-confidence signal.
// 3. Label→region-map: hallux valgus grounded på heel-region afvises som mismatch
//    → geometric containment ≠ anatomisk grounding.
// 4. Final `enforceAiGenerated` kaldes på wrapped output → INV-CS-6 re-asserted.
// 5. `overall_summary_da` og `frameUrls` redagteres via redactPII → INV-CS-11.
// 6. MedSAM fetch har nu AbortController med 5s timeout → forhindrer hang.

import { z } from "zod";
import {
  bbox2dSchema,
  enforceAiGenerated,
  type Finding,
  type ScannerFindings,
} from "./findings-schema";
import { wrapWithGuards, type VlmCaller, type VlmInput } from "./vlm-caller";
import { redactPII } from "../redact";

// ---------------------------------------------------------------------------
// Constants & tunables
// ---------------------------------------------------------------------------

/** Confidence multiplier applied to findings that fail SPRG grounding. */
export const SPRG_UNVERIFIED_PENALTY = 0.6; // = 40 % downgrade

export const SPRG_MEDSAM_TIMEOUT_MS = 5000;

/** Canonical anatomical regions we always ground against. */
export const SPRG_REGION_IDS = [
  "heel",
  "arch",
  "forefoot",
  "hallux",
  "toes",
] as const;

export type SprgRegionId = (typeof SPRG_REGION_IDS)[number];

/**
 * Label→plausible-region map. Prevents "geometric containment" from being
 * mistaken for anatomical grounding. Fx en hallux-valgus-finding må IKKE
 * accepteres som grounded mod heel-region selv om bbox tilfældigvis ligger der.
 * Match er substring (case-insensitive) mod finding.label.
 */
export const SPRG_LABEL_REGION_MAP: Array<{ pattern: RegExp; regions: SprgRegionId[] }> = [
  { pattern: /hallux|storet[æa]/i, regions: ["hallux", "forefoot"] },
  { pattern: /valgus|bunion/i, regions: ["hallux", "forefoot"] },
  { pattern: /plantar\s*fasc/i, regions: ["heel", "arch"] },
  { pattern: /heel\s*spur|calcaneal/i, regions: ["heel"] },
  { pattern: /callus|hyperkerat|corn|clavus/i, regions: ["forefoot", "heel", "hallux"] },
  { pattern: /ulcer|s[åa]r/i, regions: ["forefoot", "heel", "hallux", "toes"] },
  { pattern: /verruca|wart|vorte/i, regions: ["forefoot", "heel", "toes"] },
  { pattern: /arch|pes\s*planus|flat\s*foot/i, regions: ["arch", "heel"] },
  { pattern: /metatars/i, regions: ["forefoot"] },
  { pattern: /hammert|claw\s*toe/i, regions: ["toes"] },
  { pattern: /morton/i, regions: ["forefoot"] },
  { pattern: /achill?es|hindfoot/i, regions: ["heel"] },
];

/**
 * Return the set of anatomically-plausible regions for a finding-label.
 * If no rule matches, returns null → SPRG then allows any region (backwards-
 * compatible: only reject when we know the label's true anatomy).
 */
export function plausibleRegionsForLabel(label: string): SprgRegionId[] | null {
  for (const { pattern, regions } of SPRG_LABEL_REGION_MAP) {
    if (pattern.test(label)) return regions;
  }
  return null;
}

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
 * source: "None" markerer at det er mock — bruges kun hvis PRAXIS_SPRG_ALLOW_MOCK=1.
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

/** Return true hvis mock er tilladt (test-env eller eksplicit opt-in). */
function mockAllowed(): boolean {
  return (
    process.env.PRAXIS_SPRG_ALLOW_MOCK === "1" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true"
  );
}

/**
 * Live MedSAM adapter — POSTs to `MEDSAM_URL` and expects a JSON payload of
 * anatomical evidence records.
 *
 * Failure-modes:
 *   - MEDSAM_URL missing + mockAllowed → returns mockAnatomicalEvidence (source='None')
 *   - MEDSAM_URL missing + prod        → throws (no silent-degrade)
 *   - fetch error/timeout + mockAllowed → mock
 *   - fetch error/timeout + prod       → throws
 */
export function createMedSamAdapter(): MedSamAdapter {
  return {
    async segmentFrame(frameUrl, frameIndex) {
      const url = process.env.MEDSAM_URL;
      if (!url) {
        if (mockAllowed()) return mockAnatomicalEvidence(frameIndex);
        throw new Error("SPRG: MEDSAM_URL not configured (set PRAXIS_SPRG_ALLOW_MOCK=1 to opt into mock)");
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), SPRG_MEDSAM_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            // INV-CS-11: redakter frameUrl før den forlader vores kontrol
            frame_url: typeof frameUrl === "string" ? redactPII(frameUrl) : frameUrl,
            frame_index: frameIndex,
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`MedSAM ${res.status}`);
        const raw = await res.json();
        const list = Array.isArray(raw) ? raw : raw?.regions;
        const parsed = z.array(anatomicalEvidenceSchema).parse(list);
        if (parsed.length > 0) return parsed;
        // Empty response: fail loudly unless mock allowed
        if (mockAllowed()) return mockAnatomicalEvidence(frameIndex);
        throw new Error("SPRG: MedSAM returned empty regions");
      } catch (err) {
        clearTimeout(timer);
        if (mockAllowed()) {
          console.log("MedSAM error, using mock regions:", (err as Error).message);
          return mockAnatomicalEvidence(frameIndex);
        }
        // Fail loudly in prod
        throw err instanceof Error ? err : new Error(String(err));
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
  /** Source of the matched evidence — 'ROI-based' (real) or 'None' (mock). */
  matched_source: AnatomicalEvidence["source"] | null;
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
 * Core SPRG gate — now with label→region correlation.
 *
 * For every finding:
 *   - no bbox_2d                                    → unverified, downgrade
 *   - bbox_2d ⊄ any evidence                        → unverified, downgrade
 *   - label knows its plausible regions AND matched region NOT in that set
 *                                                   → unverified (mismatch), downgrade
 *   - otherwise                                     → verified, confidence unchanged
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
        matched_source: null,
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
        matched_source: null,
        reason: "bbox_2d outside all anatomical regions",
      });
      return downgraded;
    }

    // Label→region plausibility check
    const plausible = plausibleRegionsForLabel(f.label);
    if (plausible && !plausible.includes(hit.region_id)) {
      const downgraded = { ...f, confidence: +(f.confidence * SPRG_UNVERIFIED_PENALTY).toFixed(4) };
      verdicts.push({
        finding: downgraded,
        verified: false,
        matched_region_id: hit.region_id,
        matched_source: hit.source,
        reason: `label "${f.label}" implausible in region ${hit.region_id} (expected ${plausible.join("/")})`,
      });
      return downgraded;
    }

    verdicts.push({
      finding: f,
      verified: true,
      matched_region_id: hit.region_id,
      matched_source: hit.source,
      reason: `grounded in ${hit.region_id} (${hit.semantic_token}, ${hit.source})`,
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
    const v = verdicts[i]!;
    const before = original[i]!;
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
 *   3. Label→region plausibility check
 *   4. INV-CS-19 assertion on the resulting verdicts
 *   5. FINAL `enforceAiGenerated` re-check on the wrapped output
 *   6. `overall_summary_da` redaction via redactPII
 *   7. Summary prefix distinguishes ROI-based vs mock grounding
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
    if (frameIndexes.size === 0) frameIndexes.add(0);

    const evidence: AnatomicalEvidence[] = [];
    for (const idx of frameIndexes) {
      // INV-CS-11: redakter frameUrl før den sendes til MedSAM
      const url = input.frameUrls[idx] ?? input.frameUrls[0] ?? "";
      const cleanUrl = typeof url === "string" ? (redactPII(url) as string) : url;
      const regions = await adapter.segmentFrame(cleanUrl, idx);
      evidence.push(...regions);
    }

    const originalFindings = raw.findings.map((f) => ({ ...f }));
    const { findings: gated, verdicts } = sprgVerify(raw.findings, evidence);
    assertInvCs19(verdicts, originalFindings);

    // Compute source-aware grounded counts
    const roiGrounded = verdicts.filter((v) => v.verified && v.matched_source === "ROI-based").length;
    const mockGrounded = verdicts.filter((v) => v.verified && v.matched_source === "None").length;
    const total = verdicts.length;

    // Build honest prefix: distinguish real vs mock grounding
    let prefix: string;
    if (mockGrounded > 0 && roiGrounded === 0) {
      prefix = `[SPRG: mock · ${mockGrounded}/${total} grounded against synthetic regions]`;
    } else if (mockGrounded > 0) {
      prefix = `[SPRG: ${roiGrounded}/${total} ROI-grounded · ${mockGrounded}/${total} mock-grounded]`;
    } else {
      prefix = `[SPRG: ${roiGrounded}/${total} ROI-grounded]`;
    }

    // INV-CS-11: redakter summary før persistering
    const cleanSummary = redactPII(raw.overall_summary_da ?? "");
    const finalSummary = `${prefix} ${cleanSummary}`;

    // FINAL INV-CS-6 + schema re-check on the wrapped output
    return enforceAiGenerated({
      ...raw,
      findings: gated,
      overall_summary_da: finalSummary,
    });
  };
}
