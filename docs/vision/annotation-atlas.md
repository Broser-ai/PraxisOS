# Annotation atlas · Del Pilar Nexus / Roboflow

**Status:** labeling SoT for custom projects  
**Workspace:** `michaelba2712-gmail-com`  
**Projects (planned):** `praxisos-foot-seg`, `praxisos-foot-pathology`,
`praxisos-foot-landmarks` (may reuse empty `PraxisOS` keypoint project)

Universe stand-ins in production today:

| Role | Current model ID |
|------|------------------|
| Segment | `foot-segmentation-ehn9q/1` |
| Pathology (primary) | `foot-ulcer/1` |
| Pathology (secondary) | `wounds-detection/1` |

## Capture guidance (clinic phone)

- Prefer sharp plantar overhead; also dorsal / medial / lateral when possible.
- Whole foot in frame; avoid faces, name badges, screens.
- Min ~80 KB JPEG for quality-gate credit; avoid heavy blur.
- De-identify before any research export (see `privacy-gate.md`).

## Project A — Instance segmentation (`praxisos-foot-seg`)

**Type:** instance segmentation (polygon masks)

| Class | Definition |
|-------|------------|
| `foot_plantar` | Plantar surface of one foot |
| `foot_dorsal` | Dorsal surface |
| `foot_medial` | Medial view |
| `foot_lateral` | Lateral view |
| `toes_region` | Digits as a group when separable |
| `heel_region` | Heel pad / rearfoot |

**Hard negatives:** empty floor, shoes only, hands, lower leg without foot, extreme blur.

**Success targets (first custom `/1`):** any-foot recall ≥ 0.95 on clinic phones;
mask IoU ≥ 0.85 on clear plantar; confidence &lt; 0.4 when no foot → app HOLD.

## Project B — Object detection (`praxisos-foot-pathology`)

**Type:** object detection (tight boxes)  
**MDR posture:** `shadow` until acceptance gates pass.

| Class | Notes |
|-------|-------|
| `ulcer_dfu` | Candidate DFU-like open area — not a diagnosis |
| `callus` | Hyperkeratotic plaque |
| `fissure_heel` | Heel fissure candidate |
| `hyperkeratosis` | Diffuse thickening |
| `onychomycosis_suspect` | Nail dystrophy candidate |
| `ingrown_nail_suspect` | Periungual inflammation candidate |
| `wart_suspect` | Verruca-like candidate |
| `hematoma_subungual` | Subungual discoloration candidate |
| `erythema_hotspot` | Focal erythema |
| `maceration_interdigital` | Interdigital maceration |
| `pressure_point_blanch` | Pressure mark |
| `scar_prior` | Prior scar |

**Label rules**

- One primary class per lesion; tight box.
- No severity grades in class names.
- Uncertain → broader class + annotator comment.
- UI/API consumer must map to clinician copy:
  `Candidate area detected; clinician review required` (+ optional class code in Broser UI only).

## Project C — Keypoints (`praxisos-foot-landmarks`)

**Type:** keypoint detection  
**Consumers:** MonoMSK landmark stream (heel, arch, ball, hallux, fifth, navicular, lateral, medial)

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
2. Segment: draw polygon around the foot region matching view class.
3. Pathology: box only visible candidate areas; when unsure, skip or use broader class.
4. Keypoints: place only if anatomically confident; otherwise not-visible.
5. Never write diagnostic prose in annotations.

## Active learning

False HOLD, missed candidates, and wrong boxes from `app.bypilar.dk/scan` →
de-identified review queue → weekly retrain → new `/n` version → registry + Broser
approval before env swap.
