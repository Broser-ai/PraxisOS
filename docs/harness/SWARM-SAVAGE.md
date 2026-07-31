# PraxisOS · S-H Swarm · Savage Execution

## Model

| Layer | Agents | Role |
|---|---|---|
| Meta | **ARIA_META** | Routes tasks, enforces invariants |
| S-agents | **ATLAS_CODE**, **LUNA_RESEARCH**, **FELIX_IMPROVE**, **FREJ_GATE** | Software/research/improve/compliance |
| H-agents | Aria, Niels, Sigrid, … (9) | Humanized clinical personas via LangGraph (`lib/orchestrator.ts`) |

## Savage mode

`POST /api/v1/{tenant}/swarm` with `{ action: "savage", type, title, brief }`

1. ARIA_META enqueues + executes immediately  
2. S-agents may open git worktrees under `.worktrees/`  
3. Task ends in `awaiting_human` when merge/review is needed  
4. **FREJ_GATE** + approve token required — **never auto-merge / auto-deploy**

## Human approve

```json
{
  "action": "approve",
  "taskId": "sw_…",
  "approveToken": "I-APPROVE-MERGE"
}
```

- Dev default token: `I-APPROVE-MERGE` (or `SWARM_APPROVE_TOKEN`)
- Merge to `main` additionally requires `SWARM_ALLOW_MAIN_MERGE=1`

## Feature flags

| Env | Default | Meaning |
|---|---|---|
| `PRAXIS_SWARM_ENABLED` | on | Set `false` to disable API |
| `AGENT_ORCHESTRATION_ENABLED` | off | Must be `true` for H-bridge live route |
| `PRAXIS_LLM_MODE` | stub | `live` needs `ANTHROPIC_API_KEY` |
| `SWARM_APPROVE_TOKEN` | (dev fallback) | Required in prod for approve |

## Admin UI

`/admin/swarm` — launch runs, inspect tasks + journals.

## Tests

```bash
npm test
```
