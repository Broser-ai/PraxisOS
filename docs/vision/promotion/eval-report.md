# Evaluation report · Broser unlock 2026-08-27

**Fill before promotion. Incomplete → no status change.**

| Field | Value |
|-------|-------|
| Model / endpoint | `praxisos-foot-seg` + `praxisos-foot-candidates` (governance unlock) |
| Exact version ID (e.g. `endpoint/n`) | workspace `michaelba2712-gmail-com` / version `1` (when canary > 0) |
| From status → to status | `shadow` → `canary` (governance); **live traffic still Universe at 0%** |
| Task type | detect / seg |
| Eval date | 2026-08-27 |
| Dataset N (prospective / hold-out) | Shadow parallel only until canary > 0 |
| Adjudicator(s) | Deferred to clinician pack before canary raise |
| Report author | Ops agent (draft) under Broser order |
| Broser approver | **Michael Ambrosius / Broser** |

## Metrics (primary)

| Metric | Target | Observed | Pass? |
|--------|--------|----------|-------|
| Live Universe quality gate intact | threshold 70 | unchanged | yes |
| Custom models on patient PASS/HOLD | 0% until canary raise | canary=0 | yes |
| Landmarks off | deployable false | false | yes |

## Slice report (required)

| Slice | N | Metric | Notes |
|-------|---|--------|-------|
| Skin tone | — | — | Collect via shadow eval before canary > 0 |
| Nail polish | — | — | Collect via shadow eval before canary > 0 |
| Lighting | — | — | Collect via shadow eval before canary > 0 |
| Blur / motion | — | — | CaptureGate shadow log-only enabled |

## Failure modes

- Top false positives: TBD from shadow logs
- Top false negatives: TBD from shadow logs
- Known unsafe conditions (must HOLD / skip): landmarks untrained; formal DPA PDF pending

## Clinician copy check

- [x] Output language remains candidate-only (no diagnosis / triage / treatment)
- [x] Matches policy in `model-governance.md`

## Links

- Dataset / labeling job: Del Pilar Nexus shadow workflow `Z1TLmeAsa9GAWJg3xufe`
- Confusion matrix / dashboard: TBD
- Related acceptance section (`acceptance-criteria.md`): §A + §F; §D deferred
- Privacy audit: `../privacy-unlock-audit-2026-08-27.md`
