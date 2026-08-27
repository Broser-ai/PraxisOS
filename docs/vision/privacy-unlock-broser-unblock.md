# PrivacyUnlock-Σ · Broser unblock checklist

**Date:** 2026-08-27 (updated)  
**Integrate branch:** `cursor/integrate-all-superb-2c11`  
**Code status:** privacy-gate **complete** (fail-closed)  
**Ops status:** **OPEN** on Hetzner — see `privacy-unlock-audit-2026-08-27.md`

> DPA flag is **operational accept** (`PRAXIS_VISION_DPA_STATUS=broser_operational_accept_2026-08-27`).  
> Formal processor DPA PDF is still pending — do not invent a fake PDF.

## Verified after Broser unlock (2026-08-27)

| Check | Result |
|-------|--------|
| `PRAXIS_VISION_*` on Hetzner `.env.production` | **set** (gate open) |
| `PRAXIS_SHADOW_EVAL_ENABLED` | **true** |
| `approved_for_active_routing` | **true** (governance; canary 0%) |
| `FOOT_VISION_CANARY_PERCENT` | **0** (Universe primary) |
| `SCAN_QUALITY_THRESHOLD` | **70** (unchanged) |

## Residual

- Formal DPA PDF archive still outstanding
- Raise canary only after Broser review (code max 5%)
- Landmarks remain non-deployable
