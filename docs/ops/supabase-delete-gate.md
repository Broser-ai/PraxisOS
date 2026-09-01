# Supabase cloud delete gate · PraxisOS

**Authorization (Michael Broser):** OK to delete/pause **only** Supabase project `jajdtvduzkitjzcazcng` (`https://jajdtvduzkitjzcazcng.supabase.co`) **after** transfer + backup + app cutover are verified.

**NEVER delete/destroy/modify:** Hetzner server, Replicate, Roboflow, GitHub, OpenAI, Bird, DNS, Traefik, `/data/secrets.json`, or any non-Supabase resource.

**Branch:** `cursor/supabase-selfhost-migrate-2c11`  
**MCP delete support:** `pause_project` exists; no full `delete_project` tool — Dashboard delete if pause insufficient.

---

## Gate checklist

| # | Criterion | Status (2026-09-01) | Evidence |
|---|-----------|---------------------|----------|
| 1 | Durable backup of schema+data documented | **partial** | Inventory backup `backups/supabase-20260901T123813Z/` (gitignored) + `docs/ops/supabase-backup-pointers.md`. All cloud public tables **0 rows**. Full `pg_dump` still needs `SOURCE_DB_URL` (Dashboard DB password). |
| 2 | Self-host DB running (or documented equivalent) with migrations | **fail** | Compose + migrations in repo (`docker-compose.db.yml`, `0001`–`0006`). Host `167.233.171.184` SSH still `Permission denied` (cutover pubkey not authorized until Console one-liner). No verified `praxis_pgdata` / Kong on host. |
| 3 | App production path no longer requires cloud Supabase URL (or dual-run note → fail) | **fail** | Production default `PRAXIS_DB=mock`. Cutover to `supabase-selfhost` not verified on host. Cloud remains rollback target → dual-run still needed → **DELETE_READY=no**. |
| 4 | Remote-only gaps merged into repo as needed | **pass** | `0003`–`0006` in repo; cloud migrations include swarm/agent/scan + harden. |

## Verdict

```text
DELETE_READY: no
```

### Remaining before delete/pause

1. Run Hetzner Console one-liner so agent SSH works (`scripts/production-cutover-main.sh` on `main`).
2. On host: `docker compose -f docker-compose.db.yml --env-file .env.production up -d` + apply migrations; optional Kong/supabase-docker.
3. Optional but preferred: `SOURCE_DB_URL=… bash scripts/supabase-dump-remote.sh` → durable `pg_dump` under `./backups/`.
4. Point production at self-host (`PRAXIS_DB=supabase-selfhost` + Kong URL/keys in `.env.production` only) **or** keep intentional `mock` with a written note that cloud is unused — then remove cloud rollback dependency.
5. Re-run this gate; if all **pass**, pause/delete **only** `jajdtvduzkitjzcazcng` (MCP `pause_project` or Dashboard).

### Dashboard delete steps (only when DELETE_READY=yes)

1. https://supabase.com/dashboard/project/jajdtvduzkitjzcazcng/settings/general  
2. Confirm project name **PraxisOS** / ref **jajdtvduzkitjzcazcng** only.  
3. Scroll to **Delete project** → type ref → confirm.  
4. Do **not** touch any other vendor or the Hetzner host.
