# Supabase durable backup pointers

Live dump directories under `./backups/` are **gitignored** (may hold clinical / tenant data).

## Latest inventory backup (agent · 2026-09-01T14:17Z)

| Field | Value |
|-------|--------|
| Path | `backups/supabase-20260901T141731Z/` (local / agent FS · not in git) |
| Cloud | `jajdtvduzkitjzcazcng` · `ACTIVE_HEALTHY` |
| Exact row counts | `tenants=2`, `services=9`, `module_activations=18` · all other public tables `0` |
| Contents | `schema.sql`, typed `data.sql`, `cloud-data.json`, per-table JSON, `rowcounts.txt`, `columns.json`, `policies.json`, `RESTORE.md`, `MANIFEST.txt` |
| Git fixture (downloadable) | `scripts/fixtures/supabase-cloud-data-restore.sql` — same typed INSERTs for Console restore |
| Agent local verify (NON-PROD) | Postgres 16 native + migrations + restore → counts **2/9/18** |
| `pg_dump` | Still preferred when `SOURCE_DB_URL` available: `bash scripts/supabase-dump-remote.sh` |

Prior paths `supabase-20260901T123813Z/` / `T131449Z/` retained; **superseded** by `T141731Z` (typed arrays + local verify).

Delete readiness: [`supabase-delete-gate.md`](./supabase-delete-gate.md) — **DELETE_READY: no** until Hetzner Console script lands Postgres on host.
