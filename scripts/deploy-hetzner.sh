#!/usr/bin/env bash
# =============================================================================
# PraxisOS · deploy på egen Hetzner (Ubuntu) — inkl. Bird SMS
# =============================================================================
# Brug (som root på serveren):
#   cd /opt/PraxisOS && bash scripts/deploy-hetzner.sh
#
# Første gang: kopiér .env.production.example → .env.production og indsæt BIRD_API_KEY
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

echo ""
echo "=========================================="
echo "  PraxisOS · Hetzner deploy"
echo "=========================================="
echo ""

if [[ "${EUID}" -ne 0 ]]; then
  echo "Kør som root: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git make

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

docker network create omni_net 2>/dev/null || true

if [[ ! -f .env.production ]]; then
  cp .env.production.example .env.production
  echo "=> Oprettede .env.production — UDFYLD BIRD_API_KEY før SMS virker"
fi

# Ensure public exists for Docker copy
mkdir -p public
[[ -f public/.gitkeep ]] || touch public/.gitkeep

echo "=> Bygger og starter PraxisOS (port 3010)..."
docker compose -f docker-compose.praxis.yml --env-file .env.production up -d --build

echo ""
echo "FÆRDIG"
echo "  App:         http://$(curl -4 -fsSL https://ifconfig.me 2>/dev/null || echo SERVER-IP):3010"
echo "  Automation:  http://SERVER-IP:3010/admin/agents/automation"
echo "  Bird UI:     http://SERVER-IP:3010/admin/bird"
echo "  Setup:       http://SERVER-IP:3010/setup"
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -20
