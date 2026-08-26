# CaptureGate-Σ · shadow capture quality signals

**Status:** implemented (audit / shadow) — does **not** drive PASS/HOLD  
**Flag:** `PRAXIS_CAPTURE_GATE_SHADOW` (default **OFF**)  
**Code:** `lib/scanner/capture-gate.ts` · wired fire-and-forget from `alpha-pipeline.ts`  
**Spike:** `docs/vision/alphaxiv-top3-spikes.md` §1 · impact memo §C.2

## Contract

Shadow JSON (audit event `vision.capture_gate.shadow`):

| Field | Meaning |
|-------|---------|
| `blur_proxy` | 0–1 sharper estimate (laplacian or bytes/pixel heuristic) |
| `exposure_proxy` | 0–1 mid-tone fitness |
| `crop_foot_ratio` | foot bbox area ratio or null |
| `usable_view_proxy` | combined 0–1 |
| `slice_tags[]` | lighting / blur / crop / usable tags |
| `uncertainty_band` | `low` \| `med` \| `high` |
| `drives_pass_hold` | **always false** |
| `used_for_quality_gate` | **always false** |

## Hard rules

- `SCAN_QUALITY_THRESHOLD` stays **70** — CaptureGate never changes it
- Does not replace `scoreScanQuality`
- Does not change patient-facing language
- AI / capture signals = suggestions for ops review only

## Enable (Broser)

1. Confirm privacy posture for any clinic photo review (separate from this logger).
2. Set `PRAXIS_CAPTURE_GATE_SHADOW=true` on eval host.
3. Review `vision.capture_gate.shadow` / `.skipped` audits.
4. Correlate with clinician «optag igen» labels before any future gate proposal.
