#!/usr/bin/env bash
# Dump schema+data from Supabase Cloud (or any Postgres) WITHOUT deleting source.
# Requires: pg_dump, network access to source.
#
# Env:
#   SOURCE_DB_URL   postgresql://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
#   OUT_DIR         default: ./backups/supabase-$(date)
#
# Broser: hent DB password fra Supabase Dashboard → Project Settings → Database.
# Brug Session mode pooler ELLER direct db.*.supabase.co:5432.
set -euo pipefail

SOURCE_DB_URL="${SOURCE_DB_URL:?Set SOURCE_DB_URL (postgres connection string)}"
OUT_DIR="${OUT_DIR:-./backups/supabase-$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$OUT_DIR"

echo "[dump] schema → $OUT_DIR/schema.sql"
pg_dump "$SOURCE_DB_URL" \
  --format=plain \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file="$OUT_DIR/schema.sql"

echo "[dump] data → $OUT_DIR/data.sql"
pg_dump "$SOURCE_DB_URL" \
  --format=plain \
  --data-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  --disable-triggers \
  --file="$OUT_DIR/data.sql"

echo "[dump] custom format (full public) → $OUT_DIR/public.dump"
pg_dump "$SOURCE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file="$OUT_DIR/public.dump"

# Inventory snapshot (no secrets)
{
  echo "# Dump inventory $(date -u -Iseconds)"
  echo "source_host=$(echo "$SOURCE_DB_URL" | sed -E 's#.*@([^/]+)/.*#\1#')"
  echo "schemas=public"
  if command -v psql >/dev/null 2>&1; then
    psql "$SOURCE_DB_URL" -Atc \
      "select tablename||':'||n_live_tup from pg_stat_user_tables where schemaname='public' order by tablename;" \
      >"$OUT_DIR/rowcounts.txt" || true
  fi
} >"$OUT_DIR/MANIFEST.txt"

echo "[dump] DONE — source untouched. Files in $OUT_DIR"
echo "Next: TARGET_DB_URL=... bash scripts/supabase-restore-hetzner.sh $OUT_DIR"
