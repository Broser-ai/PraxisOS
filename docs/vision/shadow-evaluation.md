# Shadow evaluation · Del Pilar Nexus

**Status:** SHADOW_ONLY — live Universe primary at canary 0%  
**Relateret:** `privacy-gate.md`, `model-governance.md`, `model-registry.md`,
`privacy-unlock-audit-2026-08-27.md`,
`workflows/del-pilar-nexus-shadow-evaluation.json`

## What this does

When enabled, the scan pipeline fires **parallel** inference to custom Roboflow
endpoints (`praxisos-foot-seg`, `praxisos-foot-candidates`) and writes a
structured audit record for evaluation.

It does **not**:

- replace live Universe / Hetzner model pins,
- feed `SCAN_QUALITY_THRESHOLD` / quality grade,
- change patient-facing text or journal findings,
- call landmarks (`praxisos` — not deployable).

Live path stays: `foot-segmentation-ehn9q/1`, `foot-ulcer/1`,
`wounds-detection/1`, `firtoz/trellis`.

## Feature flag (default OFF)

| Variable | Default | Meaning |
|----------|---------|---------|
| `PRAXIS_SHADOW_EVAL_ENABLED` | unset / false | Must be `true` / `1` / `yes` / `on` to run shadow calls |

Code: `lib/scanner/shadow-inference.ts` · wired fire-and-forget from
`AlphaSpatiotemporalPipeline.executeAlphaScan`.

Combined guard: `mayRunShadowOnlyImageInference()` (shadow-only config **and**
open privacy-gate). Governance may set `approved_for_active_routing: true`
while live Universe pins stay primary at `FOOT_VISION_CANARY_PERCENT=0`
(see `lib/scanner/active-routing.ts`).

## Privacy gate (required before any image upload)

Even with the flag on, uploads are **blocked** unless every checklist item from
`privacy-gate.md` is set:

| Variable | Required |
|----------|----------|
| `PRAXIS_VISION_PRIVATE_PROJECT` | truthy |
| `PRAXIS_VISION_EU_ROUTE_DOCUMENTED` | truthy |
| `PRAXIS_VISION_DPA_SIGNED` | truthy |
| `PRAXIS_VISION_RESIDENCY_REVIEWED` | truthy |
| `PRAXIS_VISION_RETENTION_POLICY_SET` | truthy |
| `PRAXIS_VISION_HUMAN_APPROVER` | non-empty name (e.g. `Broser`) |
| `PRAXIS_VISION_PRIVACY_AUDIT_EVENT_ID` | non-empty audit-event id |

If the gate fails, the shadow call is **skipped** and
`vision.shadow.skipped` is logged with `privacy_fail_reasons` — **no image is sent**.

## Audit events

| Event | When |
|-------|------|
| `vision.shadow.skipped` | Flag off, gate fail, missing key/image, governance block |
| `vision.shadow.completed` | Parallel infer finished (per-endpoint latency, class, confidence, model ids, workflow id) |
| `vision.shadow.error` | Unexpected failure (fail-soft; primary scan continues) |

Records use hashed `scan_ref` / `tenant_ref` — no raw base64 or CPR.

## Governance pins

- `approved_for_active_routing`: **true** (Broser 2026-08-27)
- `governance.active_routing` / `replaces_live_universe_pins`: **false**
- `FOOT_VISION_CANARY_PERCENT`: **0** (Universe quality-gate primary)
- `deployment_state`: **shadow_only**
- Landmarks: **not deployable** / excluded from parallel inference
- AI findings = suggestions only («Kandidatområde registreret; kræver kliniker-review.»)

## Enable checklist (Broser)

1. Complete `privacy-gate.md` checklist and set the env vars above.
2. Set `PRAXIS_SHADOW_EVAL_ENABLED=true` on the evaluation host only.
3. Confirm Universe pins unchanged and quality threshold still 70.
4. Review audit sink for `vision.shadow.*` — never raise canary without
   `docs/vision/promotion/` pack + Broser review.

> **Unlock audit:** `docs/vision/privacy-unlock-audit-2026-08-27.md`
> (operational DPA accept; formal PDF pending).

## Clinician adjudication hook (ShadowFlywheel)

Schema placeholder: `lib/scanner/adjudication.ts`
(`praxisos.candidate_adjudication.v1` — agree / disagree / unsure).

- No fake clinical labels shipped
- Live custom traffic still gated by canary percent (0 = Universe only)
- Precision helper is a **proxy** for acceptance §C — not clinical GT
- Landmarks remain excluded from parallel inference until trained

Related: CaptureGate `docs/vision/capture-gate.md` · TriView
`docs/vision/triview-lift.md` · Harness `docs/vision/harness-human-gate.md`
