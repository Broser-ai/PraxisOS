# Prime execution readiness audit

Date: 2026-09-04
Scope: read-only analysis of `origin/main` @ `623b0f9`. No runtime code changed.
Question: can Prime autonomously drive Cursor, or start and supervise multiple
controlled coding-agent sessions, today?

## 1. Actual execution path

```
scripts/agent-worker.mjs  tick()                  poll loop, AGENT_TICK_MS (60s)
  └─ POST /api/agents/tick                        app/api/agents/tick/route.ts
       └─ tickAutomation()                        lib/agents/workflows.ts:336
            ├─ runWorkflow() × N                  13 domain workflows
            └─ tickMissions({ maxParallel: 4 })   lib/prime/dispatcher.ts:541
                 ├─ listClaimableWorkstreams()    dispatcher.ts:75
                 ├─ tryLeaseWorkstream()          dispatcher.ts:130  (5 min TTL)
                 └─ runPool(…, executeLeasedWorkstream)
                      └─ executeLeasedWorkstream()  dispatcher.ts:338
                           ├─ runAgent()            lib/agents/runtime.ts
                           │    └─ chatCompletions() lib/agents/llm.ts
                           │         └─ fetch(OPENAI_BASE_URL/chat/completions)
                           └─ attachBuilderWorktree()
                                └─ createWorktreeForTask()
                                     lib/swarm/worktree-manager.ts
                                     → execFile("git", ["worktree", "add", …])
```

A second, independent path exists for the swarm daemon:

```
Vercel Cron (15 min) → app/api/cron/swarm-tick/route.ts
  └─ tickDaemon()        lib/swarm/daemon.ts
       └─ savageRun()    lib/swarm/meta-harness.ts
            └─ routeToAgent() → lib/swarm/s-agents.ts
```

**Where the chain stops.** The terminal action is an HTTP call to an
OpenAI-compatible chat completions endpoint, plus real `git worktree` creation.
No external coding agent is spawned. `executeLeasedWorkstream()` sets the
workstream to `awaiting_verification` (builder) or `ready_for_review`
(verifier/reviewer) — never `approved_for_merge`.

Without `OPENAI_API_KEY`, `chatCompletions()` returns
`{ ok: false, error: "OPENAI_API_KEY mangler" }` and the run falls back to a
heuristic stub that returns FINISH. The pipeline still reports progress in that
state, which is worth knowing when reading tick output.

## 2. What Prime actually is

Prime is a **mission dispatcher with budget enforcement and an RLVR quiz
harness**. It is not a coding agent and not a separate process.

| Component | File | Role |
|---|---|---|
| Mission/workstream store | `lib/prime/mission-store.ts` | CRUD, in-memory + optional disk mirror |
| Dispatcher | `lib/prime/dispatcher.ts` | lease pool, role→persona mapping, execution |
| Roles | `lib/prime/roles.ts` | `MISSION_ROLE_CAPABILITIES`, explicit `mayNot` arrays |
| Budget guard | `lib/prime/budget-guard.ts` | `reserveBudget()`, `recordBudget()`, hard stop |
| RLVR agent | `lib/prime/agent.ts` | `runPrimeCycle()` — quiz scoring, policy proposals |
| Definition of Done | `lib/prime/definition-of-done.ts` | requires tests/typecheck/build evidence |
| Evidence | `lib/prime/evidence.ts` | commands, checks, acceptance criteria |
| Gates | `lib/prime/gates.ts` | intent filtering, pathology shadow status |

Role→persona mapping is hard-coded in `personaForRole()`
(`lib/prime/dispatcher.ts:268`): scout/verifier/reviewer → `frej`,
builder → `atlas`, otherwise → `aria`.

## 3. Personas

**Nanochat does not exist in this repository.** A case-insensitive search across
all tracked files returns zero hits. If Nanochat is referenced in planning
material, it is not implemented here.

The personas that do exist are **prompt/role definitions with tool grants**, not
runtime processes:

- H-agents — `lib/agents.ts`, `AGENTS` array: aria, niels, sigrid, magnus, frej,
  vega, bjorn, liv, atlas. Each is a name, domain, model hint, system prompt and
  a documented weakness.
- S-agents — `lib/swarm/s-agents.ts`: `lunaResearch()` (arXiv fetch),
  `atlasCode()` (writes `docs/swarm-plans/*.md` in a worktree and commits),
  `felixImplement()` (writes a file, commits), `runPrimeForSwarmTask()`.
- `agents/ARIA-orchestrator.ts` and `agents/registry.ts` — registry and
  orchestration definitions.

`atlasCode()` and `felixImplement()` do perform real `git add`/`git commit`
inside an isolated worktree. They do not push, merge or deploy.

## 4. Verified maximum parallel agent runs

**4.**

- `SWARM_INVARIANTS.MAX_WORKTREES = 4` — `lib/swarm/types.ts:91`, enforced in
  `createWorktreeForTask()` (`lib/swarm/worktree-manager.ts`), which returns
  `{ error: "max_worktrees_4" }` above the cap.
- `DEFAULT_MISSION_BUDGETS.maxParallelWorkstreams = 4` —
  `lib/prime/mission-types.ts`, enforced via `missionParallelCap()` and
  `runningOrLeasedCount()` in `lib/prime/dispatcher.ts`.
- `tickAutomation()` calls `tickMissions({ maxParallel: 4 })`.

These are four concurrent **in-process LLM calls**, not four independent agent
sessions.

## 5. Capability inventory

| Capability | Status | Evidence |
|---|---|---|
| Mission queue | Exists | `lib/prime/mission-store.ts` — `createMission()`, `listMissions()` |
| Workstream queue | Exists | same file — `createWorkstream()`, status pipeline queued → running → awaiting_verification → ready_for_review → approved_for_merge |
| Branch/worktree lease | Exists | `tryLeaseWorkstream()` `lib/prime/dispatcher.ts:130`, `LEASE_MS = 5 * 60_000` |
| Token accounting | Exists | `lib/prime/budget-guard.ts` — `reserveBudget()` / `recordBudget()`, `maxTotalTokens: 250_000` |
| Tool-call limits | Exists | `maxToolCallsPerRun: 24`, `lib/prime/mission-types.ts`; checked in `checkExhausted()` |
| Runtime/step limits | Exists | `maxRuntimeMinutes: 90`; `SWARM_INVARIANTS.MAX_TASK_STEPS = 12` |
| Cursor CLI/API/background-agent adapter | **Missing** | No spawn, no HTTP client. The only `cursor-agent` string is a test fixture value in `tests/adjudication.test.ts:31` |
| Callback/webhook from Cursor | **Missing** | No inbound route for external agents under `app/api/**` |
| Independent verifier/reviewer | Partial | Verifier and reviewer roles exist in `lib/prime/roles.ts`, but they are prompts routed to the same in-process `runAgent()` with the same persona (`frej`). No separate process, no separate credentials, no chain of custody |
| Human gate before merge/deploy | Exists | `approveMergeWorktree()` requires `approveToken` matching `SWARM_APPROVE_TOKEN`; `SWARM_ALLOW_MAIN_MERGE=0` default; `NO_AUTO_MERGE`/`NO_AUTO_DEPLOY` locked `true` in `lib/swarm/types.ts` |

LLM providers actually wired: OpenAI-compatible via `lib/agents/llm.ts`
(`OPENAI_API_KEY`, `OPENAI_BASE_URL`), and optionally Anthropic via
`lib/llm-adapter.ts` (`ChatAnthropic`, falls back to `createStubLLMCaller()`
returning `"[stub-svar]"` when `ANTHROPIC_API_KEY` is absent).

Process spawning is confined to git operations in `lib/swarm/s-agents.ts`,
`lib/swarm/worktree-manager.ts`, `lib/worktree/manager.ts` and one mission
script. No general shell tool is exposed to agents — `lib/mcp-handlers.ts`
grants domain tools only (bookings, clients, journal, messaging).

## 6. The three smallest safe next missions

The missions originally proposed for this audit — mission/workstream state plus
mock repository, BudgetGuard, and dispatcher/lease — **already exist**. Building
them again would duplicate working code. `lib/prime/mission-store.ts`,
`lib/prime/mock-repo.ts`, `lib/prime/budget-guard.ts` and
`lib/prime/dispatcher.ts` are all present and referenced from the live tick path.

The genuinely missing pieces, ordered smallest first:

**Mission A — external agent adapter interface, no implementation.**
Define a `CodingAgentAdapter` type (start, poll, cancel, fetch result) plus an
in-repo `LocalStubAdapter` that returns deterministic fixtures. Tests only. No
network, no process spawn, no credentials. This is the seam that is missing
today; nothing can be integrated until it exists.

**Mission B — verifier independence.**
Make the verifier role route to a different persona and a separate budget bucket
from the builder, so a run cannot approve its own work. Touches
`personaForRole()` and the budget context only. Add a test asserting builder and
verifier for one workstream never share a persona.

**Mission C — adapter callback route, stub-backed.**
Add `POST /api/agents/external/callback` that validates a shared secret and
records an adapter result into the existing evidence store. Wired to the stub
adapter from Mission A. No Cursor, no deploy, no merge.

Each is one branch, reversible, and none touches clinical policy, secrets or
production.

## 7. Conclusion

**Can Prime autonomously control Cursor today: NO.**

Evidence:

1. There is no adapter. No code spawns, calls or receives callbacks from Cursor,
   Claude Code, Codex or Copilot. The single `cursor-agent` occurrence is a
   string in a test fixture.
2. The terminal action of the execution chain is an OpenAI-compatible chat
   completion plus git worktree creation — not delegation to a coding agent.
3. Execution deliberately stops at `ready_for_review`.
   `approveMergeWorktree()` requires a token, `SWARM_ALLOW_MAIN_MERGE` defaults
   to `0`, and `NO_AUTO_MERGE`/`NO_AUTO_DEPLOY` are locked `true`.

What Prime does do well today is the *control plane*: mission and workstream
state, lease-based concurrency capped at 4, token and tool-call budgets with a
hard stop, evidence tracking, and a definition of done that demands test,
typecheck and build results. That is the harder half. The missing half is a
single, well-defined adapter boundary.

One caveat worth stating plainly: with no `OPENAI_API_KEY` configured, runs fall
back to a heuristic stub that returns FINISH. Tick output can therefore look
like progress when no model was consulted.
