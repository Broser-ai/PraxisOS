# Promotion gate checklist

Master gate before **any** of:

- status leave `shadow` / `disabled` toward `canary` / `active`
- `approved_for_active_routing: true` on a workflow
- env pin swap away from legacy Universe / Replicate production IDs

**Policy:** `../model-governance.md`  
**Acceptance:** `../acceptance-criteria.md`  
**Landmarks:** also `../landmarks-training-brief.md`

## A. Governance (`model-governance.md`)

- [x] Named human approver (Broser) — **Michael Ambrosius / Broser**
- [x] Evaluation report filled (`eval-report.md`) — governance unlock / canary 0%
- [x] Versioned model card (`model-card.md`)
- [x] Rollback model ID exact (`rollback-plan.md`) — current Universe pins
- [x] Immutable audit-event (`audit-checklist.md`) — `broser-unlock-2026-08-27`
- [x] Suggestions-only / candidate language preserved
- [x] Agents did not merge to main, change thresholds, or invent DPA PDF

## B. Acceptance (`acceptance-criteria.md`)

- [x] §A quality gate behavior unchanged (threshold **70**)
- [x] §B contracts/fixtures still pass for affected task
- [x] §C shadow pathology gates: N/A for live swap (canary **0%**); shadow parallel only
- [x] §D custom `/1` swap checklist: **deferred** — Universe pins remain primary until canary > 0
- [x] §E measurement / keypoints: landmarks stay non-deployable
- [x] §F privacy + governance artifacts present (`privacy-unlock-audit-2026-08-27.md`)

## C. Routing flag (explicit)

- [x] `approved_for_active_routing: true` — Broser ordered 2026-08-27
- [x] Live Universe/Replicate pins **unchanged** (`FOOT_VISION_CANARY_PERCENT=0`)
- [x] `PRAXIS_ACTIVE_ROUTING_ENABLED=true` (env unlock) with canary 0%
- [x] Landmarks endpoint excluded while `candidate_untrained` / `deployable: false`
- [x] `governance.active_routing=false` and `replaces_live_universe_pins=false`

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Broser | Michael Ambrosius / Broser | 2026-08-27 | Chat order — execute all 3 blocked unlocks |
| Clinician adjudicator (if required) | — | — | Deferred until canary > 0 |

**Live cutover:** still blocked at canary 0%. Raising `FOOT_VISION_CANARY_PERCENT` (code max 5) requires separate Broser canary review.
