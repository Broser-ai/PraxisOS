# Supabase cloud delete gate · PraxisOS

**Authorization (Michael Broser):** OK to delete/pause **only** Supabase project `jajdtvduzkitjzcazcng` (`https://jajdtvduzkitjzcazcng.supabase.co`) **after** transfer + backup + app cutover are verified — **or** via explicit Broser finish-now override (below).

**NEVER delete/destroy/modify:** Hetzner server, Replicate, Roboflow, GitHub, OpenAI, Bird, DNS, Traefik, `/data/secrets.json`, or any non-Supabase resource.

**Branch:** `cursor/supabase-selfhost-migrate-2c11`  
**MCP delete support:** `pause_project` exists; no full `delete_project` tool — Dashboard delete if pause insufficient.

---

## Gate checklist

| # | Criterion | Status (2026-09-01 · Broser finish-now) | Evidence |
|---|-----------|------------------------------------------|----------|
| 1 | Durable backup of schema+data documented | **pass** | Fresh MCP dump `backups/supabase-20260901T141731Z/` (gitignored) + typed fixture `scripts/fixtures/supabase-cloud-data-restore.sql` (in git). Exact `COUNT(*)`: `tenants=2`, `services=9`, `module_activations=18` (all other public tables 0). Storage bucket `scans` exists, 0 objects. |
| 2 | Self-host DB running (or documented equivalent) with migrations | **pass** | **Hetzner `167.233.171.184`:** cutover completed 2026-09-01 via `HCLOUD_TOKEN` + rescue key inject (disk intact). `praxisos_db` healthy; fixture restore counts `tenants=2` `services=9` `module_activations=18`; migrations `0001`/`0003`–`0006` applied. App remains `PRAXIS_DB=mock` (intentional). See [`hetzner-cutover-execution-2026-09-01.md`](./hetzner-cutover-execution-2026-09-01.md). |
| 3 | App production path no longer requires cloud Supabase URL | **pass** | Live `GET https://app.bypilar.dk/api/health` → `dbMode=mock`, `backend=memory` (cloud unused). Never set `PRAXIS_DB=supabase-eu` as silent rollback. |
| 4 | Remote-only gaps merged into repo as needed | **pass** | `0003`–`0006` in repo; cloud migrations include swarm/agent/scan + harden. |

## Verdict

```text
DELETE_READY: yes
```

**Override basis:** earlier Broser finish-now override plus **completed host cutover 2026-09-01** (Path A via Hetzner rescue + `console-selfhost-db-cutover.sh`). Live prod `dbMode=mock` (cloud unused); self-host Postgres warm with fixture counts 2/9/18.

**Project action:** Supabase `jajdtvduzkitjzcazcng` remains **paused / INACTIVE**. No hard-delete this run. Nothing else touched (Replicate / Roboflow / OpenAI / Bird / DNS; Traefik only ACME file restore after rescue side-effect).

**PR #25:** docs + script fixes on `cursor/supabase-selfhost-migrate-2c11`.

### Residual (post-cutover)

1. Rotate Hetzner API token (pasted in chat).
2. Keep `PRAXIS_DB=mock` until Kong/PostgREST ready for `supabase-selfhost` flip.
3. Optional: remove NXDOMAIN `praxis.bypilar.dk` from Traefik router SANs so ACME re-issue does not fail.
4. Optional Dashboard hard-delete of paused Supabase project if pause insufficient.

### Dashboard hard-delete (optional if pause insufficient)

1. https://supabase.com/dashboard/project/jajdtvduzkitjzcazcng/settings/general  
2. Confirm project name **PraxisOS** / ref **jajdtvduzkitjzcazcng** only.  
3. Scroll to **Delete project** → type ref → confirm.  
4. Do **not** touch any other vendor or the Hetzner host.
