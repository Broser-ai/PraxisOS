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

## Explicit non-changes

- `SCAN_QUALITY_THRESHOLD` remains **70**
- Universe pins remain live quality-gate primary (`foot-segmentation-ehn9q/1`, `foot-ulcer/1`, `wounds-detection/1`)
- Replicate Trellis (`firtoz/trellis`) unchanged
- Landmarks (`praxisos`) remain **not deployable**
- Pathology language remains suggestion / `candidate_*` only
- TriView remains OFF
- No merge to `main` required for this unlock

## Residual risk

Formal DPA PDF not yet on file — operational unlock only. Canary at **0%** means custom models do not yet replace Universe for patient PASS/HOLD; raise `FOOT_VISION_CANARY_PERCENT` (max 5 in code) only after Broser canary review.
