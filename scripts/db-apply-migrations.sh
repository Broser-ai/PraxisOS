#!/usr/bin/env bash
# db-apply-migrations.sh — apply supabase/migrations/*.sql idempotently to the
# self-host Postgres (P0 plan §C.3 / §F9). Each migration uses IF NOT EXISTS,
# so re-running is safe. Exits non-zero on the first failing migration.
#
# Env: PRAXIS_PG_HOST (default praxis-db), POSTGRES_USER, POSTGRES_DB,
#      PGPASSWORD (set by compose). Run inside the migrate profile container
#      OR locally with psql installed.
set -euo pipefail

HOST="${PRAXIS_PG_HOST:-praxis-db}"
USER="${POSTGRES_USER:-praxis}"
DB="${POSTGRES_DB:-praxis}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "[db-migrate] migrations dir not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

echo "[db-migrate] applying migrations from $MIGRATIONS_DIR to $USER@$HOST/$DB"

shopt -s nullglob
for sql in "$MIGRATIONS_DIR"/*.sql; do
  name="$(basename "$sql")"
  echo "[db-migrate] → $name"
  if ! psql -h "$HOST" -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -f "$sql" >>/tmp/migrate.log 2>&1; then
    echo "[db-migrate] FAILED on $name (see /tmp/migrate.log)" >&2
    cat /tmp/migrate.log >&2 || true
    exit 1
  fi
  echo "[db-migrate] ✓ $name"
done

echo "[db-migrate] all migrations applied"
psql -h "$HOST" -U "$USER" -d "$DB" -c "\dt" >&2 || true
