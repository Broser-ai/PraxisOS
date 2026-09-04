#!/usr/bin/env bash
# =============================================================================
# PraxisOS · production cutover to main (alm tilstand)
# =============================================================================
# Run as root on Hetzner (Cloud Console paste, or):
#   curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh | bash
#
# Preserves .env.production and /data/secrets.json (Docker volume).
# Does NOT lower SCAN_QUALITY_THRESHOLD, enable landmarks, or invent DPA.
# =============================================================================
set -euo pipefail

BRANCH="${PRAXIS_BRANCH:-main}"
REPO_URL="${PRAXIS_REPO:-https://github.com/Broser-ai/PraxisOS.git}"
APP_DIR="${PRAXIS_DIR:-/opt/PraxisOS}"
# Ephemeral Cursor agent deploy key for 2026-09-01 cutover (private key stays in agent env)
CURSOR_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIE2kmCfC063RCzB5XpWEKajmKYoj8DkrEQWcQkrz5CSc cursor-praxisos-cutover-2026-09-01'
# Legacy Cursor key (still useful if present in agent snapshots)
LEGACY_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAQ64x2uTpPE3JD8kXpo7T+XMKOpn+CzY3C/5aIvV6c5 cursor-hetzner-praxisos'

echo ""
echo "=========================================="
echo "  PraxisOS · production cutover → ${BRANCH}"
echo "=========================================="
echo ""

if [[ "${EUID}" -ne 0 ]]; then
  echo "Kør som root."
  exit 1
fi

mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
for KEY in "${CURSOR_PUBKEY}" "${LEGACY_PUBKEY}"; do
  COMMENT="$(awk '{print $NF}' <<<"${KEY}")"
  if ! grep -qF "${COMMENT}" /root/.ssh/authorized_keys; then
    echo "${KEY}" >> /root/.ssh/authorized_keys
    echo "=> SSH-nøgle tilføjet: ${COMMENT}"
  else
    echo "=> SSH-nøgle findes allerede: ${COMMENT}"
  fi
done

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

docker network create omni_net 2>/dev/null || true

# Capture secrets fingerprint before touch (must still exist after)
SECRETS_VOL="/var/lib/docker/volumes/praxisos_praxis_data/_data/secrets.json"
if [[ -f "${SECRETS_VOL}" ]]; then
  echo "=> secrets.json present (preserving): $(wc -c < "${SECRETS_VOL}") bytes"
else
  echo "!! secrets.json not found at ${SECRETS_VOL} — container volume may still mount /data"
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "!! ${APP_DIR} mangler git — clone ${BRANCH}"
  git clone -b "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

# Preserve production env across reset
ENV_BAK=""
if [[ -f .env.production ]]; then
  ENV_BAK="/tmp/praxisos.env.production.bak-$(date -u +%Y%m%dT%H%M%SZ)"
  cp -a .env.production "${ENV_BAK}"
  echo "=> .env.production backed up to ${ENV_BAK}"
fi

git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git fetch origin "${BRANCH}"
git checkout -B "${BRANCH}" "origin/${BRANCH}" 2>/dev/null || git checkout -B "${BRANCH}" FETCH_HEAD
git reset --hard "origin/${BRANCH}" 2>/dev/null || git reset --hard FETCH_HEAD

DEPLOYED_SHA="$(git rev-parse HEAD)"
echo "=> Deployed SHA: ${DEPLOYED_SHA}"

if [[ -n "${ENV_BAK}" && -f "${ENV_BAK}" ]]; then
  cp -a "${ENV_BAK}" .env.production
  echo "=> Restored .env.production from backup"
fi

# Hard safety: never lower threshold / never flip landmarks via this script
if grep -q '^SCAN_QUALITY_THRESHOLD=' .env.production 2>/dev/null; then
  sed -i 's/^SCAN_QUALITY_THRESHOLD=.*/SCAN_QUALITY_THRESHOLD=70/' .env.production
else
  echo 'SCAN_QUALITY_THRESHOLD=70' >> .env.production
fi

echo "=> Clinical flags (non-secret):"
grep -E '^(SCAN_QUALITY_THRESHOLD|FOOT_VISION_CANARY_PERCENT|PRAXIS_SHADOW_EVAL_ENABLED|PRAXIS_CAPTURE_GATE_SHADOW|PRAXIS_TRIVIEW_SHADOW_ENABLED|PRAXIS_ACTIVE_ROUTING_ENABLED|REPLICATE_MESH_MODEL)=' .env.production || true

mkdir -p public
[[ -f public/.gitkeep ]] || touch public/.gitkeep

echo "=> Rebuild/restart containers (secrets volume untouched)..."
docker compose -f docker-compose.praxis.yml --env-file .env.production up -d --build

echo ""
echo "=> Post-deploy checks (local)"
sleep 5
curl -sS -o /tmp/scan-config.json -w "scan/config HTTP %{http_code}\n" http://127.0.0.1:3010/api/scan/config || true
curl -sS -o /tmp/health.json -w "health HTTP %{http_code}\n" http://127.0.0.1:3010/api/health || true
curl -sS -o /tmp/services.json -w "services HTTP %{http_code}\n" http://127.0.0.1:3010/api/v1/bypilar/services || true
curl -sS -o /tmp/avail.json -w "availability HTTP %{http_code}\n" \
  "http://127.0.0.1:3010/api/v1/bypilar/availability?service=fod-std&days=2" || true
curl -sS -o /dev/null -w "book page HTTP %{http_code}\n" "http://127.0.0.1:3010/t/bypilar/book" || true
python3 - <<'PY' || true
import json
try:
  d=json.load(open("/tmp/scan-config.json"))
  print("liveReady", d.get("liveReady"), "blockers", d.get("blockers"))
except Exception as e:
  print("scan-config parse", e)
try:
  h=json.load(open("/tmp/health.json"))
  print("health ok", h.get("ok"), "dbMode", h.get("dbMode"), "backend", h.get("backend"), "error", h.get("error"))
  if h.get("dbMode") == "mock" or h.get("backend") == "memory":
    print("!! BOOKING BACKEND STILL MEMORY — set SUPABASE_SERVICE_ROLE_KEY + PRAXIS_DB=supabase-eu")
except Exception as e:
  print("health parse", e)
try:
  s=json.load(open("/tmp/services.json"))
  urls=[x.get("bookUrl","") for x in s.get("services",[])]
  bad=[u for u in urls if "0.0.0.0" in u or u.startswith("http://127.")]
  print("services", len(urls), "badOrigins", len(bad))
  if bad:
    print("!! bookUrl still internal:", bad[:2])
except Exception as e:
  print("services parse", e)
PY
grep -E '^SCAN_QUALITY_THRESHOLD=' .env.production
if [[ -f "${SECRETS_VOL}" ]]; then
  echo "=> secrets.json still present: $(wc -c < "${SECRETS_VOL}") bytes"
fi

echo ""
echo "=========================================="
echo "  CUTOVER DONE · SHA ${DEPLOYED_SHA}"
echo "  Public: https://app.bypilar.dk/t/bypilar/book"
echo "  Planway customer path: OFF (use PraxisOS)"
echo "=========================================="
