#!/usr/bin/env bash
# =============================================================================
# Omnichannel Swarm · ét-klik setup til Ubuntu VPS (ikke-programmør)
# =============================================================================
# Brug på en NY Ubuntu 22.04/24.04 server som root eller med sudo:
#
#   curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/omnichannel-swarm-gateway-2c11/omnichannel-swarm/scripts/bootstrap-vps.sh | sudo bash
#
# Eller efter du har klonet repoet:
#   cd omnichannel-swarm && sudo bash scripts/bootstrap-vps.sh
# =============================================================================
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo ""
echo "=========================================="
echo "  Omnichannel Swarm · automatisk setup"
echo "=========================================="
echo ""

if [[ "${EUID}" -ne 0 ]]; then
  echo "Kør som root: sudo bash $0"
  exit 1
fi

PUBLIC_IP="$(curl -4 -fsSL https://ifconfig.me 2>/dev/null || curl -4 -fsSL https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
echo "=> Offentlig IP: ${PUBLIC_IP}"

echo "=> Installerer basis-pakker + Docker..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl git openssl make wget
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker --version
make --version >/dev/null

# Locate swarm dir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/../docker-compose.yml" ]]; then
  SWARM="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  SWARM="/opt/omnichannel-swarm"
  if [[ ! -f "${SWARM}/docker-compose.yml" ]]; then
    echo "=> Kloner PraxisOS (omnichannel branch)..."
    rm -rf /opt/PraxisOS
    git clone --depth 1 -b cursor/omnichannel-swarm-gateway-2c11 \
      https://github.com/Broser-ai/PraxisOS.git /opt/PraxisOS
    SWARM="/opt/PraxisOS/omnichannel-swarm"
  fi
fi

cd "${SWARM}"
echo "=> Swarm mappe: ${SWARM}"

echo "=> Initialiserer netværk + nøgler..."
make init

# Patch Fonoster public IP
if [[ -f fonoster/.env ]]; then
  sed -i "s/CHANGE_ME_PUBLIC_IP/${PUBLIC_IP}/g" fonoster/.env
fi

# Valid Dittofeed session key (32+ bytes)
if [[ -f dittofeed/.env ]]; then
  SECRET="$(openssl rand -base64 32)"
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET}|" dittofeed/.env
fi

MODE="${DEPLOY_MODE:-demo}"
if [[ "${MODE}" == "demo" ]]; then
  echo "=> Starter i DEMO-tilstand (HTTP, uden SSL) — godt til første test"
  make deploy-demo
else
  echo "=> Starter i PROD-tilstand (kræver DNS → denne IP)"
  make deploy-all
fi

echo ""
echo "=========================================="
echo "  FÆRDIG"
echo "=========================================="
echo "Server IP: ${PUBLIC_IP}"
echo ""
echo "Åbn i browser (demo):"
echo "  Traefik:  http://${PUBLIC_IP}:8888/dashboard/"
echo "  CRM:      http://${PUBLIC_IP}:3001/"
echo "  Engage:   http://${PUBLIC_IP}:3002/"
echo ""
echo "Når DNS peger på ${PUBLIC_IP}:"
echo "  crm.praxios.dk / voice.praxios.dk / engage.praxios.dk"
echo "  → kør: DEPLOY_MODE=prod sudo bash scripts/bootstrap-vps.sh"
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
