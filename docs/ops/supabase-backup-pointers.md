# Supabase durable backup pointers

Live dump directories under `./backups/` are **gitignored** (may hold clinical / tenant data).

## Latest inventory backup (agent · 2026-09-01T13:14Z)

| Field | Value |
|-------|--------|
| Path | `backups/supabase-20260901T131449Z/` (local / agent FS · not in git) |
| Cloud | `jajdtvduzkitjzcazcng` · `https://jajdtvduzkitjzcazcng.supabase.co` · `ACTIVE_HEALTHY` |
| Exact row counts | `tenants=2`, `services=9`, `module_activations=18` · all other public tables `0` |
| Contents | `schema.sql` (repo migrations concat), `data.sql` (MCP logical INSERTs), `cloud-data.json`, per-table JSON, `rowcounts.txt`, `columns.json`, `policies.json`, `MANIFEST.txt` |
| Correction | Earlier MCP `list_tables` / `pg_stat` “0 rows” was **stale/wrong** — use `COUNT(*)` |
| `pg_dump` | Still preferred when `SOURCE_DB_URL` is available: `bash scripts/supabase-dump-remote.sh` |

Prior path `backups/supabase-20260901T123813Z/` retained but **superseded** (incorrect empty-data assumption).

Delete readiness: [`supabase-delete-gate.md`](./supabase-delete-gate.md)
