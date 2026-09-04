# Open PR triage — 2026-09-04

**Order:** Broser «færdig kodet alle åbne»  
**`main` tip after stack land:** `adbea38f7c8967f775fdf9220bea21fbdcf68c78`  
**Verify:** `npx tsc --noEmit` clean · `npx vitest run` → **57 files / 521 tests pass**  
**Live health:** still expected **`dbMode=mock` / memory** until Broser Hetzner cutover (no deploy from this work).

Hard locks preserved in product code: `NO_AUTO_MERGE` / `NO_AUTO_DEPLOY` · `suggestion_only` · `NO_AUTO_JOURNAL_SIGN` · `NO_MODEL_TRAINING` · `PATHOLOGY_SHADOW`.  
Git merge of reviewed draft PRs to `main` was authorized by Broser for this order.

---

## Merged to `main` (this run)

| PR | Branch | Merge SHA on main | Notes |
|----|--------|-------------------|-------|
| **#36** | `cursor/foundation-status-audit-33db` | `f2b373f` | docs audit |
| **#33** | `cursor/p0-execution-slices-2c11` | `c17947a` | F4–F10 · 269 tests pre-merge |
| **#34** | `cursor/continue-dev-slices-2c11` | `8e75573` | F11–F84 · 516 tests pre-merge · **commits on main; GH PR may still show OPEN** (integration cannot close) |
| **#35** | `cursor/prime-execution-control-complete-33db` | `1efc114` (+ tip fix `2d3af3f`) | `/api/agents/missions*` aliases · typecheck + F29 markers + PEC evidence fallback |

Stack branch heads `#33/#34/#35/#36` are **0 commits ahead** of `main` after land.

---

## Superseded by `main` / P0 stack (close when API allows)

Content already on `main` via integrate-superb, Trellis, sandbox, Drive research, Bird, PEC, and/or F4–F84. **No remaining unique code to land.**

| PR | Why superseded |
|----|----------------|
| **#34** | Commits merged via git (`8e75573`); close for bookkeeping |
| **#24** | Sandbox verify path already on main (`scripts/sandbox-verify.sh`, `docs/ops/sandbox-verify.md`, compose/env) |
| **#23** | `docs/vision/drive-folders-research-gap.md` already on main |
| **#22** | Trellis canary + `lib/scanner/trellis-mesh.ts` + tests already on main (`065a745` lineage) |
| **#9** | Agent automation largely absorbed into superb + PEC + F12/F41 |
| **#7** | Bird SMS routes/UI on main; hardened further by F5/F36/F69 |
| **#5** | Clinic-core bookings/clients loop superseded by working-core + F4+ |
| **#4** | Old savage-sweep finish · conflicting · superseded by current main |
| **#3** | S-H swarm savage worktree · human-gated stack already on main |
| **#2** | Working-core auth/signup/bookings · on main via superb |

---

## Blocked on Hetzner / Broser cutover (leave OPEN — do **not** deploy)

| PR | Blocker |
|----|---------|
| **#25** | Supabase→Hetzner migrate · delete gate not green · needs SSH/secrets/DB strategy · migration numbering conflicts with main `0003–0008` |
| **#11** | byPilar WordPress stack on Hetzner |
| **#8** | Selfhost Bird setup on Hetzner |
| **#16** | Temporary closed MU-plugin · needs WP on Hetzner |
| **#6** | Omnichannel Traefik/Erxes gateway · infra deploy |

P0 cutover runbook on main: `docs/ops/p0-db-cutover-runbook.md` + F9 `docker-compose.db.yml` (additive; not executed).

---

## Deferred product / marketing (conflicting; not P0)

Fixable later as dedicated slices — **not** auto-merged (large conflicts, not required for clinical core).

| PR | Notes |
|----|-------|
| **#15** | Webshop creme/udstyr |
| **#14** | B2B funktioner/licens marketing (partial `app/funktioner` already on main) |
| **#13** | byPilar treatment catalog / website |
| **#12** | Fodpleje copy align |
| **#10** | DelPilar Nexus + clinical 4D — core scan path already on main; remainder conflicts |

---

## Operator follow-ups (Broser)

1. Close superseded PRs in GitHub UI (`#34`, `#24`, `#23`, `#22`, `#9`, `#7`, `#5`, `#4`, `#3`, `#2`) — agent token cannot `closePullRequest`.
2. Hetzner cutover when ready: use `#25` + F9/F10 runbook; do **not** flip `clinical_status` or production secrets from agents.
3. Expect live `/api/health` to remain mock/memory until cutover.
