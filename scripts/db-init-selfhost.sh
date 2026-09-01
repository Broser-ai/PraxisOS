#!/usr/bin/env bash
# Runs once on first Postgres volume init (docker-entrypoint-initdb.d).
# Creates Supabase-compatible roles stubs + applies PraxisOS migrations in order.
set -euo pipefail

echo "[praxis-init] extensions + roles"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists vector;

-- Supabase-compatible roles so RLS policies with TO anon/authenticated apply.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
SQL

MIG_DIR="${MIGRATIONS_DIR:-/migrations}"
if [[ ! -d "$MIG_DIR" ]]; then
  echo "[praxis-init] no migrations dir at $MIG_DIR — skip"
  exit 0
fi

echo "[praxis-init] applying migrations from $MIG_DIR"
shopt -s nullglob
for f in "$MIG_DIR"/*.sql; do
  echo "  -> $(basename "$f")"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done

echo "[praxis-init] done"
