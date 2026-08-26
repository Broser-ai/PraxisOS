# TriView-Lift · InstantMesh A/B (shadow-only)

**Status:** scaffolded — feature-flagged, default **OFF**, fail-soft  
**Flag:** `PRAXIS_TRIVIEW_SHADOW_ENABLED` (default **OFF**)  
**Optional model:** `PRAXIS_TRIVIEW_INSTANTMESH_MODEL` (must **not** be `firtoz/trellis`)  
**Code:** `lib/scanner/triview-lift.ts` · scheduled from `alpha-pipeline.ts`  
**Spike:** `docs/vision/alphaxiv-top3-spikes.md` §2 · impact memo §C.4

## Spike contract

| Input | Output (shadow artifact) |
|-------|--------------------------|
| 3 phone frames (medial / plantar / lateral) preferred; single plantar allowed for dry-run | `{ trellis_glb_url, instantmesh_glb_url?, hausdorff_proxy?, latency_ms, winner_shadow_only, frames_present }` |

## Hard rules

- Live mesh pin remains **`firtoz/trellis`**
- Never set `replaces_live_trellis: true`
- Never swap `REPLICATE_MESH_MODEL` / production mesh env
- UI continues to show production TRELLIS path only
- `approved_for_active_routing` stays **false**
- Nail SSS is **not** a clinical mesh driver

## Enable (Broser, eval only)

1. Provide InstantMesh-compatible Replicate model/version ≠ TRELLIS.
2. Set `PRAXIS_TRIVIEW_SHADOW_ENABLED=true` on eval host only.
3. Collect 3-frame sessions; review `vision.triview.shadow` audits.
4. Rollback = flag OFF (no pin change).
