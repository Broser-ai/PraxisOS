# Broser · manuel plantar E2E checklist (one-page)

**Purpose:** Complete the real plantar photo PASS path that agents cannot finish without a clinic photo.  
**Host:** `https://app.bypilar.dk` · Hetzner `167.233.171.184`  
**Branch / PR:** `cursor/integrate-all-superb-2c11` · #21  
**Canary:** `FOOT_VISION_CANARY_PERCENT=5` (code max) · Universe default · landmarks excluded

## Already automated (2026-08-27)

| Step | Result |
|------|--------|
| `GET /api/scan/config` | `liveReady: true`, blockers `[]` |
| `GET /api/v1/scan/process` | ARIA online · providers live |
| Synthetic non-PHI silhouette scan (`e2e-synth-0`) | Universe pins (`foot-ulcer/1`, `wounds-detection/1`); HOLD expected (tiny image / mesh 404) |
| Synthetic canary key (`e2e-synth-23`) | Custom path selected: `…/praxisos-foot-candidates/1` · note includes **canary 5%** + suggestion copy |
| Shadow flags | `PRAXIS_SHADOW_EVAL_ENABLED=true`, `PRAXIS_CAPTURE_GATE_SHADOW=true`, `PRAXIS_TRIVIEW_SHADOW_ENABLED=true` |
| Threshold / Trellis pin / landmarks | 70 unchanged · `firtoz/trellis` · landmarks not deployable |

## Human-only (Broser / clinician)

1. **Photo:** Sharp plantar (or medial+plantar+lateral if TriView A/B desired) of a consented clinic foot — **not** a synthetic blob.
2. Open `/scan` (or tenant scan UI) on `app.bypilar.dk` while logged in as clinic operator.
3. Upload / capture; wait for mesh + quality grade.
4. **Expect default (~95%):** Universe pins; PASS only if remote Trellis mesh + foot detect + score ≥ 70.
5. **If canary hit (~5%):** custom `praxisos-foot-seg` / `praxisos-foot-candidates`; findings must stay **candidate_*** / «Kandidatområde registreret; kræver kliniker-review.» — never diagnosis language.
6. Confirm journal / UI does **not** show autonomous diagnosis or treatment text.
7. Confirm landmarks never appear as active detections.
8. Optional: after scan, have ops dump memory-audit or enable `PRAXIS_AUDIT_MODE=supabase` and confirm `vision.shadow.*` / `vision.capture_gate.*` / `vision.triview.shadow` fired (host currently defaults to in-memory audit sink).

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Broser | Michael Ambrosius / Broser | _pending_ | [ ] Manual plantar PASS recorded |
| Ops witness | — | — | Automated portion above done 2026-08-27 |

## Known blockers for PASS today

- Live note (pre-fix): `Replicate HTTP 404: firtoz/trellis` was models-API 404 —
  fixed via versioned `/v1/predictions` + `generate_model:true` + `model_file` extract.
  Residual external: Replicate credit (HTTP 402) blocks live GLB until account is billed.
- Custom canary endpoints returned **HTTP 405** when version `/1` is undeployed
  (projects exist with 0 trained versions). Code now uses `serverless.roboflow.com`
  for workspace-qualified ids and fail-soft falls back to Universe on 405/404.
  Residual: annotate + train `praxisos-foot-seg` / `praxisos-foot-candidates` v1
  before canary custom traffic is clinically meaningful.
