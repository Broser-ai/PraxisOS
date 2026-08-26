# Promotion gate checklist

Master gate before **any** of:

- status leave `shadow` / `disabled` toward `canary` / `active`
- `approved_for_active_routing: true` on a workflow
- env pin swap away from legacy Universe / Replicate production IDs

**Policy:** `../model-governance.md`  
**Acceptance:** `../acceptance-criteria.md`  
**Landmarks:** also `../landmarks-training-brief.md`

## A. Governance (`model-governance.md`)

- [ ] Named human approver (Broser)
- [ ] Evaluation report filled (`eval-report.md`)
- [ ] Versioned model card (`model-card.md`)
- [ ] Rollback model ID exact (`rollback-plan.md`)
- [ ] Immutable audit-event (`audit-checklist.md`)
- [ ] Suggestions-only / candidate language preserved
- [ ] Agents did not merge, deploy, or change thresholds

## B. Acceptance (`acceptance-criteria.md`)

- [ ] §A quality gate behavior unchanged unless separately approved
- [ ] §B contracts/fixtures still pass for affected task
- [ ] §C shadow pathology gates (if candidate/lesion model): N, adjudication, precision floor, slices, copy, approvers, rollback
- [ ] §D custom `/1` swap checklist (if replacing Universe pin)
- [ ] §E measurement / keypoints: no invented invisible points (if landmarks)
- [ ] §F privacy + governance artifacts present

## C. Routing flag (explicit)

- [ ] `approved_for_active_routing` remains **false** until this entire checklist is signed
- [ ] Live Universe/Replicate pins unchanged until Broser executes env swap
- [ ] Landmarks endpoint excluded from deployable + shadow-parallel paths while `candidate_untrained` / `deployable: false`

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Broser | | | |
| Clinician adjudicator (if required) | | | |

**Default if unsigned:** no promotion · routing stays false · landmarks stay non-deployable.
