# Model card · Del Pilar Nexus canary (governance unlock)

**Version this file (or copy) per promoted ID. Incomplete → no status change.**

| Field | Value |
|-------|-------|
| Model name | praxisos-foot-seg / praxisos-foot-candidates |
| Exact model ID / version | `michaelba2712-gmail-com/praxisos-foot-seg/1` · `…/praxisos-foot-candidates/1` (canary path only) |
| Provider | Roboflow (private workspace) |
| Task | instance-seg + object-detection |
| Intended use | Decision support · clinician review only · **5% canary** (code max) |
| Out of scope | Diagnosis, triage, treatment choice, autonomous scoring, landmarks, full pin swap |
| Training data summary | Private Del Pilar Nexus project (Art. 9 — operational privacy unlock 2026-08-27) |
| Evaluation data summary | Shadow parallel eval + synthetic canary smoke (`PRAXIS_SHADOW_EVAL_ENABLED`) |
| Limitations | Formal DPA PDF pending; canary hard-capped at 5%; landmarks untrained; custom HTTP 405 residual |
| Ethical / privacy notes | See `privacy-gate.md` + `privacy-unlock-audit-2026-08-27.md` + `dpa-operational-residual.md` |
| Owner | Broser |
| Card version | `2026-08-27-canary-5` |
| Date | 2026-08-27 |

## Performance summary

Live host: `FOOT_VISION_CANARY_PERCENT=5`. Universe pins remain default (~95%); custom endpoints only inside canary bucket with suggestion-only copy. See `eval-report.md`.

## Clinical language

Default clinician/patient-facing line (do not invent stronger claims):

> Kandidatområde registreret; kræver kliniker-review.

## Rollback

Previous pin (exact): Universe `foot-segmentation-ehn9q/1`, `foot-ulcer/1`, `wounds-detection/1` (+ Trellis `firtoz/trellis`) — detail in `rollback-plan.md`
