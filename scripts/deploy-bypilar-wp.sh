#!/usr/bin/env bash
# Deploy by Pilar WordPress på Hetzner (samme server som PraxisOS)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

ENV_FILE="${ROOT}/.env.bypilar-wp"

echo ""
echo "=========================================="
echo "  by Pilar · WordPress deploy"
echo "=========================================="
echo ""

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "=> Opretter ${ENV_FILE}"
  WP_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  ROOT_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  ADMIN_PASS="$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)"
  cat > "${ENV_FILE}" <<EOF
WP_HOST_PORT=8088
WP_DB_NAME=bypilar_wp
WP_DB_USER=bypilar
WP_DB_PASSWORD=${WP_PASS}
WP_DB_ROOT_PASSWORD=${ROOT_PASS}
WP_TABLE_PREFIX=wp_
WP_ADMIN_USER=pilar
WP_ADMIN_PASSWORD=${ADMIN_PASS}
WP_ADMIN_EMAIL=hej@bypilar.dk
PRAXISOS_BASE_URL=https://app.bypilar.dk
PRAXISOS_INTERNAL_URL=http://praxisos_app:3000
# Efter DNS-skift: http://bypilar.dk (eller https:// når TLS er klar)
WP_SITEURL=http://167.233.171.184:8088
WP_SITENAME="by Pilar"
EOF
  chmod 600 "${ENV_FILE}"
  echo "=> Credentials gemt i .env.bypilar-wp (ikke i Git)"
fi

# shellcheck disable=SC1090
set -a; source "${ENV_FILE}"; set +a

docker network create omni_net 2>/dev/null || true

echo "=> Starter WordPress + MariaDB..."
docker compose -f docker-compose.bypilar-wp.yml --env-file "${ENV_FILE}" up -d bypilar_db bypilar_wp

echo "=> Venter på WordPress..."
for i in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${WP_HOST_PORT:-8088}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# Install WP if not installed
if ! bash "${ROOT}/scripts/wp.sh" core is-installed >/dev/null 2>&1; then
  echo "=> Første installation (wp core install)..."
  bash "${ROOT}/scripts/wp.sh" core install \
    --url="${WP_SITEURL}" \
    --title="${WP_SITENAME:-by Pilar}" \
    --admin_user="${WP_ADMIN_USER:-pilar}" \
    --admin_password="${WP_ADMIN_PASSWORD}" \
    --admin_email="${WP_ADMIN_EMAIL:-hej@bypilar.dk}" \
    --skip-email

  bash "${ROOT}/scripts/wp.sh" rewrite structure '/%postname%/' --hard
  bash "${ROOT}/scripts/wp.sh" option update blogdescription 'Negle- og fodpleje · Aarhus'
  bash "${ROOT}/scripts/wp.sh" plugin delete hello akismet 2>/dev/null || true

  # Landing med PraxisOS shortcodes
  PAGE_ID="$(bash "${ROOT}/scripts/wp.sh" post create \
    --post_type=page \
    --post_title='Forside' \
    --post_status=publish \
    --post_content='<!-- wp:heading {"level":1} --><h1>by Pilar</h1><!-- /wp:heading --><!-- wp:paragraph --><p>Negle- og fodpleje i Aarhus — book direkte, styret af PraxisOS.</p><!-- /wp:paragraph --><!-- wp:shortcode -->[praxis_book label="Book tid"]<!-- /wp:shortcode --> <!-- wp:shortcode -->[praxis_book service="fod-scan" label="Book fod-scan"]<!-- /wp:shortcode --> <!-- wp:shortcode -->[praxis_agents]<!-- /wp:shortcode -->' \
    --porcelain)"
  bash "${ROOT}/scripts/wp.sh" option update show_on_front page
  bash "${ROOT}/scripts/wp.sh" option update page_on_front "${PAGE_ID}"
fi

echo ""
echo "FÆRDIG"
echo "  WordPress:  http://167.233.171.184:${WP_HOST_PORT:-8088}"
echo "  WP admin:   http://167.233.171.184:${WP_HOST_PORT:-8088}/wp-admin"
echo "  Bruger:     ${WP_ADMIN_USER:-pilar}"
echo "  Bridge:     mu-plugin praxisos-bridge.php (altid aktiv)"
echo "  Styres med: bash scripts/wp.sh ..."
echo ""
echo "DNS (når klar): A-record @ og www → 167.233.171.184"
echo "Derefter: http://bypilar.dk (Traefik) + opdater WP_SITEURL"
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E 'NAMES|bypilar|praxis|traefik' || true
