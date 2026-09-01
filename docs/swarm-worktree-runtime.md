# Swarm + Worktree agent programming runtime

**Status:** coded · human-gated · suggestion-only clinical  
**Safety:** `SWARM_INVARIANTS.NO_AUTO_MERGE` / `NO_AUTO_DEPLOY` · clinical `suggestion_only`

## What exists

| Layer | Path |
|-------|------|
| Types + invariants | `lib/swarm/types.ts` |
| Meta-harness / approve | `lib/swarm/meta-harness.ts` |
| Daemon (24/7 agenda) | `lib/swarm/daemon.ts` |
| Worktree jobs (swarm) | `lib/swarm/worktree-manager.ts` |
| Git sessions (Felix) | `lib/worktree/manager.ts` |
| Clinical policy | `lib/swarm/clinical-policy.ts` |
| Shadow gate snapshot | `lib/swarm/shadow-gates.ts` |
| Agent ledger | `lib/agents/ledger.ts` |
| API | `GET/POST /api/v1/[tenant]/swarm` |
| MCP tools | `swarm_status`, `list_swarm_worktrees`, `cleanup_swarm_worktrees` |
| Admin UI | `/admin/swarm` |
| Human-gate script | `node scripts/harness-human-gate.mjs` |

## How to run

```bash
# Unit tests (swarm + worktree)
npx vitest run tests/swarm

# Local awaken / daemon (non-Vercel)
npx tsx scripts/awaken.ts

# One human-gate pass (no merge)
node scripts/harness-human-gate.mjs

# API (owner session cookie required)
# GET  /api/v1/bypilar/swarm?view=worktrees
# GET  /api/v1/bypilar/swarm?view=worktree_status&id=<taskId>
# GET  /api/v1/bypilar/swarm?view=ledger
# POST /api/v1/bypilar/swarm  { "action": "savage", "type": "worktree_exec", "title": "…" }
# POST /api/v1/bypilar/swarm  { "action": "worktree_cleanup" }
# POST /api/v1/bypilar/swarm  { "action": "approve", "taskId": "…", "approveToken": "…" }
```

Env (optional):

| Var | Meaning |
|-----|---------|
| `PRAXIS_SWARM_ENABLED` | default on; set `false` to disable |
| `SWARM_APPROVE_TOKEN` | required for human approve (prod) |
| `SWARM_ALLOW_MAIN_MERGE` | must be `1` even after token to allow main target intent |
| `SWARM_INTERVAL_MS` | daemon interval (local) |

## Migrations

- `supabase/migrations/0003_swarm_snapshots_and_memory.sql`
- `supabase/migrations/0004_agent_ledger.sql`

Apply on the Supabase host used by PraxisOS (service role writes only).

## Hard rules

1. Never auto-merge to `main`
2. Never auto-deploy
3. Clinical H-bridge output is **suggestion_only**
4. Shadow vision gates are read-only from swarm (FREJ snapshot) — do not flip routing from daemon
