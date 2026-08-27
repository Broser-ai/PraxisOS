# Audit checklist · Broser unlock 2026-08-27

**Immutable audit-event required for every promotion or pin change.**

| Field | Value |
|-------|-------|
| Event type | `vision.governance.unlock` / privacy `broser-unlock-2026-08-27` |
| Event ID | `broser-unlock-2026-08-27` |
| Timestamp (UTC) | 2026-08-27 |
| Actor (named human) | Broser: **Michael Ambrosius / Broser** |
| Model role | segmentation + candidates (governance); landmarks unchanged |
| From model ID | Universe live pins (unchanged) |
| To model ID | Custom endpoints for **5%** canary bucket; Universe default (~95%) |
| From status | `shadow` |
| To status | `canary` (governance + live 5%) |
| Eval report link | `eval-report.md` |
| Model card version | `2026-08-27-canary-5` |
| Rollback model ID | `foot-segmentation-ehn9q/1`, `foot-ulcer/1`, `wounds-detection/1`, `firtoz/trellis` |
| `approved_for_active_routing` after change | **true** (gate-checklist signed; canary **5%**) |

## Pre-flight

- [x] Pack complete: eval-report, model-card, rollback-plan, gate-checklist
- [x] Privacy gate operational accept documented (`privacy-unlock-audit-2026-08-27.md`)
- [x] No agent-only approval (human Broser order 2026-08-27)
- [x] Production thresholds / patient copy / retention **unchanged**

## Post-flight

- [x] Registry change log row added
- [x] Audit event documented in `docs/vision/privacy-unlock-audit-2026-08-27.md`
- [x] Smoke verification recorded (host curl 2026-08-27: `liveReady: true`, privacy_gate_open, canary **5**, threshold 70; Universe default + custom canary path verified)
