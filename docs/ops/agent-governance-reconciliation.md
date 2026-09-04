# Agent governance and Prime execution reconciliation

Date: 2026-09-04
Base: `origin/main` @ `623b0f9`
Method: read-only analysis plus test execution. No merge, no deploy, no production access.

## Executive status

**On main today:** the codebase is Planway-free and Prime's control plane is
substantially built. Governance is **not** active — every governance artifact
exists only in open pull requests.

**Only in open PRs:** `AGENTS.md`, Copilot review instructions, the Planway
absence guard, the agent safety invariant test, CI build and guard steps, the
mission domain repository, and the referential-integrity fix.

**Must not merge as-is:** the Planway cluster (#39–#44). Five overlapping pull
requests changing 38–59 files each across Docker, deploy scripts, WordPress and
CSP. One is already superseded. All require human infrastructure review.

**Prime / Cursor / VS Code control:** Prime does not drive Cursor. There is no
execution-provider adapter of any kind. Nanochat does not exist in this
repository.

## Branch and PR inventory

| PR | Branch | Commits | Files | Scope | Status | Recommendation |
|---|---|---|---|---|---|---|
| #48 | `agent/planway-removal-and-governance-2c11` | 3 | 6 | CI, guards | open, CI green | **Merge first** |
| #51 | `agent/vscode-ci-workflow-validation-2c11` | 4 | 9 | CI | open, stacked on #48 | Merge after #48 |
| #50 | `agent/vscode-prime-execution-audit-2c11` | 1 | 1 | docs | open | Merge any time |
| #49 | `cursor/mission-domain-foundation-2c11` | 1 | 6 | Prime | open, defects found | Merge **after** #52 |
| #52 | `agent/vscode-fix-mission-domain-referential-integrity-2c11` | 2 | 7 | Prime | open, targets #49 | Merge into #49 first |
| #47 #46 #45 | `cursor/status-audit-*` | 1–4 | 3 | docs | open, overlapping | Consolidate to one |
| #44 | `cursor/planway-content-rewrite-2c11` | 8 | 44 | infra, deploy, WP, CSP | open, diverges from #43 | Human review |
| #43 | `cursor/planway-total-kill-live-2c11` | 10 | 45 | infra, deploy, WP, CSP | open, **deployed to live** | Human review — see below |
| #42 | `cursor/planway-kill-praxisos-only-2c11` | 8 | 43 | infra, deploy, WP, CSP | **superseded — fully contained in #43** | Close |
| #41 | `cursor/bypilar-planway-cutover-2c11` | 2 | 59 | infra, deploy, WP | open, diverges | Human review |
| #40 | `cursor/planway-purge-booking-ux-2c11` | 2 | 38 | infra, deploy, WP, CSP | open, diverges | Human review |
| #39 | `cursor/prod-praxisos-booking-live-d635` | 1 | 13 | infra, Planway, DB | open | Human review |
| #38 | `cursor/prod-activate-main-2c11` | 1 | 4 | docs | open | Human review |
| #37 | `cursor/bypilar-setup-visibility-2c11` | 1 | 12 | CSP | open | Human review |
| #25 | `cursor/supabase-selfhost-migrate-2c11` | 11 | 24 | infra, deploy, DB | open, migration | **Human only** |
| #16 #15 #14 #13 #12 #11 #10 #8 #6 | older `cursor/*` | 1–22 | 1–166 | mixed | open, stale | Triage separately |

`agent/vscode-control-2c11` exists on origin (commit `30af38d`) with no open PR.
It was superseded by #48, which carries the same governance files.

## Planway status

### On main

Zero active references. Verified case-insensitively across all tracked files for
`planway`, `planway.com`, `bypilar.planway.com` and `PLANWAY_`: **0 files each**.
The `wordpress/` directory does not exist on main (0 tracked paths).

### Protection against regression

None is active. `tests/planway-absence.test.ts` exists only in #48. Until that
merges, nothing prevents a future branch from reintroducing Planway URLs or
`PLANWAY_*` environment keys into main.

### The branch that must not be merged blindly

`cursor/planway-total-kill-live-2c11` (#43) adds `docker-compose.bypilar-wp.yml`,
five deploy scripts that SSH to Hetzner (`deploy-bypilar-wp.sh`,
`deploy-planway-cutover-wp.sh`, `hetzner-console-planway-kill.sh`,
`migrate-bypilar-from-hostinger.sh`, `push-bypilar-theme-live.sh`), the complete
`wordpress/themes/pilar-theme/` tree, a mu-plugin, and a CSP change in
`middleware.ts`.

Two things a reviewer must know:

1. **This branch is already running in production.** The byPilar WordPress theme
   and PraxisOS booking embed currently served from `bypilar.dk` come from this
   branch, deployed manually. Main does not contain that code. Production and
   main have diverged.
2. **The CSP change allows `http://localhost:*` and `http://127.0.0.1:*` as
   frame ancestors.** That is a development convenience in a production policy
   and is an open decision.

Status: **should-not-merge pending human infrastructure review.**

#42 is fully contained in #43 and can be closed. #40, #41 and #44 diverge from
#43 — they are competing implementations of the same goal, not increments.

## Governance status

### Active on main

Only `.github/workflows/ci.yml` with six steps: Checkout, Setup Node, Install,
Verify package scripts, Typecheck, Test. **No build step. No guards.**

### Present only in PR #48

| Artifact | On main | In #48 |
|---|---|---|
| `AGENTS.md` | missing | present |
| `.github/copilot-instructions.md` | missing | present |
| `tests/planway-absence.test.ts` | missing | present |
| `tests/agent-safety-invariants.test.ts` | missing | present |
| `docs/ops/vscode-agent-tasks.md` | missing | present |
| CI build step | missing | present |
| CI guard steps | missing | present |

### Still required manually on GitHub

Branch protection on `main` cannot be set from a branch. It needs: pull request
required, at least one approval, `typecheck + vitest` as a required check,
force-push blocked, and no bypass or auto-merge. Until then the safety
invariants are advisory — a test asserts `NO_AUTO_MERGE` is `true`, but nothing
stops a direct push to main.

## Prime execution maturity

Evidence is code only. Personas, prompts and documents do not count.

| Requirement | Status | Evidence |
|---|---|---|
| Mission domain | implemented | `lib/prime/mission-store.ts`, `mission-types.ts` |
| Workstream domain | implemented | same |
| AgentRun domain | implemented | `MissionAgentRun`, `mission-types.ts:182` |
| Mission/Workstream/Run validation | partial | `lib/prime/mission-validation.ts` — **only in #49** |
| Referential integrity | partial | fixed in **#52**; absent on main and in #49 alone |
| Copy-on-read / state isolation | partial | `structuredClone` in **#52** only; `mission-store` still returns live refs |
| Persistent database repository | missing | in-memory plus `PRAXIS_DATA_DIR/mission-store.json` only |
| Mock/memory repository | implemented | `lib/prime/mock-repo.ts`, `MemoryMissionDomainRepository` (#49) |
| BudgetGuard with reservation | implemented | `reserveBudget()`, `recordBudget()`, `lib/prime/budget-guard.ts` |
| Actual LLM usage accounting | implemented | usage recorded post-call via `lib/agents/llm.ts` |
| Estimated usage fallback | implemented | `estimated` flag in `tokenUsage` |
| Tool-call limit | implemented | `maxToolCallsPerRun: 24`, checked in `checkExhausted()` |
| Runtime timeout | implemented | `maxRuntimeMinutes: 90` |
| Budget increase human approval | implemented | `agents_cannot_raise_budgets`, `budget-guard.ts:306` |
| MissionPolicyGuard | implemented | `lib/prime/mission-policy.ts`, `evaluateMissionPolicy()` |
| Allowed-path enforcement | implemented | `allowedPaths` in `dispatcher.ts`, `fixtures.ts` |
| Forbidden-path enforcement | implemented | `forbiddenPaths` defaults include `.env` |
| Red/yellow/green human gates | implemented | `needsRisk(mission.riskLevel, "yellow")` + `humanApproved`, `mission-policy.ts:210` |
| DefinitionOfDoneValidator | implemented | `lib/prime/definition-of-done.ts` |
| Completion evidence ledger | implemented | `lib/prime/evidence.ts`, `ledger.ts` |
| Worktree/branch conflict detection | implemented | builder path overlap blocks lease, `dispatcher.ts:171` |
| Lease/lock against double dispatch | implemented | `tryLeaseWorkstream()`, `LEASE_MS = 5 min`, plus tick mutex |
| Controlled parallelism | implemented | `MAX_WORKTREES: 4`, `maxParallelWorkstreams: 4` |
| Worker/tick integration | implemented | `tickMissions()` called from `tickAutomation()` |
| Scout/builder/verifier/reviewer isolation | **partial** | `personaForRole()` maps scout, verifier **and reviewer** all to `frej` |
| Admin/API mission control | implemented | `app/api/agents/missions/[missionId]/route.ts`, admin swarm page |
| Cursor execution-provider adapter | **missing** | no match for adapter, spawn or HTTP client anywhere |
| VS Code execution-provider adapter | **missing** | same |
| Human merge gate | implemented | `approveMergeWorktree()` requires token; `SWARM_ALLOW_MAIN_MERGE=0` |
| Human deploy gate | implemented | `NO_AUTO_DEPLOY: true`, `lib/swarm/types.ts` |

### Why Prime still does not drive Cursor

The control plane is the hard part and it is largely built: queues, leases,
budgets with a hard stop, path scoping, risk gates, evidence and a definition of
done. What is missing is the boundary itself. Nothing in the repository spawns,
calls or receives a callback from an external coding agent. The terminal action
of the execution chain is an OpenAI-compatible chat completion plus a real
`git worktree` — the work product is a suggestion, not a delegated coding
session.

Two secondary observations matter for trust:

- **Verifier and reviewer are the same persona.** `personaForRole()` returns
  `frej` for scout, verifier and reviewer. A reviewer checking a verifier's
  conclusion is the same prompt with the same context. Independence is nominal.
- **Without `OPENAI_API_KEY` the pipeline still reports progress.**
  `chatCompletions()` returns an error and the run falls back to a heuristic
  stub returning FINISH. Tick output can look like work when no model was
  consulted.

## Findings

### Blockers

1. **Governance is not on main.** Every guard exists only in #48. The window
   between now and that merge is unprotected.
2. **#49 must not merge before #52.** Three defects confirmed empirically:
   any `workstreamId` accepted including cross-mission, `Infinity` passing
   budget validation, and live store references returned to callers. All three
   are fixed in #52 with 13 regression tests.
3. **Production has diverged from main.** The live byPilar theme comes from #43,
   which is unmerged.

### Security risks

- **`Infinity` defeats the budget guard.** `budget-guard.ts:77` compares
  `totalTokens > maxTotalTokens`; against `Infinity` that is never true, so token
  exhaustion cannot trigger. `JSON.stringify(Infinity)` is `null`, so after one
  persist/hydrate cycle the same budget flips to instant exhaustion. Fixed in
  #52 via `Number.isFinite`.
- **Cross-mission agent runs.** Before #52 a run could reference a workstream
  belonging to a different mission, silently crossing a tenant-adjacent
  boundary.
- **Dev origins in production CSP.** #43 allows localhost as a frame ancestor.
- **Branch protection absent.** Nothing enforces the invariants at the repo
  level.

### Technical debt

- `goal` and `objective` are parallel fields on `Mission`, kept in sync by manual
  two-way copying in `updateMission`. Same pattern for `role` and `assignedRole`
  on `Workstream`. Any future write path that forgets the copy makes them
  diverge.
- `AgentRun` is exported from both `lib/agent-store.ts` (clinic runs) and
  `lib/prime/mission-types.ts` (Prime execution runs), and `lib/prime/index.ts`
  re-exports with `export *`. Two different types, one name.
- Legacy `createMission` and `draftMission` in `mission-store` bypass
  `mission-validation` entirely.
- Nine stale `cursor/*` PRs (#6–#16) and three overlapping status-audit PRs.

These are **documented technical debt (category B)**, not merge blockers.
Consolidating the field names is an API decision, and tightening the legacy
constructors would affect the dispatcher and seed data — each deserves its own
scoped mission.

## Safest merge order

Defensible from actual branch dependencies:

1. **#48** — governance and guards. Independent, CI green. Activates the Planway
   and safety guards before anything else lands.
2. **#51** — CI workflow validation. Stacked on #48; its test asserts the guard
   steps #48 introduces.
3. **#50** — Prime readiness audit. Documentation only, no dependency.
4. **#52 into #49** — the referential-integrity fix, then #49 to main.
5. Enable branch protection on GitHub.
6. Planway cluster: close #42 as superseded, then human review of #43 against
   #40, #41 and #44 as competing candidates.

Steps 1–4 are safe for an agent to prepare and a human to merge. Steps 5–6 are
human-only.

## Next three safe coding missions

### Mission 1 — BudgetGuard hardening, tests only

- Base: `main` after #48 and #52 land
- Allowed paths: `lib/prime/budget-guard.ts`, `tests/prime/`
- Forbidden: `app/`, `middleware.ts`, `.env*`, `docker-compose*`, `scripts/`
- Acceptance: reservation and release covered under concurrent leases; exhaustion
  asserted for each budget key; a non-finite value can never reach the store
- Max size: 3 files
- Executor: Cursor
- Human approval before start: no

### Mission 2 — MissionPolicyGuard coverage

- Base: same
- Allowed paths: `lib/prime/mission-policy.ts`, `tests/prime/`
- Forbidden: as above, plus `lib/prime/dispatcher.ts`
- Acceptance: allowed and forbidden path enforcement proven for each role; red
  and yellow risk levels proven to require `humanApproved`; a builder proven
  unable to reach merge or deploy intent
- Max size: 3 files
- Executor: Cursor
- Human approval before start: no

### Mission 3 — DefinitionOfDone and evidence validator

- Base: same
- Allowed paths: `lib/prime/definition-of-done.ts`, `lib/prime/evidence.ts`,
  `tests/prime/`
- Forbidden: as above
- Acceptance: a workstream without test, typecheck and build evidence cannot
  reach `ready_for_review`; evidence entries are append-only; a fabricated
  evidence entry is rejected
- Max size: 4 files
- Executor: VS Code — this one guards against agents marking their own work done,
  so an independent implementer is appropriate
- Human approval before start: no

An execution-provider adapter is deliberately **not** among these three. It is
the missing boundary, but it is also the first thing that could let an agent act
outside this repository. It should be specified and approved by a human before
any agent implements it.

## Explicit non-actions

Confirmed for this reconciliation:

- No merge of any branch or pull request
- No deploy
- No SSH to Hetzner
- No production access; no Vercel, Traefik, Docker or live WordPress change
- No `.env*`, secrets, tokens or API keys touched
- No database change, no migration written or run
- No clinical policy, patient or journal data touched
- No Bird SMS
- No force-push, rebase or history rewrite
- `cursor/planway-total-kill-live-2c11` was read only, to document why it needs
  human review
