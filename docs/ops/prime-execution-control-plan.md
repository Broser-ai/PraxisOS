# Prime Execution Control — Implementation Plan

**Branch:** `cursor/prime-execution-control-2c11`  
**Scope:** Mission domain · BudgetGuard · MissionPolicyGuard · DoD · Evidence · Roles · minimal API/UI · vitest  
**Hard locks (unchanged):** `SWARM_INVARIANTS.NO_AUTO_MERGE/DEPLOY`, `CLINICAL_POLICY.suggestion_only` + `NO_AUTO_JOURNAL_SIGN`, `PRIME_INVARIANTS.NO_MODEL_TRAINING` + `PATHOLOGY_SHADOW_UNTIL_GATES`

---

## A. Findings (actual code map)

| Area | Where it lives | Gap vs Execution Control |
|------|----------------|--------------------------|
| Agent runs / jobs / approvals | `lib/agent-store.ts` (memory + optional `PRAXIS_DATA_DIR` mirror) | No mission/workstream linkage; **no token usage** fields |
| LLM call path | `lib/agents/llm.ts` → `runtime.ts` tool loop | No reserve/record; provider `usage` ignored |
| Swarm tasks / ticks | `lib/swarm/meta-harness.ts`, `daemon.ts`, `memory.ts`, `persist.ts` | Task-centric, not Mission/Workstream; human gate already present |
| Worktrees | `lib/swarm/worktree-manager.ts`, `lib/worktree/manager.ts` | `MAX_WORKTREES=4`; `ready_for_review` with **no DoD/evidence gate** |
| Approvals | agent-store + swarm `humanApproveTask` + approve tokens | No mission-policy matrix (paths, clinical, migrations, SMS) |
| Swarm memory / journals | `lib/swarm/memory.ts`, `journal.ts`, `agents/ledger.ts` | Reusable for audit signals; not an evidence ledger |
| Prime | `lib/prime/*` (RLVR quiz, gates, policy proposals) | Reuse gates/invariants; **no mission orchestration** |
| Clinical | `lib/swarm/clinical-policy.ts` | Keep `suggestion_only`; never self-approve clinical |
| Admin UI | `/admin/swarm`, `/admin/agents`, `/admin/agents/automation` | Extend swarm/agents — no new mega-app |
| Auth pattern | Swarm API: session cookie + owner/support for mutations | Mirror for mission APIs (best-effort; P0 hardening separate) |
| Persistence | agent-store disk + swarm_snapshots (+ optional SQL) | Prefer extend agent-store / prime memory mirror; optional migration `0005_*` if fits |
| Parallel work | `docs/ops/p0-secure-clinical-core-plan.md` on other branch | **Do not touch** that path |

**Reuse (do not duplicate):** swarm worktree caps, human-approve tokens, Frej gate, Prime clinical gates, `auditLog`, agent-store persist pattern.

---

## B–H. Minimal safe design

### Domain (`lib/prime/mission-*.ts`)

- **Mission** — `draft → approved → running → paused|cancelled|completed`; `riskLevel` (`green|yellow|red`); owner budgets; tenant; timestamps.
- **Workstream** — role (`scout|builder|verifier|reviewer|release_steward`); status; `allowedPaths` / `forbiddenPaths`; `acceptanceCriteria[]`; branch/worktree; `changedFiles`; evidence ref; `blockedReason` on path conflict.
- **AgentRun link** — optional `missionId` / `workstreamId` + `tokenUsage` on runs via thin extension of agent-store **or** parallel mission-run records in the same persist file (no ad-hoc second JSON tree).

### BudgetGuard (hard-stop)

- Central `reserve` / `record` / `assertWithinBudget` used by LLM path.
- Caps: `maxTotalTokens`, `maxTokensPerRun`, `maxToolCallsPerRun`, `maxRuntimeMinutes`, `maxAgents`, `maxChangedFiles`, `maxReworkLoops`.
- Exhaustion → status `budget_exhausted` + status report.
- Missing provider usage → **estimate** (chars/4 + tool overhead); **never assume 0**.
- Agents cannot raise budgets; **owner-only** bump + `auditLog`.

### MissionPolicyGuard + DefinitionOfDoneValidator

- Block / require human approval for: main writes, merge, deploy, prod secrets/env, clinical-policy/MDR/pathology/patient claims, migrations without yellow/red approval, writes outside `allowedPaths` / in `forbiddenPaths`, SMS/patient workflows, auto journal sign.
- DoD: no empty shells; ≥1 acceptance criterion with evidence; tests+typecheck; build when UI/API/runtime touched; no unapproved TODO/FIXME/fake success; new routes need domain logic; UI actions verified or disabled; schema-only ≠ done; clinical never self-approves.

### Evidence ledger

- Per-workstream completion evidence (commits, files, commands, tests/lint/tsc/build, acceptance pass/fail/not_verified, security/tenant/clinical checks, limitations, rollback, human decisions). Marking done without evidence fails closed.

### Roles + orchestration

- Roles: `prime_commander`, `scout`, `builder`, `verifier`, `reviewer`, `release_steward` with capability limits.
- Default **max 4** parallel workstreams (align `SWARM_INVARIANTS.MAX_WORKTREES`).
- Flow: scout → builder → verifier+reviewer. Path conflicts → `blocked` (no overwrite).
- `release_steward` may mark `approved_for_merge` only; **manual merge only** (`NO_AUTO_MERGE`).

### API + admin UI

- Routes under `/api/v1/[tenant]/prime/missions` (draft/approve/start/pause/cancel, budget bump, evidence, mark approved_for_merge).
- Panel section on `/admin/swarm` (missions list, budgets, blocked/human decisions) — not a separate app.
- Mutations: session auth (owner/support), audit, reject unauthorized.

### Tests (vitest ≥12)

Budget hard-stops (tokens total/per-run, tool calls); estimated usage when provider omits; agent cannot raise budget; owner bump audited; policy blocks merge/deploy/clinical; DoD rejects empty shell; path conflict blocked; evidence required; invariants still locked; orchestration role flow / max parallel.

### Intentionally NOT automated

- Merge to `main`, deploy, journal sign, clinical routing, LoRA/training, budget raises by agents, SMS/patient send without human approval.

---

## Commit sequence

1. This plan  
2. Mission types + store  
3. BudgetGuard + LLM hook  
4. Policy + DoD + evidence  
5. Roles + orchestrator  
6. API + admin UI  
7. Vitest suite  
