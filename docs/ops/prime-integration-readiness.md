# Prime integration readiness

Date: 2026-09-05
Base: `origin/main` @ `623b0f9`
Scope: verification and sequencing only. Nothing merged, nothing deployed.

## Warning — do not start new multi-session execution

Three pull requests were opened while this verification ran: **#56, #57 and
#59**. They were not part of the brief and were not verified here.

**#57 `cursor/execution-provider-contract-2c11` is the external
execution-provider adapter.** That is the one boundary that could let an agent
act outside this repository. It was deliberately excluded from the earlier
"next three safe missions" list precisely because it should be specified and
approved by a human before any agent implements it. It now exists as code that
nobody asked a human about.

No further multi-session execution should be started until chains A and B are
assembled and reviewed, and until #57 has had a human decision.

## Chain A — BudgetGuard

| PR | Branch | Base | Verified |
|---|---|---|---|
| #54 | `cursor/budget-guard-hardening-2c11` | main | 3 of 4 defects fixed |
| #55 | `agent/vscode-fix-budget-guard-slot-leak-2c11` | #54 | closes leak, **over-releases** |
| #63 | `agent/vscode-fix-slot-double-release-2c11` | #55 | **required** |

#55 is a direct descendant of #54 with one commit. It closes the agent-slot leak
but decremented `usage.agents` unconditionally on every finalisation, so
finalising the same run twice frees a **concurrent run's** slot.

Measured on #55 with two running reservations:

| Sequence | agents before | after | expected |
|---|---|---|---|
| release(A), release(A) | 2 | 0 | 1 |
| record(A), release(A) | 2 | 0 | 1 |
| record(A), record(A) | 2 | 0 | 1 |

That is the mirror image of the bug #55 set out to fix: the mission believes it
has capacity it does not have. #63 makes the release idempotent — only a run
still in `running` may return a slot.

Required properties, verified on #54 + #55 + #63:

- increments on reservation — yes
- decrements on success, abandonment and budget stop — yes
- same run cannot decrement twice — yes (was broken before #63)
- count never negative — yes
- `maxAgents` reusable after a finished run — yes

Combined quality gate: typecheck PASS · 545/545 tests PASS · build PASS

**Ready to merge #55 into #54: only after #63 lands on #55.**

## Chain B — Provider truthfulness

| PR | Branch | Base | Verified |
|---|---|---|---|
| #60 | `cursor/agent-runtime-failure-truthfulness-2c11` | main | default path correct |
| #61 | `agent/vscode-fix-simulated-not-completed-2c11` | #60 | complete |

#61 is a direct descendant of #60. All six required properties verified against
the combined code:

| Property | Result |
|---|---|
| simulated fallback never completed/success/finished | `blocked` |
| missing provider → blocked or failed | `blocked` |
| provider network failure | `failed`, code `provider_error` |
| provider HTTP 503 | `blocked`, code `provider_unavailable` |
| genuine provider success still completes | `completed`, `simulated: false` |
| downstream filter on `completed` excludes simulated | 0 of 2 counted |

Combined quality gate: typecheck PASS · 533/533 tests PASS · build PASS

**Ready to merge #61 into #60: yes.**

## #58 — Verifier and reviewer isolation

| PR | Branch | Base | Verified |
|---|---|---|---|
| #58 | `cursor/reviewer-role-isolation-2c11` | main | incomplete |
| #64 | `agent/vscode-fix-builder-reviewer-separation-2c11` | #58 | **required** |

Scope is clean: two files, no clinical personas, no safety invariants, no false
claim of separate provider sessions in the code.

But the separation had a hole. `UPSTREAM_ROLE` chained `verifier → builder` and
`reviewer → verifier`, leaving `reviewer → builder` unguarded:

| Check | On #58 |
|---|---|
| builder cannot be own verifier | rejected correctly |
| verifier cannot be own reviewer | rejected correctly |
| **builder cannot be own reviewer** | **allowed** |

A builder could review its own output by skipping the verifier link. #64 gives
reviewer both verifier and builder as upstream.

Quality gate on #58 + #64: typecheck PASS · 538/538 tests PASS · build PASS

**Structural role separation:** yes, after #64.
**Real independent provider sessions:** no — and #58 correctly does not claim
otherwise. Each role gets a distinct identity and run context, not a separate
model session. That remains the open work.

**Ready for human merge: only after #64 lands on #58.**

## Remaining chains

| PR | Branch | Dependency | Note |
|---|---|---|---|
| #48 | `agent/planway-removal-and-governance-2c11` | none | governance; merge first |
| #51 | `agent/vscode-ci-workflow-validation-2c11` | **stacked on #48** | its test asserts guard steps #48 adds |
| #49 | `cursor/mission-domain-foundation-2c11` | none | must not land before #52 |
| #52 | `agent/vscode-fix-mission-domain-referential-integrity-2c11` | **stacked on #49** | Infinity, cross-mission, copy-on-read |
| #53 | `agent/vscode-agent-governance-reconciliation-2c11` | none | base `623b0f9` still current |
| #50 | `agent/vscode-prime-execution-audit-2c11` | none | documentation |
| #59 | `cursor/prime-multisession-kernel-2c11` | **stacked on #49** | not verified here |
| #56 | `cursor/provider-capability-inventory-2c11` | none | not verified here |
| #57 | `cursor/execution-provider-contract-2c11` | none | **needs human decision first** |

#53's base is unchanged from when it was written, so its description of main is
still accurate.

## Safe merge order

Defensible from actual branch dependencies:

1. **#48** — governance and guards. Activates the Planway and safety guards
   before anything else lands.
2. **#51** — CI workflow validation. Stacked on #48.
3. **#50**, **#53** — documentation, no dependencies.
4. **#63 → #55 → #54 → main** — BudgetGuard chain.
5. **#61 → #60 → main** — provider truthfulness chain.
6. **#64 → #58 → main** — role separation.
7. **#52 → #49 → main** — mission domain foundation.
8. Enable branch protection on GitHub.
9. Human decision on **#57**, then triage #56 and #59.

Steps 4 and 5 both touch `lib/prime/budget-guard.ts` and agent runtime
respectively; they do not overlap. Step 6 touches `lib/prime/dispatcher.ts`,
which step 7 does not.

## Close as stale or superseded

- **#42** `cursor/planway-kill-praxisos-only-2c11` — fully contained in #43
- **#45, #46, #47** — three overlapping status audits; keep one
- **#6–#16** — nine stale `cursor/*` PRs, oldest from 2026-07-31

The Planway cluster (#39, #40, #41, #43, #44) still needs human infrastructure
review and must not be merged by an agent. Production currently runs the theme
from #43, which is unmerged — main and production have diverged.

## Prime execution status

**Prime cannot control Cursor today: no external execution-provider adapter.**

The control plane is largely built — mission and workstream queues, lease-based
concurrency capped at 4, token and tool-call budgets with a hard stop, path
scoping, risk gates, evidence and a definition of done. The terminal action of
the execution chain is an OpenAI-compatible chat completion plus a real
`git worktree`. Nothing spawns, calls or receives a callback from an external
coding agent.

#57 proposes to change that. It should not be evaluated by an agent.

## Non-actions

- No merge, no deploy
- No SSH to Hetzner; no Vercel, Traefik, Docker or WordPress production change
- No `.env*`, secrets or tokens touched
- No database change or migration
- No patient, journal or SMS change
- No clinical policy or safety invariant change
- No force-push, rebase or history rewrite
- No Cursor branch written to directly
- No new feature mission started
