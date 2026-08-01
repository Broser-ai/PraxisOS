# Zip ingest · praxisos.zip (Google Drive)

**Source:** `https://drive.google.com/file/d/1zMF3AhyiUjIyniDzW8V1GGvOASFkl5FT`  
**Downloaded:** 2026-08-01 · 3.68 GB · local path `/tmp/praxis-ingest/praxisos.zip`  
**Snapshot date (content):** ~2026-07-15 → 2026-07-17 (Sprint 6 Batch 3 / STATUS-SPRINTS-1-7)

## What’s in the zip (by size)

| Bucket | ~Size | Action |
|---|---|---|
| `prototype/.next` | 3.2 GB | Ignore (build cache) |
| `prototype/node_modules` | 590 MB | Ignore |
| `modules/foot-scanner/vendor` (FOCUS/FIND weights) | ~570–840 MB | Ignore for git · keep source only |
| `prototype` source (app/lib/tests/…) | ~27 MB | Valuable · overlaps `savage-sweep` |
| Root status/reports + `docs/` | <5 MB | Ingested into `docs/` |

## Reality vs current branch (`cursor/swarm-savage-execution-2c11`)

**Zip / savage-sweep has (we don’t on this branch):**
- `lib/scanner/*`, `lib/learning/*`, `lib/configurator/*`, `lib/voice/*`, `lib/gait/*`, FHIR/finance helpers
- Migrations `0002_foot_scanner` … `0009_enable_rls…` (zip numbering differs from our `0002_seed` / `0004_swarm_state`)
- ~334 tests claimed in STATUS (scanner/regulatory/learning suites)
- `modules/foot-scanner` Python service
- Three.js / gaussian-splatting deps

**This branch has (zip does not):**
- Working-core: `lib/data/repo.ts` + `memory.ts`, signed auth hardening path we built, Supabase client path
- Full S-H swarm: `lib/swarm/*`, awaken daemon, cron tick, `/admin/swarm`
- Verified API keys + `/api/auth/me` session-tenant staff UI
- Migration `0004_swarm_state.sql`

**Already on GitHub as unmerged remote:** `origin/savage-sweep-2026-07-12` contains essentially the same scanner/learning/voice libs as the zip — so the zip is a **bundle/export**, not a secret new codebase.

## Selective ingest done now

Copied into repo (no ML weights, no node_modules):
- `docs/ingest/STATUS-SPRINTS-1-7.md`
- `docs/ingest/MICHAELS-ACTION-LIST.md`
- `docs/ingest/OVERNIGHT-REPORT.md`
- `docs/harness/EPIC-*.md` + `SPRINT-6-BLOCKER-PLAN.md`

## Recommended next (needs Michael go)

1. **Do not** dump the 3.7 GB zip or vendor `.pth` into git.
2. **Prefer cherry-pick / selective merge from `savage-sweep-2026-07-12`** onto working-core+swarm — not from zip blobs.
3. Migration renumbering plan before merge (our `0002_seed` / `0004_swarm` vs their `0002_foot_scanner`…).
4. Keep Class IIa scanner/configurator **frozen** behind flags (aligns with Presafe on-hold).
5. Keep swarm safety: `NO_AUTO_MERGE` / `NO_AUTO_DEPLOY`.

## Human blockers still only Michael can close

From zip `MICHAELS-ACTION-LIST.md`: Ortos LOI, Patient-Zero clinics, Presafe (on hold), live API keys, PRRC.
