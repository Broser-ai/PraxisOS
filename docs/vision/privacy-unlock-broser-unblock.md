# PrivacyUnlock-Σ · Broser unblock checklist (current host status)

**Date:** 2026-08-26  
**Integrate branch:** `cursor/integrate-all-superb-2c11`  
**Code status:** privacy-gate **complete** (fail-closed) — see `privacy-gate.ts` + tests  
**Ops status on this / eval path:** **CLOSED** — DPA / privacy env **not** signed

> Agents must **not** invent `PRAXIS_VISION_DPA_SIGNED` (or sibling flags).  
> `PRAXIS_SHADOW_EVAL_ENABLED` stays **false** until Broser completes PASS below.

## Verified on agent host (2026-08-26)

| Check | Result |
|-------|--------|
| `PRAXIS_VISION_*` in process / `.env.local` | **unset** (gate closed) |
| `PRAXIS_SHADOW_EVAL_ENABLED` | **false / unset** (correct — leave OFF) |
| `approved_for_active_routing` | **false** (workflow JSON + code) |
| `SCAN_QUALITY_THRESHOLD` | **70** (unchanged) |

## Broser unblock steps (human only)

Copy from `privacy-gate-broser-checklist.md` — all must PASS:

1. [ ] Private Roboflow project (not public Universe for Art. 9 uploads)
2. [ ] EU processing route documented
3. [ ] **DPA signed** with processor and archived
4. [ ] Residens-review for approved EU region
5. [ ] Retention policy for inference I/O
6. [ ] Named Broser human approver (not agent/CI)
7. [ ] Immutable `privacy.gate.passed.*` audit-event id

Then on **eval-host only**:

```bash
# Broser sets after checklist PASS — do not copy blindly to prod
PRAXIS_VISION_PRIVATE_PROJECT=true
PRAXIS_VISION_EU_ROUTE_DOCUMENTED=true
PRAXIS_VISION_DPA_SIGNED=true
PRAXIS_VISION_RESIDENCY_REVIEWED=true
PRAXIS_VISION_RETENTION_POLICY_SET=true
PRAXIS_VISION_HUMAN_APPROVER="<Broser full name>"
PRAXIS_VISION_PRIVACY_AUDIT_EVENT_ID="privacy.gate.passed.<date>"
PRAXIS_SHADOW_EVAL_ENABLED=true
```

Confirm after enable:

- Universe pins unchanged (`foot-segmentation-ehn9q/1`, `foot-ulcer/1`, `wounds-detection/1`, `firtoz/trellis`)
- `approved_for_active_routing` still false
- Threshold still 70
- Audit shows `vision.shadow.completed` or honest `privacy_gate` skips — never silent upload

## Agent non-actions (locked)

- Do not set privacy env in repo secrets or claim PASS
- Do not enable shadow eval in `.env.example` defaults
- Do not promote models or merge to `main`
