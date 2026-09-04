#!/usr/bin/env bash
# =============================================================================
# PraxisOS · console self-host DB cutover (prepare Postgres, LEAVE mock)
# =============================================================================
# Run as root on Hetzner (/opt/PraxisOS), after production-cutover-main.sh:
#   bash scripts/console-selfhost-db-cutover.sh
#
# What this does:
#   - Starts self-host Postgres (docker-compose.db.yml)
#   - Applies migrations 0001→0008 (idempotent)
#   - Does NOT change PRAXIS_DB (intentionally leaves mock)
#   - Does NOT wipe /data/secrets.json
#   - Does NOT delete Planway
#
# Required in .env.production (non-empty):
#   POSTGRES_PASSWORD
#
# Optional later (manual Michael step — NOT done here):
#   PRAXIS_DB, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
#   PRAXIS_SESSION_SECRET, PRAXIS_AUDIT_MODE
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

blockers=()

echo ""
echo "=========================================="
echo "  PraxisOS · self-host DB prepare (leave mock)"
echo "=========================================="
echo ""

if [[ "${EUID}" -ne 0 ]]; then
  echo "Kør som root."
  exit 1
fi

if [[ ! -f .env.production ]]; then
  blockers+=("ENV_FILE:.env.production")
fi

if [[ -f .env.production ]]; then
  if ! grep -qE '^POSTGRES_PASSWORD=.+' .env.production; then
    blockers+=("POSTGRES_PASSWORD")
  fi
fi

if [[ ${#blockers[@]} -gt 0 ]]; then
  echo "DB_PREPARE_STATUS=FAIL"
  echo "BLOCKERS=${blockers[*]}"
  echo ""
  echo "Fill missing names in .env.production (no values logged here), then re-run."
  echo "App remains on PRAXIS_DB=mock until Michael flips it manually."
  exit 2
fi

# Snapshot data volume pointer if present (do not delete)
SECRETS_VOL="/var/lib/docker/volumes/praxisos_praxis_data/_data/secrets.json"
if [[ -f "${SECRETS_VOL}" ]]; then
  echo "=> secrets.json present (preserving): $(wc -c < "${SECRETS_VOL}") bytes"
else
  echo "!! secrets.json not at ${SECRETS_VOL} — container volume may still mount /data"
fi

# Record current PRAXIS_DB (must remain mock after this script)
BEFORE_DB="$(grep -E '^PRAXIS_DB=' .env.production | tail -n1 || true)"
echo "=> PRAXIS_DB before: ${BEFORE_DB:-<unset>}"

bash scripts/db-init-selfhost.sh

AFTER_DB="$(grep -E '^PRAXIS_DB=' .env.production | tail -n1 || true)"
echo "=> PRAXIS_DB after:  ${AFTER_DB:-<unset>} (must still be mock / unchanged)"

if grep -qE '^PRAXIS_DB=mock' .env.production 2>/dev/null || [[ -z "${AFTER_DB}" ]]; then
  echo "=> leave-mock: OK"
else
  echo "!! WARNING: PRAXIS_DB is not mock — this script did not change it; confirm intent."
fi

if [[ -f "${SECRETS_VOL}" ]]; then
  echo "=> secrets.json still present: $(wc -c < "${SECRETS_VOL}") bytes"
fi

echo ""
echo "DB_PREPARE_STATUS=OK"
echo "BLOCKERS="
echo "NOTE: App still serves mock until Michael sets PRAXIS_DB + SUPABASE_* and restarts."
echo "      See docs/ops/p0-db-cutover-runbook.md §3."
