# Supabase durable backup pointers

Live dump directories under `./backups/` are **gitignored** (may hold clinical data later).

## Latest inventory backup (agent · 2026-09-01)

| Field | Value |
|-------|--------|
| Path | `backups/supabase-20260901T123813Z/` (local / agent FS · not in git) |
| Cloud | `jajdtvduzkitjzcazcng` · `https://jajdtvduzkitjzcazcng.supabase.co` |
| Contents | `schema.sql` (repo migrations concat), `data.sql` (empty — 0 cloud rows), `rowcounts.txt`, `columns.json`, `MANIFEST.txt` |
| `pg_dump` | Still preferred when `SOURCE_DB_URL` is available: `bash scripts/supabase-dump-remote.sh` |

Delete readiness: [`../supabase-delete-gate.md`](../supabase-delete-gate.md)
