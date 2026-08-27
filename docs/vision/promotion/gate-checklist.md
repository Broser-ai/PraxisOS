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
- [x] Evaluation report filled (`eval-report.md`) — governance unlock / canary **5%**
- [x] Versioned model card (`model-card.md`)
- [x] Rollback model ID exact (`rollback-plan.md`) — current Universe pins
- [x] Immutable audit-event (`audit-checklist.md`) — `broser-unlock-2026-08-27`
- [x] Suggestions-only / candidate language preserved
- [x] Agents did not merge to main, change thresholds, or invent DPA PDF

## B. Acceptance (`acceptance-criteria.md`)

- [x] §A quality gate behavior unchanged (threshold **70**)
- [x] §B contracts/fixtures still pass for affected task
- [x] §C shadow pathology gates: shadow parallel ON; live custom only inside 5% canary
- [x] §D custom `/1` swap checklist: **partial** — canary 5% selects custom; Universe remains default
- [x] §E measurement / keypoints: landmarks stay non-deployable
- [x] §F privacy + governance artifacts present (`privacy-unlock-audit-2026-08-27.md`, `dpa-operational-residual.md`)

## C. Routing flag (explicit)

- [x] `approved_for_active_routing: true` — Broser ordered 2026-08-27
- [x] Live Universe/Replicate pins remain **default**; canary **5%** (code max) may select custom
- [x] `PRAXIS_ACTIVE_ROUTING_ENABLED=true` with `FOOT_VISION_CANARY_PERCENT=5`
- [x] Landmarks endpoint excluded while `candidate_untrained` / `deployable: false`
- [x] `governance.active_routing=false` and `replaces_live_universe_pins=false`
- [x] Suggestion-only clinical copy verified on canary synthetic smoke

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Broser | Michael Ambrosius / Broser | 2026-08-27 | Chat order — unlock + «Kør alt og gør færdigt» (canary 5%) |
| Clinician adjudicator (if required) | — | — | Deferred until manual plantar PASS + formal DPA |

**Live full cutover:** still blocked (`replaces_live_universe_pins=false`). Safe-max canary **5%** live on Hetzner.
