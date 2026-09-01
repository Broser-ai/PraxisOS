# Supabase cloud delete gate · PraxisOS

**Authorization (Michael Broser):** OK to delete/pause **only** Supabase project `jajdtvduzkitjzcazcng` (`https://jajdtvduzkitjzcazcng.supabase.co`) **after** transfer + backup + app cutover are verified.

**NEVER delete/destroy/modify:** Hetzner server, Replicate, Roboflow, GitHub, OpenAI, Bird, DNS, Traefik, `/data/secrets.json`, or any non-Supabase resource.

**Branch:** `cursor/supabase-selfhost-migrate-2c11`  
**MCP delete support:** `pause_project` exists; no full `delete_project` tool — Dashboard delete if pause insufficient.

---

## Gate checklist

| # | Criterion | Status (2026-09-01 · recheck) | Evidence |
|---|-----------|-------------------------------|----------|
| 1 | Durable backup of schema+data documented | **partial** | MCP logical dump `backups/supabase-20260901T131449Z/` (gitignored) + `docs/ops/supabase-backup-pointers.md`. **Exact** `COUNT(*)`: `tenants=2`, `services=9`, `module_activations=18` (others 0). Prior `list_tables`/pg_stat “0 rows” was **wrong**. Full `pg_dump` still needs `SOURCE_DB_URL` (Dashboard DB password). |
| 2 | Self-host DB running (or documented equivalent) with migrations | **fail** | Compose + migrations in repo (`docker-compose.db.yml`, `0001`–`0006`). Host `167.233.171.184` SSH retry **Permission denied** (cutover pubkey `cursor-praxisos-cutover-2026-09-01` offered, not authorized). No verified `praxis_pgdata` / Kong on host. Agent has no Docker locally to substitute. |
| 3 | App production path no longer requires cloud Supabase URL (or dual-run note → fail) | **pass** | Live `GET https://app.bypilar.dk/api/health` → `dbMode=mock`, `backend=memory` (cloud unused at runtime). Intentional: stay on `mock` until self-host is up. `supabase-selfhost` never falls back to cloud URL. Do **not** set `PRAXIS_DB=supabase-eu` (that would re-attach cloud). |
| 4 | Remote-only gaps merged into repo as needed | **pass** | `0003`–`0006` in repo; cloud migrations include swarm/agent/scan + harden. |

## Verdict

```text
DELETE_READY: no
```

**Project deleted this run:** no (gate not green — do not pause/delete).

### Remaining before delete/pause

1. **Michael — Hetzner Console one-liner** (unblocks SSH / host Postgres verify):

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh | bash
```

2. On host: `docker compose -f docker-compose.db.yml --env-file .env.production up -d` + apply migrations; restore logical dump (`data.sql` / `cloud-data.json`) or full `pg_dump`; optional Kong/supabase-docker.
3. Preferred: Dashboard DB password → `SOURCE_DB_URL=… bash scripts/supabase-dump-remote.sh` → durable `pg_dump` under `./backups/`.
4. Keep intentional `mock` **or** cut over to `PRAXIS_DB=supabase-selfhost` + Kong URL/keys in `.env.production` only (never `supabase-eu` as silent rollback).
5. Re-run this gate; if all **pass**, pause/delete **only** `jajdtvduzkitjzcazcng` (MCP `pause_project` or Dashboard).

### Dashboard delete steps (only when DELETE_READY=yes)

1. https://supabase.com/dashboard/project/jajdtvduzkitjzcazcng/settings/general  
2. Confirm project name **PraxisOS** / ref **jajdtvduzkitjzcazcng** only.  
3. Scroll to **Delete project** → type ref → confirm.  
4. Do **not** touch any other vendor or the Hetzner host.
