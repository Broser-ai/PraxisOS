#!/usr/bin/env bash
# WP-CLI wrapper · styr bypilar WordPress fra Cursor/SSH
# Brug: ./scripts/wp.sh plugin list
#       ./scripts/wp.sh theme list
#       ./scripts/wp.sh option get siteurl
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

ENV_FILE="${ROOT}/.env.bypilar-wp"
COMPOSE=(docker compose -p bypilar-wp -f docker-compose.bypilar-wp.yml)
if [[ -f "${ENV_FILE}" ]]; then
  COMPOSE+=(--env-file "${ENV_FILE}")
fi

if ! docker ps --format '{{.Names}}' | grep -qx 'bypilar_wp'; then
  echo "bypilar_wp kører ikke. Start med: bash scripts/deploy-bypilar-wp.sh" >&2
  exit 1
fi

# Run WP-CLI in a disposable container sharing the WP volume
"${COMPOSE[@]}" run --rm --entrypoint wp bypilar_wpcli --allow-root "$@"
