#!/usr/bin/env bash
# db-init-selfhost.sh — first-time init for the self-host Postgres volume
# (P0 plan §C.3 / §F9). Creates the volume, starts the DB, and runs
# migrations 0001→0008 in order. Idempotent. Does NOT touch .env.production
# and does NOT switch PRAXIS_DB (that is Michael's manual cutover step).
#
# Run on the Hetzner host from the repo root:
#   bash scripts/db-init-selfhost.sh
set -euo pipefail

if [ ! -f .env.production ]; then
  echo "[db-init] .env.production not found — copy .env.production.example and fill secrets first" >&2
  exit 1
fi

if ! grep -q "^POSTGRES_PASSWORD=.\+" .env.production; then
  echo "[db-init] POSTGRES_PASSWORD must be set in .env.production (non-empty)" >&2
  exit 1
fi

echo "[db-init] starting Postgres (docker-compose.db.yml)…"
docker compose -f docker-compose.db.yml --env-file .env.production up -d praxis-db

echo "[db-init] waiting for pg_isready…"
for _ in $(seq 1 30); do
  if docker compose -f docker-compose.db.yml exec -T praxis-db pg_isready -U praxis >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "[db-init] applying migrations (0001→0008)…"
docker compose -f docker-compose.db.yml --env-file .env.production --profile migrate run --rm praxis-db-migrate

echo "[db-init] done. Verify with: docker compose -f docker-compose.db.yml exec praxis-db psql -U praxis -d praxis -c '\\dt'"
echo "[db-init] NOTE: PRAXIS_DB was NOT changed. Michael switches it in .env.production during the manual cutover."
