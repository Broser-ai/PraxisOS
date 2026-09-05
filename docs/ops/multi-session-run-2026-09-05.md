# Multi-session run · 2026-09-05

Three isolated coding sessions in separate git worktrees and branches.
No merge, no deploy, no production access.

## What actually happened

Cursor was working the same missions in parallel. Two of the three branches were
already pushed by Cursor by the time this run reached them, so those sessions
turned into independent reviews plus a scoped fix rather than fresh
implementations. Nothing was overwritten and no branch was force-pushed.

| Session | Mission | Who implemented | Outcome |
|---|---|---|---|
| A | BudgetGuard hardening | Cursor | Reviewed; one defect fixed |
| B | Verifier / reviewer isolation | VS Code | Implemented |
| C | Provider failure truthfulness | Cursor | Reviewed; one defect fixed |

## Session A — BudgetGuard hardening

- Worktree: `../PraxisOS-budget-guard`
- Cursor branch: `cursor/budget-guard-hardening-2c11` @ `ab1e984` — PR #54
- VS Code fix: `agent/vscode-fix-budget-guard-slot-leak-2c11` @ `0473222` — PR #55 → #54
- Independent implementation kept at `agent/vscode-fix-budget-guard-hardening-2c11` @ `828ba7b`

Four defects were confirmed empirically against the pre-fix code:

1. `raiseMissionBudget` never called budget validation — an owner could set
   `maxTotalTokens` to `Infinity`, making the exhaustion check unreachable.
2. `maxTokensPerRun` was only compared against the pre-call estimate, so a run
   could reserve 100 tokens and spend 50 000.
3. `runtimeMinutes` only advanced from a caller-supplied delta, so
   `maxRuntimeMinutes` was unenforceable by omitting it.
4. `reserveBudget` increments `usage.agents` with nothing decrementing it.

Cursor's branch fixes 1, 2 and 3 — verified by running an independent test set
against it. Defect 4 remained: `agents` goes 0 → 1 on reserve and stays there, so
a mission eventually fails closed on `maxAgents` while idle. PR #55 returns the
slot on completion and adds `releaseBudgetReservation()` for runs that never
finished.

Gate on the fix: typecheck PASS · 539/539 tests PASS · build PASS

Scope note: Cursor's branch is based on `main`, not on
`agent/vscode-fix-mission-domain-referential-integrity-2c11` (#52) as the mission
specified, so it does not contain `lib/prime/mission-validation.ts`. Cursor
solved the finite-budget problem independently with `isFiniteNonNegative` /
`sanitizeMissionBudgets`. The outcome is sound, but when #49, #52 and #54 all
land there will be two validation paths for the same concern.

`lib/prime/mission-store.ts` was on the mission's forbidden list and was modified
to add `getMissionRun`. Additive and harmless — #49 adds the same function — so
it was not reverted, only flagged.

## Session B — Verifier and reviewer isolation

- Worktree: `../PraxisOS-reviewer-isolation`
- Branch: `cursor/reviewer-role-isolation-2c11` @ `b15031d` — PR #58 → main
- Files: `lib/prime/dispatcher.ts`, `tests/prime/role-separation.test.ts`

`personaForRole()` maps scout, verifier **and** reviewer all to `frej`. A
reviewer checking a verifier's conclusion was the same actor with the same
prompt.

Adds `executionIdentityForRole()` — a distinct identity per mission, workstream
and role — and `assertRoleSeparation()`, which enforces that a builder cannot
verify its own work and a verifier cannot review its own verdict.

The personas in `lib/agents.ts` are clinic roles; none besides `frej` and `atlas`
fit code verification, and that file is outside the mission scope. Forcing a
finance or documentation persona into a review seat would be worse than the
problem. So this implements correct role identity and runtime context, and leaves
**a separate provider session per role as the next mission** — that is the change
that makes the independence real rather than structural.

11 tests, including an explicit proof that the test-only override is not the
default. Gate: typecheck PASS · 532/532 tests PASS · build PASS

## Session C — Provider failure truthfulness

- Worktree: `../PraxisOS-runtime-fallback`
- Cursor branch: `cursor/agent-runtime-failure-truthfulness-2c11` @ `662402c` — PR #60
- VS Code fix: `agent/vscode-fix-simulated-not-completed-2c11` @ `067db27` — PR #61 → #60
- Independent implementation kept at `agent/vscode-fix-runtime-truthfulness-2c11` @ `55a8606`

The runtime marked a run `completed` even when `OPENAI_API_KEY` was absent or the
provider call failed, because it fell back to a local heuristic. A tick could
look like finished work with no model involved.

Cursor's branch handles the default path correctly — `blocked` for missing
configuration, `failed` for a provider reached and failing — verified by running
an independent test against it.

One gap remained: `finishSimulated()` set `status: "completed"` and relied on
separate `simulated` / `nonExecuting` / `notRealLlmResult` fields to carry the
truth. Any consumer filtering on `status === "completed"` counts it as finished
work. The path is opt-in via `allowSimulatedFallback === true` and is not the
default, but the requirement allowed no exception. PR #61 changes it to `blocked`
and leaves the markers untouched.

Gate on the fix: typecheck PASS · 533/533 tests PASS · build PASS

## Test counts

| Branch | Tests | Explanation |
|---|---|---|
| `origin/main` | 521 | baseline |
| Session A fix | 539 | Cursor's additions plus 6 slot-leak tests |
| Session B | 532 | 521 + 11 role separation |
| Session C fix | 533 | Cursor's additions plus 4 simulated-status tests |

## Operational notes

Sharing one `node_modules` across worktrees via symlink works for vitest and
typecheck but breaks `next build` — Turbopack rejects a symlink pointing outside
the project root. Each worktree needs its own `npm ci`.

A symlinked `node_modules` is also not matched by the `node_modules` pattern in
`.gitignore`, so `git add -A` will stage it. Caught before push.

An editor formatter reindented several new test files from 2 to 4 spaces after
commit. The repository convention is 2. The committed versions are correct and
the reformatting was discarded.

## Explicit non-actions

- No merge of any branch or pull request
- No deploy
- No SSH to Hetzner; no Vercel, Traefik, Docker or WordPress production change
- No `.env*`, secrets, tokens or API keys touched
- No database change, migration written or run
- No patient, journal or Bird SMS change
- No clinical policy change; `suggestion_only`, `NO_AUTO_MERGE`,
  `NO_AUTO_DEPLOY`, `NO_AUTO_JOURNAL_SIGN`, `NO_MODEL_TRAINING` and
  `PATHOLOGY_SHADOW_UNTIL_GATES` untouched
- No force-push, rebase or history rewrite
- No Cursor branch written to directly

## Suggested review order

1. PR #55 into #54, then #54 to main — budget guard
2. PR #61 into #60, then #60 to main — provider truthfulness
3. PR #58 to main — role separation, independent of the other two
