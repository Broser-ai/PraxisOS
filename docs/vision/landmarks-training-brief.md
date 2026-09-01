# Landmarks training brief · `praxisos` (keypoint-detection)

**Status:** `candidate_untrained` · **deployable: false** · **not runnable in shadow parallel inference**  
**Endpoint:** `praxisos`  
**Registry / SoT:** `model-registry.md`, `annotation-atlas.md`,
`workflows/del-pilar-nexus-shadow-evaluation.json`, `lib/scanner/shadow-workflow.ts`

> **Not deployable until trained + clinician-adjudicated.**  
> Do not select this endpoint for any deployable, active, canary, or shadow-parallel
> inference path until Broser completes training, evaluation, and promotion gates.

## Required keypoint schema

Contract: `contracts/roboflow-keypoints.schema.ts`  
Fixture: `tests/fixtures/roboflow/keypoints-visible-foot.json`

Each nested keypoint **must** be:

| Field | Type | Notes |
|-------|------|-------|
| `x` | number | Image-space coordinate |
| `y` | number | Image-space coordinate |
| `class_name` | non-empty string | Atlas keypoint ID (e.g. `heel_center`) |
| `class_id` | integer | Stable class index |
| `confidence` | number 0–1 | Low / invisible → not invented downstream |

Parent prediction wraps `keypoints[]` with bbox fields (`class`, `confidence`,
`x`, `y`, `width`, `height`). Schemas are **strict** (unknown keys rejected).

Observable floor for consumers: `isKeypointObservable` (confidence ≥ 0.25).
Invisible points: mark not-visible in Roboflow UI — never invent coordinates.

## Planned keypoint set

See `annotation-atlas.md` Project C. Target labels include heel, malleoli,
navicular, cuboid, MTP1/5, hallux tip, digit tips, arch apex, midfoot center.

## Dataset needs (before any train / promote)

1. De-identified clinic phone images (plantar + dorsal / medial / lateral when possible).
2. Privacy gate complete (`privacy-gate.md`) before any export or hosted train.
3. Annotator brief: keypoints **out of scope** until Broser opens labeling;
   then follow atlas definitions; no diagnostic prose in annotations.
4. Hold-out / prospective slice for adjudication (skin tone, nail polish, lighting,
   blur) — document N; align with acceptance criteria section E when live.
5. Versioned train run → hosted `/n` ID written to registry **only** after Broser
   approval (agents must not promote).

## Acceptance / promotion pointers

| Gate | Doc |
|------|-----|
| Quality PASS / HOLD | `acceptance-criteria.md` §A |
| Keypoint contract | `acceptance-criteria.md` §B + keypoints schema |
| Measurement / MonoMSK (when live) | `acceptance-criteria.md` §E — no invented invisible points |
| Human promotion pack | `model-governance.md` + `docs/vision/promotion/` |
| Status machine | `disabled` → `shadow` only after train + adjudicate + pack |

Until then:

- Registry status remains `disabled` / `candidate_untrained`
- `deployable: false`
- `approved_for_active_routing: false` (workflow-wide)
- Shadow helpers **skip** the landmarks endpoint (`isLandmarksEndpointRunnable() === false`)

## Explicit non-goals

- No active routing, canary, or production pin swap for landmarks in this brief
- No change to `SCAN_QUALITY_THRESHOLD`, patient copy, or retention
- No agent merge/deploy/promotion
