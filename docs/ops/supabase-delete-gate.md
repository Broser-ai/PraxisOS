# Supabase cloud delete gate · PraxisOS

**Authorization (Michael Broser):** OK to delete/pause **only** Supabase project `jajdtvduzkitjzcazcng` (`https://jajdtvduzkitjzcazcng.supabase.co`) **after** transfer + backup + app cutover are verified.

**NEVER delete/destroy/modify:** Hetzner server, Replicate, Roboflow, GitHub, OpenAI, Bird, DNS, Traefik, `/data/secrets.json`, or any non-Supabase resource.

**Branch:** `cursor/supabase-selfhost-migrate-2c11`  
**MCP delete support:** `pause_project` exists; no full `delete_project` tool — Dashboard delete if pause insufficient.

---

## Gate checklist

| # | Criterion | Status (2026-09-01 · finish pass) | Evidence |
|---|-----------|-----------------------------------|----------|
| 1 | Durable backup of schema+data documented | **pass** | Fresh MCP dump `backups/supabase-20260901T141731Z/` (gitignored) + typed fixture `scripts/fixtures/supabase-cloud-data-restore.sql` (in git). Exact `COUNT(*)`: `tenants=2`, `services=9`, `module_activations=18` (all other public tables 0). Storage bucket `scans` exists, 0 objects. Full `pg_dump` still optional (`SOURCE_DB_URL` unset). |
| 2 | Self-host DB running (or documented equivalent) with migrations | **partial** | **Agent VM (NON-PROD):** native Postgres 16 + pgvector applied migrations `0001`+`0003`–`0006`, restored fixture → counts **2/9/18**. Docker `pgvector/pgvector:pg17` pull failed (overlay whiteout). **Hetzner `167.233.171.184`:** SSH still **Permission denied** (cutover pubkey not authorized). `HCLOUD_TOKEN` / `SOURCE_DB_URL` unset. Cursor secrets requested. |
| 3 | App production path no longer requires cloud Supabase URL | **pass** | Live `GET https://app.bypilar.dk/api/health` → `dbMode=mock`, `backend=memory` (cloud unused). Keep mock until host Postgres verified. Never set `PRAXIS_DB=supabase-eu` as silent rollback. |
| 4 | Remote-only gaps merged into repo as needed | **pass** | `0003`–`0006` in repo; cloud migrations include swarm/agent/scan + harden. |

## Verdict

```text
DELETE_READY: no
```

**Project deleted this run:** no (gate not green — prefer Hetzner self-host verify before pause/delete).

### Sole remaining step (Michael · Hetzner Console)

Paste **one** script as root (authorizes SSH keys + starts Postgres + restores cloud data + keeps `PRAXIS_DB=mock`):

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/supabase-selfhost-migrate-2c11/scripts/console-selfhost-db-cutover.sh | bash
```

After that, next agent can SSH, confirm `praxisos_db` counts 2/9/18, set `DELETE_READY: yes`, then `pause_project` / Dashboard-delete **only** `jajdtvduzkitjzcazcng`.

### Broser risk note (not exercised this run)

Prod is already mock-only with durable backup and no cloud dependency at runtime. Prefer **(a)** Hetzner verify via Console script before delete. Do **not** delete on mock-only alone unless Michael explicitly accepts that risk in a follow-up.

### Dashboard delete steps (only when DELETE_READY=yes)

1. https://supabase.com/dashboard/project/jajdtvduzkitjzcazcng/settings/general  
2. Confirm project name **PraxisOS** / ref **jajdtvduzkitjzcazcng** only.  
3. Scroll to **Delete project** → type ref → confirm.  
4. Do **not** touch any other vendor or the Hetzner host.
