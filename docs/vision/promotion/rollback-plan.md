# Rollback plan · Broser unlock 2026-08-27

**Required:** exact previous model ID pin before any promotion.

| Field | Value |
|-------|-------|
| Role being changed | segment / candidates (governance unlock; live still Universe) |
| Env variable (if any) | `FOOT_VISION_CANARY_PERCENT`, `PRAXIS_ACTIVE_ROUTING_ENABLED`, `ROBOFLOW_*` |
| **New** model ID | Custom canary path only when percent > 0: `praxisos-foot-seg` / `praxisos-foot-candidates` |
| **Previous (rollback) model ID** | `foot-segmentation-ehn9q/1` · `foot-ulcer/1` · `wounds-detection/1` · mesh `firtoz/trellis` |
| Registry row to update | `docs/vision/model-registry.md` |
| Who can execute rollback | Broser only |
| Trigger conditions | Metric regression / safety incident / copy violation / canary issues |
| Verification after rollback | `GET /api/scan/config` + one smoke scan · `liveReady: true` |

## Immediate rollback (canary)

1. Set `FOOT_VISION_CANARY_PERCENT=0` on host (already default for this unlock).
2. Optionally set `PRAXIS_ACTIVE_ROUTING_ENABLED=false`.
3. Restart `praxisos` container.
4. Confirm Universe pins still in `.env.production`.

## Full pin rollback (if env pins were swapped — not done in this unlock)

1. Confirm previous ID still hosted / available.
2. Set env/secrets to **previous** exact pin (Broser).
3. Update `model-registry.md` status (`rolled_back` / restore prior `active`/`shadow`).
4. Emit audit event (`model.version.changed`) — see `audit-checklist.md`.
5. Smoke: one plantar photo through scan process without 5xx.

## Agents

Agents must **not** raise canary above Broser-approved max (code ceiling 5%) or change production thresholds / patient copy / retention.
