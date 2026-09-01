# Annotation atlas · Del Pilar Nexus / Roboflow

**Status:** labeling SoT for custom projects (shadow evaluation)  
**Workspace:** `michaelba2712-gmail-com`  
**Shadow workflow:** `del-pilar-nexus-shadow-evaluation-1787761439900`
(`Z1TLmeAsa9GAWJg3xufe`) · `deployment_state: shadow_only` ·
`approved_for_active_routing: false`

**Projects / endpoints:**

| Endpoint | Task | Registry status |
|----------|------|-----------------|
| `praxisos-foot-seg` | instance-segmentation | `shadow` |
| `praxisos-foot-candidates` | object-detection | `shadow` |
| `praxisos` | keypoint-detection | `disabled` (untrained / not deployable; skipped in shadow parallel) |

Universe stand-ins in **production** today (unchanged):

| Role | Current model ID |
|------|------------------|
| Segment | `foot-segmentation-ehn9q/1` |
| Pathology (primary) | `foot-ulcer/1` |
| Pathology (secondary) | `wounds-detection/1` |

Machine-readable class lists: `docs/vision/workflows/del-pilar-nexus-shadow-evaluation.json`.

## Capture guidance (clinic phone)

- Prefer sharp plantar overhead; also dorsal / medial / lateral when possible.
- Whole foot in frame; avoid faces, name badges, screens.
- Min ~80 KB JPEG for quality-gate credit; avoid heavy blur.
- De-identify before any research export (see `privacy-gate.md`).
- Video shadow sources: `live_smartphone_frames`, `recorded_video` @ 3 fps sampling.

## Project A — Instance segmentation (`praxisos-foot-seg`)

**Type:** instance segmentation (polygon masks)  
**Registry status:** `shadow` (not live routing)

| Class | Definition |
|-------|------------|
| `foot` | Whole visible foot (any clinical view) |
| `toes_region` | Digits as a group when separable |
| `heel_region` | Heel pad / rearfoot |

**Hard negatives:** empty floor, shoes only, hands, lower leg without foot, extreme blur.

**Success targets (first custom `/1`):** any-foot recall ≥ 0.95 on clinic phones;
mask IoU ≥ 0.85 on clear plantar; confidence &lt; 0.4 when no foot → app HOLD.

## Project B — Object detection (`praxisos-foot-candidates`)

**Type:** object detection (tight boxes)  
**MDR posture:** `shadow` until acceptance gates pass.  
**Naming:** `candidate_*` only — never diagnosis language in class IDs or UI copy.

| Class | Notes |
|-------|-------|
| `candidate_open_wound` | Open wound–like area candidate — not a diagnosis |
| `candidate_localised_hyperkeratosis` | Localised hyperkeratotic plaque candidate |
| `candidate_heel_fissure` | Heel fissure candidate |

**Label rules**

- One primary class per lesion; tight box.
- No severity grades in class names.
- Uncertain → skip or broader candidate class + annotator comment.
- UI/API consumer must map to clinician copy:
  `Kandidatområde registreret; kræver kliniker-review.` (+ optional class code in Broser UI only).

## Project C — Keypoints (`praxisos`)

**Type:** keypoint detection  
**Registry status:** `disabled` · `deployment_state: candidate_untrained` ·
**deployable: false** · **not runnable** in shadow parallel inference

**Training brief (SoT for schema + dataset + gates):**
`landmarks-training-brief.md`

Do not train or route until Broser opens labeling per that brief. Planned
consumers (when enabled): MonoMSK landmark stream (heel, arch, ball, hallux,
fifth, navicular, lateral, medial). Nested keypoint fields must be
`x`, `y`, `class_name`, `class_id`, `confidence` (strict Zod contract).

| Keypoint | Hint |
|----------|------|
| `heel_center` | Calcaneal contact center |
| `medial_malleolus_proj` | Medial malleolus projection |
| `lateral_malleolus_proj` | Lateral malleolus projection |
| `navicular` | Navicular prominence |
| `cuboid` | Cuboid region |
| `mtp1` | 1st MTP |
| `mtp5` | 5th MTP |
| `hallux_tip` | Hallux tip |
| `digit2_tip` | 2nd toe tip |
| `digit5_tip` | 5th toe tip |
| `arch_apex` | Medial arch high point |
| `midfoot_center` | Midfoot center |

Invisible keypoints: mark as not-visible per Roboflow keypoint UI — do not invent.

## Annotator brief (non-ML clinic assistant)

1. Skip images with faces or readable IDs → quarantine.
2. Segment: draw polygon for `foot` / `toes_region` / `heel_region` as applicable.
3. Candidates: box only visible `candidate_*` areas; when unsure, skip.
4. Keypoints: **not in scope** until landmarks leave `disabled` (see training brief).
5. Never write diagnostic prose in annotations.

## Active learning

False HOLD, missed candidates, and wrong boxes from `app.bypilar.dk/scan` →
de-identified review queue → weekly retrain → new `/n` version → registry + Broser
approval before env swap. Agents must not promote shadow → active.
