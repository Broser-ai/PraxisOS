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
| 2 | Self-host DB running (or documented equivalent) with migrations | **deferred (override)** | **Hetzner `167.233.171.184`:** SSH still **Permission denied** after Path A retries with `/home/ubuntu/.ssh/hetzner_praxis` (and any other keys). Console script `scripts/console-selfhost-db-cutover.sh` not yet run on host. **Residual:** Hetzner Postgres still needs that Console script later. Data preserved in backups + fixture + migrations `0001`/`0003`–`0006`. Agent VM previously verified fixture restore counts **2/9/18**. |
| 3 | App production path no longer requires cloud Supabase URL | **pass** | Live `GET https://app.bypilar.dk/api/health` → `dbMode=mock`, `backend=memory` (cloud unused). Never set `PRAXIS_DB=supabase-eu` as silent rollback. |
| 4 | Remote-only gaps merged into repo as needed | **pass** | `0003`–`0006` in repo; cloud migrations include swarm/agent/scan + harden. |

## Verdict

```text
DELETE_READY: yes
```

**Override basis:** **Broser finish-now override 2026-09-01** — Michael ordered finish immediately; live prod is `dbMode=mock` (cloud unused); MCP/fixture backup exists (`tenants=2`, `services=9`, `activations=18`). Path A SSH cutover blocked; Path B override exercised.

**Project action this run:** pause **only** `jajdtvduzkitjzcazcng` via Supabase MCP `pause_project` (no `delete_project` API in MCP). MCP evidence: `status=PAUSING` → **`status=INACTIVE`** (paused). Nothing else touched (Hetzner / Replicate / Roboflow / GitHub / OpenAI / Bird / DNS / Traefik / secrets).

**PR #25:** commit pushed on `cursor/supabase-selfhost-migrate-2c11`; `gh pr edit/comment` blocked (integration read-only) — title/body may still say gate not green until edited in GitHub UI.

### Residual (post-pause)

Paste as root on Hetzner Cloud Console when ready to warm self-host Postgres:

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/supabase-selfhost-migrate-2c11/scripts/console-selfhost-db-cutover.sh | bash
```

That authorizes SSH keys, starts `praxisos_db`, restores fixture data, keeps `PRAXIS_DB=mock`.

### Dashboard hard-delete (optional if pause insufficient)

1. https://supabase.com/dashboard/project/jajdtvduzkitjzcazcng/settings/general  
2. Confirm project name **PraxisOS** / ref **jajdtvduzkitjzcazcng** only.  
3. Scroll to **Delete project** → type ref → confirm.  
4. Do **not** touch any other vendor or the Hetzner host.
