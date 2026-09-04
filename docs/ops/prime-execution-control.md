# Prime Execution Control

**Branch:** `cursor/prime-execution-control-2c11`  
**Concurrency audit:** [`prime-execution-concurrency-audit.md`](./prime-execution-concurrency-audit.md)  
**Runbook:** [`prime-execution-control-runbook.md`](./prime-execution-control-runbook.md)

## Purpose

Controlled multi-agent **programming missions** with hard budget stops, policy/DoD gates, evidence, and a **dispatcher** that leases workstreams on the agent-worker tick — without auto-merge/deploy/journal-sign.

## API choice

**Canonical** missions API: **`/api/v1/[tenant]/prime/missions`**.  
**Alias** (same handlers, no duplicated domain logic): **`/api/agents/missions`** and **`/api/agents/missions/[missionId]`** — pass `?tenant=` (GET) or `"tenant"` in JSON body (POST); default `bypilar`.  
The agent-worker still hits `/api/agents/tick`; `tickAutomation` also calls `tickMissions()`.

| Action | Body |
|--------|------|
| `draft` | `{ title, goal, riskLevel? }` |
| `seed_fixture` | `{ fixtureId: "secure-journal-route-authorization" }` → **draft only** |
| `approve` / `start` / `pause` / `cancel` | `{ missionId }` |
| `spawn` / `spawn_flow` | workstream creation |
| `tick` | manual dispatcher tick (same as worker slice) |
| `raise_budget` | owner-only |
| `mark_approved_for_merge` | owner-only; **does not merge** |

GET views: `list`, `mission`, `workstreams`, `budget`, `evidence`, `dispatcher`, `invariants`.

## Lifecycle (after dispatcher)

```mermaid
sequenceDiagram
  participant Owner
  participant API as /prime/missions
  participant W as agent-worker
  participant T as tickAutomation
  participant D as tickMissions
  participant L as tryLeaseWorkstream
  participant RA as runAgent + BudgetGuard
  participant WT as worktree-manager

  Owner->>API: seed_fixture (draft)
  Owner->>API: approve + start
  Note over API: spawnFixtureFlow → queued scout/builder/verifier/reviewer
  W->>T: POST /api/agents/tick
  T->>D: tickMissions (maxParallel=4)
  D->>D: dispatcher tickInFlight mutex
  loop up to 4 claimable workstreams
    D->>L: lease (blocks 2nd tick claim)
    alt builder
      D->>WT: createWorktreeForTask
    end
    D->>RA: separate AgentRun per role
  end
  Note over D: per-workstream failures → rework budget; worker continues
  Owner->>API: mark_approved_for_merge (manual PR merge only)
```

## Components

| Piece | Path |
|-------|------|
| Types / budgets / statuses | `lib/prime/mission-types.ts` |
| Store | `lib/prime/mission-store.ts` |
| BudgetGuard | `lib/prime/budget-guard.ts` → `lib/agents/llm.ts` + heuristic soft-record in dispatcher |
| Policy / DoD / evidence | `mission-policy.ts`, `definition-of-done.ts`, `evidence.ts` |
| Roles | `lib/prime/roles.ts` |
| Orchestrator | `lib/prime/orchestrator.ts` |
| **Dispatcher** | `lib/prime/dispatcher.ts` |
| Seed / fixtures | `lib/prime/seed.ts`, `fixtures/missions/*` |
| Migrations | `0005_mission_snapshots.sql`, `0006_prime_missions_relational.sql` |
| Mock repo | `lib/prime/mock-repo.ts` |

## Hard invariants (unchanged)

- `NO_AUTO_MERGE` / `NO_AUTO_DEPLOY`
- Clinical `suggestion_only` + `NO_AUTO_JOURNAL_SIGN`
- `NO_MODEL_TRAINING` + `PATHOLOGY_SHADOW_UNTIL_GATES`
- No SMS/patient autonomy from mission roles
- Agents cannot raise budgets

## What is still sequential vs parallel

- **Clinic workflows** inside a tick remain sequential `await` loops.
- **Mission workstreams** use a **controlled pool** (default max 4), not unbounded `Promise.all`.
- Two dispatcher ticks in one process: blocked by `tickInFlight`.
- Two overlapping leases on the same workstream: blocked by lease owner/expiry.
