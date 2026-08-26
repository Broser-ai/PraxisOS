# Rollback plan template

**Required:** exact previous model ID pin before any promotion.

| Field | Value |
|-------|-------|
| Role being changed | e.g. segment / candidates / landmarks / mesh |
| Env variable (if any) | e.g. `ROBOFLOW_SEGMENT_MODEL` |
| **New** model ID | |
| **Previous (rollback) model ID** | **exact pin required** |
| Registry row to update | |
| Who can execute rollback | Broser only |
| Trigger conditions | Metric regression / safety incident / copy violation |
| Verification after rollback | `GET /api/scan/config` + one smoke scan |

## Steps (human only)

1. Confirm previous ID still hosted / available.
2. Set env/secrets to **previous** exact pin (Broser).
3. Update `model-registry.md` status (`rolled_back` / restore prior `active`/`shadow`).
4. Emit audit event (`model.version.changed`) — see `audit-checklist.md`.
5. Smoke: one plantar photo through scan process without 5xx.

## Agents

Agents must **not** change production pins, thresholds, patient copy, or retention.
