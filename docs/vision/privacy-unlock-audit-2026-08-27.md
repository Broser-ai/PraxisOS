# Privacy unlock audit · 2026-08-27

**Event ID:** `broser-unlock-2026-08-27`  
**Approver:** Michael Ambrosius / Broser (human)  
**Authorization:** chat order 2026-08-27 — execute all 3 blocked unlocks  
**Branch:** `cursor/integrate-all-superb-2c11`  
**Host:** Hetzner `167.233.171.184` · `/opt/PraxisOS`

## What Broser ordered

1. Privacy-gate / `PRAXIS_VISION_*` unlock on production/eval host  
2. `PRAXIS_SHADOW_EVAL_ENABLED=true`  
3. Active-routing governance unlock (`approved_for_active_routing`)

## Formal vs operational

| Item | Status | Note |
|------|--------|------|
| Private Roboflow project path | **Operational accept** | Custom Del Pilar Nexus endpoints; not public Universe for Art. 9 training dump |
| EU route documented | **Operational accept** | EU self-host / private Roboflow path accepted by Broser for unlock |
| DPA | **Operational accept — formal PDF pending** | `PRAXIS_VISION_DPA_SIGNED=true` with `PRAXIS_VISION_DPA_STATUS=broser_operational_accept_2026-08-27`. **No fabricated legal DPA PDF.** Formal processor DPA file still to be archived. |
| Residens-review | **Operational accept** | Broser reviewed residency for approved EU path |
| Retention policy | **Operational accept** | Existing retention policies unchanged; flag records that policy is set |
| Named human approver | **Set** | `Michael Ambrosius Broser` |
| Audit event | **Set** | `broser-unlock-2026-08-27` |

## Env set on host (non-secret)

```
PRAXIS_VISION_PRIVATE_PROJECT=true
PRAXIS_VISION_EU_ROUTE_DOCUMENTED=true
PRAXIS_VISION_DPA_SIGNED=true
PRAXIS_VISION_DPA_STATUS=broser_operational_accept_2026-08-27
PRAXIS_VISION_RESIDENCY_REVIEWED=true
PRAXIS_VISION_RETENTION_POLICY_SET=true
PRAXIS_VISION_HUMAN_APPROVER=Michael Ambrosius Broser
PRAXIS_VISION_PRIVACY_AUDIT_EVENT_ID=broser-unlock-2026-08-27
PRAXIS_SHADOW_EVAL_ENABLED=true
PRAXIS_CAPTURE_GATE_SHADOW=true
PRAXIS_ACTIVE_ROUTING_ENABLED=true
FOOT_VISION_CANARY_PERCENT=0
```

## Follow-up · canary 5% + TriView shadow (same day)

**Authorization:** Broser chat order 2026-08-27 — «Kør alt og gør færdigt» (safe max canary).  
**Host action:** `/opt/PraxisOS/.env.production` updated; `praxisos` container recreated healthy.

```
FOOT_VISION_CANARY_PERCENT=5
PRAXIS_TRIVIEW_SHADOW_ENABLED=true
PRAXIS_CAPTURE_GATE_SHADOW=true   # confirmed still on
PRAXIS_SHADOW_EVAL_ENABLED=true   # confirmed still on
PRAXIS_ACTIVE_ROUTING_ENABLED=true
SCAN_QUALITY_THRESHOLD=70
REPLICATE_MESH_MODEL=firtoz/trellis
```

### Verification (live)

| Check | Result |
|-------|--------|
| `GET /api/scan/config` | `liveReady: true`, blockers `[]` |
| Default / non-canary synthetic (`bypilar\|e2e-synth-0`) | Universe `foot-ulcer/1` + `wounds-detection/1` |
| Canary synthetic (`bypilar\|e2e-synth-23`) | Custom `michaelba2712-gmail-com/praxisos-foot-candidates/1` · note **canary 5%** · suggestion copy |
| Landmarks | Not selected / not deployable |
| Clinical copy | «Kandidatområde registreret; kræver kliniker-review.» |
| TriView | Flag ON; fail-soft; live mesh pin still `firtoz/trellis` (does not replace Trellis) |

## Explicit non-changes

- `SCAN_QUALITY_THRESHOLD` remains **70**
- Universe pins remain **default** live quality-gate (~95% traffic); custom only inside 5% canary bucket
- Replicate Trellis (`firtoz/trellis`) pin unchanged (TriView is shadow A/B only)
- Landmarks (`praxisos`) remain **not deployable**
- Pathology language remains suggestion / `candidate_*` only
- No fabricated formal DPA PDF
- No agent merge to `main` without Broser + green CI

## Residual risk

- Formal DPA PDF not yet on file — see `dpa-operational-residual.md` (lawyer next step).
- Canary **5%** (code max) may hit private custom endpoints; Universe remains default.
- Synthetic E2E observed `Replicate HTTP 404: firtoz/trellis` and custom endpoint **HTTP 405** — real plantar PASS still human; see `broser-plantar-e2e-checklist.md`.
- Audit sink default memory — shadow events scheduled in-process; durable archive needs `PRAXIS_AUDIT_MODE=supabase`.
