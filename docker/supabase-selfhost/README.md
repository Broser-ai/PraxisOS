# Optional full Supabase API stack (Kong / PostgREST / Auth / Storage)

PraxisOS durable data lives in `docker-compose.db.yml` (Postgres 17 + pgvector).

For `PRAXIS_DB=supabase-selfhost` with `@supabase/supabase-js`, run the official
[supabase/docker](https://github.com/supabase/docker) compose on the same Hetzner host
and point `SUPABASE_URL` at Kong (port 8000 or `https://db.bypilar.dk`).

Do not commit JWT secrets, anon keys, or service_role keys. See
`docs/ops/supabase-to-hetzner-migration.md`.
