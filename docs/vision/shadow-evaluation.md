# Shadow evaluation · Del Pilar Nexus

**Status:** SHADOW_ONLY — active routing remains **OFF**  
**Relateret:** `privacy-gate.md`, `model-governance.md`, `model-registry.md`,
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

## Governance pins (must stay)

- `approved_for_active_routing`: **false**
- `deployment_state`: **shadow_only**
- AI findings = suggestions only («Kandidatområde registreret; kræver kliniker-review.»)

## Enable checklist (Broser)

1. Complete `privacy-gate.md` checklist and set the env vars above.
2. Set `PRAXIS_SHADOW_EVAL_ENABLED=true` on the evaluation host only.
3. Confirm Universe pins unchanged and quality threshold still 70.
4. Review audit sink for `vision.shadow.*` — never promote without
   `docs/vision/promotion/` pack.
