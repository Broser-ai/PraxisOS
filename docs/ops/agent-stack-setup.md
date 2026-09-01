# Agent stack setup · Prime RL · S-H · Swarm · Worktree · Meta harness

**Status:** wired on `main` (via agent-stack merge) · human-gated · suggestion-only clinical  
**LoRA:** not implemented — blocked by `PRIME_INVARIANTS.NO_MODEL_TRAINING` (see [lora-status.md](../vision/lora-status.md))

## Layers present

| Layer | Path | Enable / run |
|-------|------|----------------|
| **Prime RL** | `lib/prime/*`, `agents/specialists/PRIME-rl.ts` | MCP `prime_rlvr_quiz` / `prime_status`; swarm task `rl_eval` |
| **S-H agents** | `lib/swarm/s-agents.ts`, `types.ts` | ARIA_META · ATLAS · LUNA · FELIX · FREJ · PRIME_RL · H_BRIDGE |
| **Swarm API** | `app/api/v1/[tenant]/swarm/*` | `PRAXIS_SWARM_ENABLED` (default on) |
| **Meta harness** | `lib/swarm/meta-harness.ts` | Approve with `SWARM_APPROVE_TOKEN` |
| **Autonom daemon** | `lib/swarm/daemon.ts` | `npx tsx scripts/awaken.ts` or cron `/api/cron/swarm-tick` |
| **Worktree** | `lib/swarm/worktree-manager.ts`, `lib/worktree/manager.ts` | savage `worktree_exec` → human PR |
| **Human gate** | `scripts/harness-human-gate.mjs` | `npm run harness:human-gate` |
| **Harness docs** | `docs/harness/*`, `docs/vision/harness-human-gate.md` | EPIC contracts + DoD appendices |
| **Agent worker** | `scripts/agent-worker.mjs` + compose | Docker `agent-worker` → `/api/agents/tick` |

## Env (copy into `.env.local` / `.env.production`)

| Var | Default | Meaning |
|-----|---------|---------|
| `PRAXIS_SWARM_ENABLED` | on (`!== "false"`) | Set `false` to disable swarm |
| `SWARM_APPROVE_TOKEN` | required in prod | Human approve for merge intent |
| `PRIME_APPROVE_TOKEN` | falls back to `SWARM_APPROVE_TOKEN` | Prime policy adjudication |
| `SWARM_ALLOW_MAIN_MERGE` | unset | Must be `1` **and** token to allow main target intent |
| `SWARM_INTERVAL_MS` | daemon default | Local awaken interval |
| `SWARM_PERSIST` | on (off on Vercel unless `1`) | File/Supabase swarm persistence |
| `AGENT_WORKER_SECRET` | — | Worker → `/api/agents/tick` |
| `PRAXIS_DEFAULT_TENANT` | `bypilar` | Awaken / worker tenant |

Hard locks (code, not env): `NO_AUTO_MERGE`, `NO_AUTO_DEPLOY`, clinical `suggestion_only`, `NO_MODEL_TRAINING`.

## Local bootstrap

```bash
cp .env.example .env.local   # fill secrets
npm install
npm run typecheck
npx vitest run tests/prime tests/swarm

# App
npm run dev -- -H 127.0.0.1 -p 3002

# Autonom daemon (separate terminal; no auto-merge)
npx tsx scripts/awaken.ts

# Or agent-worker against a running app
AGENT_WORKER_SECRET=… PRAXIS_BASE_URL=http://127.0.0.1:3002 npm run agent:worker

# Human gate only (prints ranked spike; stops)
npm run harness:human-gate
```

## Self-host (Hetzner)

```bash
# From START-SELVHOST.md — compose brings praxisos + agent-worker
docker compose -f docker-compose.praxis.yml --env-file .env.production up -d --build
```

Admin surfaces: `/admin/swarm`, `/admin/agents/automation`, `/admin/health`.

Migrations (if using Supabase): `0003_swarm_snapshots_and_memory.sql`, `0004_agent_ledger.sql`.

## Docs map

- Prime: [docs/vision/prime-agent-rl.md](../vision/prime-agent-rl.md)
- Swarm/worktree runtime: [docs/swarm-worktree-runtime.md](../swarm-worktree-runtime.md)
- Harness gate: [docs/vision/harness-human-gate.md](../vision/harness-human-gate.md)
- LoRA: [docs/vision/lora-status.md](../vision/lora-status.md)
- Coding-ready: [docs/ops/coding-ready.md](./coding-ready.md)
