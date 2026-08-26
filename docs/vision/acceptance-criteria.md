# Acceptance criteria · Del Pilar Nexus vision

**Status:** gates for quality PASS, shadow pathology, and model promotion  
**Related:** `lib/scanner/quality.ts`, `model-governance.md`, `model-registry.md`

## A. Runtime quality gate (production)

Implemented in `scoreScanQuality` (`SCAN_QUALITY_THRESHOLD`, default **70**).

| Check ID | Weight | Pass when |
|----------|--------|-----------|
| `mesh_remote` | 35 | `meshUrl` is `http(s)` and not placeholder/procedural |
| `mesh_polled` | 15 | Replicate prediction finished successfully |
| `foot_detected` | 20 | Segment stage reports foot present |
| `image_resolution` | 10 | Unknown size OR ≥ 80 KB |
| `providers_live` | 10 | Live Roboflow/Replicate notes or remote mesh |
| `findings_confidence` | 10 | No findings OR ≥1 finding with confidence ≥ 0.55 |

**PASS** requires: `score ≥ threshold` **and** remote mesh **and** foot detected.  
Otherwise: **HOLD** (not clinically ready) — UI may still show demo/assist output.

### Acceptance tests

- [ ] Fixture scan with remote mesh + foot → PASS when score ≥ 70
- [ ] Procedural mesh → never PASS
- [ ] `footDetected: false` → never PASS
- [ ] Malformed Roboflow JSON → fail-closed note, no crash (`malformed-response.json`)

## B. Contract acceptance

Schemas in `contracts/`:

| Contract | Fixture |
|----------|---------|
| Detection | `tests/fixtures/roboflow/detection-candidate-open-wound.json` |
| Segmentation | `tests/fixtures/roboflow/segmentation-foot.json` |
| Keypoints | `tests/fixtures/roboflow/keypoints-visible-foot.json` |
| Negative | `tests/fixtures/roboflow/malformed-response.json` |

- [ ] Valid fixtures parse with schema helpers
- [ ] Malformed fixture is rejected
- [ ] Detection classes used in UI are treated as **candidates**, not diagnoses

## C. Shadow pathology promotion

A lesion/candidate model may leave `shadow` only if **all** hold:

1. Prospective clinic set: ≥ **N=50** de-identified exams (document N if different)
2. Clinician adjudication on candidate boxes (agree / disagree / unsure)
3. Primary classes (`ulcer_dfu`, `callus`, `fissure_heel`) meet agreed precision floor
   (set per release; default proposal **precision ≥ 0.70** on adjudicated set)
4. Skin-tone / nail-polish / lighting slices reported (no hidden collapse)
5. Clinician-facing copy still candidate-language only
6. Named Broser + clinician approvers; model card + audit event
7. Rollback model ID documented

Until then: log predictions, show “Candidate area detected; clinician review required.”

## D. Custom Roboflow `/1` swap (Universe → own)

- [ ] Projects match `annotation-atlas.md`
- [ ] Hosted version IDs written to registry
- [ ] Env / secrets updated by Broser only:
  - `ROBOFLOW_SEGMENT_MODEL`
  - `ROBOFLOW_MODEL`
  - `ROBOFLOW_MODEL_SECONDARY`
- [ ] `GET /api/scan/config` shows expected providers
- [ ] Smoke: one plantar photo through `/api/v1/scan/process` without 5xx

## E. Measurement / MonoMSK

MonoMSK outputs are **kinematic proxies**, not force-plate ground truth.

- [ ] Never labeled “clinical-grade” or “diagnostic” in UI
- [ ] Critical flags require clinician interpretation copy
- [ ] Keypoint model (when live) must not invent invisible points

## F. Privacy & governance

- [ ] `privacy-gate.md` checklist complete
- [ ] `model-governance.md` artifacts present for the change
- [ ] No agent merge/deploy of the change
