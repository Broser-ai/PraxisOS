# Harness-HumanGate · LUNA → ranked spike → draft PR

**Status:** scaffold + docs — **NO_AUTO_MERGE** hard-coded  
**Script:** `node scripts/harness-human-gate.mjs`  
**Swarm:** `lib/swarm/meta-harness.ts` · `SWARM_INVARIANTS.NO_AUTO_MERGE === true`  
**Impact:** `docs/vision/alphaxiv-aurelle-transcript-impact.md` §C.5

## Workflow

1. **LUNA** — `runResearchHarvest` / research task (`enqueueSwarmTask` type `research`)
2. **Rank** — score against impact memo / top-3 spikes (`Priority = Impact×Feasibility/MDR`)
3. **Draft** — FELIX/ATLAS worktree branch `cursor/swarm-*-2c11` (ready_for_review)
4. **FREJ** — compliance gate (thresholds, pins, routing, privacy)
5. **Human** — `humanApproveTask` with `SWARM_APPROVE_TOKEN` + named approver

## Hard invariants

| Invariant | Value |
|-----------|-------|
| `NO_AUTO_MERGE` | **true** (never merge to `main` from daemon/script) |
| `NO_AUTO_DEPLOY` | **true** |
| `approved_for_active_routing` | **false** |
| Overnight auto-merge daemon | **Forbidden** |

## What this is not

- Not a daemon that pushes to `main`
- Not permission to enable shadow image upload without privacy PASS
- Not model promotion

## Quick start

```bash
node scripts/harness-human-gate.mjs
node scripts/harness-human-gate.mjs --spike CaptureGate-Σ
```

Prints ranked spike note + draft PR title suggestion, then **stops**.
