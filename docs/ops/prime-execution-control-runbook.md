# Prime Execution Control — Runbook

## How Michael starts the first yellow mission

### Option A — Admin UI

1. Open `/admin/swarm` (owner session).
2. Click **Seed yellow journal-auth (draft only)**.
3. Confirm mission appears with status `draft`, risk `yellow`.
4. Click **Approve**, then **Start**.
5. Workstreams `scout → builder → verifier → reviewer` appear as `queued`.
6. Wait for `agent-worker` tick **or** POST `{ "action": "tick" }` to  
   `/api/v1/bypilar/prime/missions`.
7. Review evidence / `awaiting_verification` / `ready_for_review`.
8. Owner may `mark_approved_for_merge` — **then open/merge PR manually**.  
   Never expect auto-merge/deploy.

### Option B — API

```bash
# 1) Seed draft (idempotent by fixtureId)
curl -X POST "$BASE/api/v1/bypilar/prime/missions" \
  -H "Cookie: $SESSION" -H "Content-Type: application/json" \
  -d '{"action":"seed_fixture","fixtureId":"secure-journal-route-authorization"}'

# 2) Approve
curl -X POST "$BASE/api/v1/bypilar/prime/missions" \
  -H "Cookie: $SESSION" -H "Content-Type: application/json" \
  -d '{"action":"approve","missionId":"msn_..."}'

# 3) Start (spawns queued workstreams; does not run builders until tick)
curl -X POST "$BASE/api/v1/bypilar/prime/missions" \
  -H "Cookie: $SESSION" -H "Content-Type: application/json" \
  -d '{"action":"start","missionId":"msn_..."}'

# 4) Optional manual dispatcher tick
curl -X POST "$BASE/api/v1/bypilar/prime/missions" \
  -H "Cookie: $SESSION" -H "Content-Type: application/json" \
  -d '{"action":"tick"}'
```

### Safety

- Seed creates **draft only** — no auto-approve, no production journal auth edits until you approve/start **and** a tick runs builders in a **worktree**.
- Builder worktrees use existing `lib/swarm/worktree-manager.ts` (human gate for merge).
- Path overlap between builders → `blocked`, never overwrite.
- Failures increment rework budget; they do not kill `agent-worker`.

## Ops checks

| Check | How |
|-------|-----|
| Dispatcher state | `GET .../prime/missions?view=dispatcher` |
| Budget | `GET .../prime/missions?view=budget&missionId=` |
| Invariants | `GET .../prime/missions?view=invariants` |
| Agent tick includes missions | Worker log / tick JSON field `missions` |

## Migrations

1. `0005_mission_snapshots.sql` — JSON blob mirror  
2. `0006_prime_missions_relational.sql` — `prime_missions` / `prime_workstreams` / `prime_agent_runs`  
Primary runtime store remains memory + `PRAXIS_DATA_DIR/mission-store.json` (mock-ready).

## Rollback

- Pause/cancel mission via API/UI.
- Discard swarm worktrees via existing swarm discard helpers.
- Revert git commits on this branch; clinic tick still works without missions.
