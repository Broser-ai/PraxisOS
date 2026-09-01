#!/usr/bin/env bash
# Restore a dump produced by scripts/supabase-dump-remote.sh onto Hetzner Postgres.
# Does NOT touch the source Supabase project.
#
# Usage:
#   TARGET_DB_URL=postgresql://praxis:PASS@127.0.0.1:5432/praxisos \
#     bash scripts/supabase-restore-hetzner.sh ./backups/supabase-YYYYMMDD…
#
# Prefer applying repo migrations first (schema source of truth), then data-only:
#   APPLY_REPO_MIGRATIONS=1 TARGET_DB_URL=... bash scripts/supabase-restore-hetzner.sh …
set -euo pipefail

DUMP_DIR="${1:?Usage: $0 <dump-dir>}"
TARGET_DB_URL="${TARGET_DB_URL:?Set TARGET_DB_URL}"
APPLY_REPO_MIGRATIONS="${APPLY_REPO_MIGRATIONS:-0}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -d "$DUMP_DIR" ]]; then
  echo "Dump dir not found: $DUMP_DIR" >&2
  exit 1
fi

echo "[restore] target reachable?"
psql "$TARGET_DB_URL" -c 'select version();' >/dev/null

if [[ "$APPLY_REPO_MIGRATIONS" == "1" ]]; then
  echo "[restore] applying repo migrations as schema source of truth"
  export POSTGRES_PASSWORD
  # Parse URL loosely for apply script — prefer psql -f loop
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "  -> $(basename "$f")"
    psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
  done
fi

if [[ -f "$DUMP_DIR/public.dump" ]]; then
  echo "[restore] pg_restore custom dump (data+schema if migrations skipped)"
  if [[ "$APPLY_REPO_MIGRATIONS" == "1" ]]; then
    pg_restore --data-only --no-owner --no-privileges --disable-triggers \
      -d "$TARGET_DB_URL" "$DUMP_DIR/public.dump" || true
  else
    pg_restore --no-owner --no-privileges --disable-triggers \
      -d "$TARGET_DB_URL" "$DUMP_DIR/public.dump" || true
  fi
elif [[ -f "$DUMP_DIR/data.sql" ]]; then
  echo "[restore] plain data.sql"
  psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$DUMP_DIR/data.sql"
else
  echo "No public.dump or data.sql in $DUMP_DIR" >&2
  exit 1
fi

echo "[restore] verify RLS enabled"
psql "$TARGET_DB_URL" -c \
  "select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' order by 1;"

echo "[restore] DONE — verify with scripts/verify-rls.sh"
