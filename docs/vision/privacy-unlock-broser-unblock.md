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
| `approved_for_active_routing` | **true** (governance) |
| `FOOT_VISION_CANARY_PERCENT` | **5** (code max; Universe still default ~95%) |
| `PRAXIS_TRIVIEW_SHADOW_ENABLED` | **true** (fail-soft; does not replace Trellis) |
| `PRAXIS_CAPTURE_GATE_SHADOW` | **true** |
| `SCAN_QUALITY_THRESHOLD` | **70** (unchanged) |

## Residual

- Formal DPA PDF archive still outstanding — `dpa-operational-residual.md`
- Manual plantar E2E PASS — `broser-plantar-e2e-checklist.md`
- Landmarks remain non-deployable
- Live Trellis HTTP 404 / custom canary HTTP 405 observed on synthetic smoke
