# Evaluation report template

**Fill before promotion. Incomplete → no status change.**

| Field | Value |
|-------|-------|
| Model / endpoint | |
| Exact version ID (e.g. `endpoint/n`) | |
| From status → to status | |
| Task type | detect / seg / keypoints |
| Eval date | |
| Dataset N (prospective / hold-out) | |
| Adjudicator(s) | |
| Report author | |
| Broser approver | **required** |

## Metrics (primary)

| Metric | Target | Observed | Pass? |
|--------|--------|----------|-------|
| | | | |

## Slice report (required)

| Slice | N | Metric | Notes |
|-------|---|--------|-------|
| Skin tone | | | |
| Nail polish | | | |
| Lighting | | | |
| Blur / motion | | | |

## Failure modes

- Top false positives:
- Top false negatives:
- Known unsafe conditions (must HOLD / skip):

## Clinician copy check

- [ ] Output language remains candidate-only (no diagnosis / triage / treatment)
- [ ] Matches policy in `model-governance.md`

## Links

- Dataset / labeling job:
- Confusion matrix / dashboard:
- Related acceptance section (`acceptance-criteria.md`):
