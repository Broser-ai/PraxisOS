#!/usr/bin/env bash
# PraxisOS · DelPilar Nexus er INDE i Docker-appen (ikke en separat proces).
# Dette script er kun en genvej til den normale Hetzner-løsning.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT}"

echo ""
echo "=========================================="
echo "  PraxisOS · Nexus kører i løsningen"
echo "=========================================="
echo ""
echo "Nexus (ARIA / NINA / FELIX / LUNA / S-Agent) starter automatisk"
echo "sammen med praxisos_app + agent-worker. Ingen separat swarm."
echo ""
echo "  Scan-UI:   http://HOST:3010/scan"
echo "  Scan-API:  POST /api/v1/scan/process"
echo "  Worker:    kalder /api/agents/tick (booter Nexus)"
echo ""

if [[ "${1:-}" == "up" || "${1:-}" == "deploy" ]]; then
  if [[ -f scripts/deploy-hetzner.sh ]]; then
    exec bash scripts/deploy-hetzner.sh
  fi
fi

if [[ -f docker-compose.praxis.yml && -f .env.production ]]; then
  echo "=> Starter docker compose (praxisos + agent-worker)..."
  docker compose -f docker-compose.praxis.yml --env-file .env.production up -d --build
  echo ""
  echo "Færdig · åbn /scan i PraxisOS"
  exit 0
fi

echo "Kør på serveren:"
echo "  cd /opt/PraxisOS && bash scripts/deploy-hetzner.sh"
echo "Derefter: http://SERVER:3010/scan"
