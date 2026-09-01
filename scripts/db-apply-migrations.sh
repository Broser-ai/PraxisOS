#!/usr/bin/env bash
# Apply supabase/migrations/*.sql against a running PraxisOS Postgres.
# Usage (compose profile):
#   docker compose -f docker-compose.db.yml --env-file .env.production --profile migrate run --rm praxis-db-migrate
# Or host:
#   POSTGRES_HOST=127.0.0.1 POSTGRES_PASSWORD=... bash scripts/db-apply-migrations.sh
set -euo pipefail

HOST="${POSTGRES_HOST:-praxis-db}"
PORT="${POSTGRES_PORT:-5432}"
USER="${POSTGRES_USER:-praxis}"
DB="${POSTGRES_DB:-praxisos}"
MIG_DIR="${MIGRATIONS_DIR:-/migrations}"

if [[ ! -d "$MIG_DIR" ]]; then
  # when run from repo root without compose mount
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  MIG_DIR="${ROOT}/supabase/migrations"
fi

export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"

echo "[migrate] waiting for ${HOST}:${PORT}…"
for i in $(seq 1 60); do
  if pg_isready -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
pg_isready -h "$HOST" -p "$PORT" -U "$USER" -d "$DB"

psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists vector;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
SQL

shopt -s nullglob
for f in "$MIG_DIR"/*.sql; do
  echo "[migrate] $(basename "$f")"
  psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -f "$f"
done

echo "[migrate] OK"
