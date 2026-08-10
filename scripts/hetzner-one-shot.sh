#!/usr/bin/env bash
# =============================================================================
# PraxisOS · one-shot bootstrap på Hetzner (kør som root i Cloud Console)
# =============================================================================
# Indsæt hele filen i Hetzner Console → server → Console → paste → Enter
# Eller:
#   curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/ai-agent-automation-2c11/scripts/hetzner-one-shot.sh | bash
# =============================================================================
set -euo pipefail

BRANCH="${PRAXIS_BRANCH:-cursor/ai-agent-automation-2c11}"
REPO_URL="${PRAXIS_REPO:-https://github.com/Broser-ai/PraxisOS.git}"
APP_DIR="${PRAXIS_DIR:-/opt/PraxisOS}"
CURSOR_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAQ64x2uTpPE3JD8kXpo7T+XMKOpn+CzY3C/5aIvV6c5 cursor-hetzner-praxisos'

echo ""
echo "=========================================="
echo "  PraxisOS · one-shot bootstrap"
echo "  branch: ${BRANCH}"
echo "=========================================="
echo ""

if [[ "${EUID}" -ne 0 ]]; then
  echo "Kør som root."
  exit 1
fi

# --- SSH key so Cursor agent can finish deploy ---
mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
if ! grep -qF "cursor-hetzner-praxisos" /root/.ssh/authorized_keys; then
  echo "${CURSOR_PUBKEY}" >> /root/.ssh/authorized_keys
  echo "=> SSH-nøgle til Cursor agent tilføjet"
else
  echo "=> SSH-nøgle findes allerede"
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

docker network create omni_net 2>/dev/null || true

if [[ -d "${APP_DIR}/.git" ]]; then
  cd "${APP_DIR}"
  # Older clones may pin fetch to a single branch — open it up
  git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
  git fetch origin "${BRANCH}"
  git checkout -B "${BRANCH}" "origin/${BRANCH}" 2>/dev/null || git checkout -B "${BRANCH}" FETCH_HEAD
  git reset --hard "origin/${BRANCH}" 2>/dev/null || git reset --hard FETCH_HEAD
else
  rm -rf "${APP_DIR}"
  git clone -b "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  cd "${APP_DIR}"
fi

mkdir -p public
touch public/.gitkeep

if [[ ! -f .env.production ]]; then
  cp .env.production.example .env.production
fi

# Generate secrets if still placeholders / empty
gen_secret() { head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32; }

if grep -qE '^(AGENT_WORKER_SECRET=)$|^(AGENT_WORKER_SECRET=change-me)' .env.production; then
  sed -i "s|^AGENT_WORKER_SECRET=.*|AGENT_WORKER_SECRET=$(gen_secret)|" .env.production
fi
if grep -qE '^(PRAXIS_EVENT_SECRET=)$|^(PRAXIS_EVENT_SECRET=change-me)|^(PRAXIS_EVENT_SECRET=demo-secret-key)' .env.production; then
  sed -i "s|^PRAXIS_EVENT_SECRET=.*|PRAXIS_EVENT_SECRET=$(gen_secret)|" .env.production
fi

# Ensure core defaults
grep -q '^PRAXIS_HOST_PORT=' .env.production || echo 'PRAXIS_HOST_PORT=3010' >> .env.production
grep -q '^NEXT_PUBLIC_BASE_URL=' .env.production || echo 'NEXT_PUBLIC_BASE_URL=http://167.233.171.184:3010' >> .env.production
grep -q '^BIRD_WORKSPACE_ID=' .env.production || echo 'BIRD_WORKSPACE_ID=4ad3f57b-b826-4217-b068-77c9ac0f4f02' >> .env.production
grep -q '^BIRD_SMS_FROM=' .env.production || echo 'BIRD_SMS_FROM=+4526325220' >> .env.production

echo ""
echo "=> Tjek Bird-nøgle:"
if grep -qE '^BIRD_API_KEY=.+' .env.production && ! grep -qE '^BIRD_API_KEY=$' .env.production; then
  echo "   BIRD_API_KEY er sat"
else
  echo "   MANGLER — sæt den med: nano ${APP_DIR}/.env.production"
  echo "   (Bird → Developers → API keys · bypilar_PraxisOS-SMS)"
fi

# Open firewall port if ufw active
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi 'Status: active'; then
  ufw allow 3010/tcp || true
  ufw allow 22/tcp || true
fi

echo ""
echo "=> Bygger og starter containere (kan tage nogle minutter)..."
bash scripts/deploy-hetzner.sh

echo ""
echo "=========================================="
echo "  KLAR"
echo "  Setup:       http://167.233.171.184:3010/setup"
echo "  Automation:  http://167.233.171.184:3010/admin/agents/automation"
echo "  Bird:        http://167.233.171.184:3010/admin/bird"
echo "  Agent-chat:  http://167.233.171.184:3010/agent"
echo "=========================================="
echo ""
echo "Når SSH-nøglen er på plads, kan Cursor-agenten også logge ind og hjælpe videre."
echo ""
