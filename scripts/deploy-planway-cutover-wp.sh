#!/usr/bin/env bash
# Deploy Planway→PraxisOS theme cutover to Hetzner WordPress (bypilar.dk).
# Requires SSH to root@167.233.171.184 (HETZNER_PRAXIS_SSH_PRIVATE_KEY or agent key).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${BYPILAR_WP_SSH_HOST:-root@167.233.171.184}"
# Common paths on Hetzner compose; override if needed
REMOTE_THEME="${BYPILAR_WP_THEME_DIR:-/opt/PraxisOS/wordpress/themes/pilar-theme}"
REMOTE_MU="${BYPILAR_WP_MU_DIR:-/opt/PraxisOS/wordpress/mu-plugins}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

if [[ -n "${HETZNER_PRAXIS_SSH_PRIVATE_KEY:-}" ]]; then
  KEY_FILE="$(mktemp)"
  printf '%s\n' "$HETZNER_PRAXIS_SSH_PRIVATE_KEY" > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_OPTS+=(-i "$KEY_FILE")
  trap 'rm -f "$KEY_FILE"' EXIT
elif [[ -f "${HOME}/.ssh/hetzner_praxis" ]]; then
  SSH_OPTS+=(-i "${HOME}/.ssh/hetzner_praxis")
fi

echo "=> Sync pilar-theme → ${HOST}:${REMOTE_THEME}"
ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p '${REMOTE_THEME}/parts' '${REMOTE_THEME}/js' '${REMOTE_THEME}/img' '${REMOTE_MU}'"

rsync -az -e "ssh ${SSH_OPTS[*]}" \
  "${ROOT}/wordpress/themes/pilar-theme/" \
  "${HOST}:${REMOTE_THEME}/"

rsync -az -e "ssh ${SSH_OPTS[*]}" \
  "${ROOT}/wordpress/mu-plugins/praxisos-bridge.php" \
  "${HOST}:${REMOTE_MU}/praxisos-bridge.php"

echo "=> Rewrite WP page content (Planway / PraxisOS brand / http→https) via wp-cli if available"
ssh "${SSH_OPTS[@]}" "$HOST" bash -s <<'REMOTE'
set -euo pipefail
WP=""
for c in bypilar_wp wordpress wp; do
  if docker ps --format '{{.Names}}' | grep -qx "$c"; then WP="$c"; break; fi
done
if [[ -z "$WP" ]]; then
  echo "No WP container found — theme files synced; purge caches manually."
  exit 0
fi
docker exec "$WP" bash -lc '
  if ! command -v wp >/dev/null 2>&1; then
    echo "wp-cli missing in container"
    exit 0
  fi
  wp option update siteurl "https://bypilar.dk" --allow-root 2>/dev/null || true
  wp option update home "https://bypilar.dk" --allow-root 2>/dev/null || true
  for id in $(wp post list --post_type=page --field=ID --allow-root); do
    content=$(wp post get "$id" --field=post_content --allow-root)
    new=$(printf "%s" "$content" \
      | sed -E "s#https?://bypilar\\.planway\\.com[^\"'\''[:space:]]*#/booking/#gi" \
      | sed -E "s#https?://(www\\.)?planway\\.com[^\"'\''[:space:]]*#/booking/#gi" \
      | sed "s#http://app.bypilar.dk#https://app.bypilar.dk#g" \
      | sed "s#via PraxisOS#hos by Pilar#g" \
      | sed "s#fra PraxisOS#hos by Pilar#g" \
      | sed "s# · PraxisOS##g" \
      | sed "s#synkroniseres fra PraxisOS#opdateres løbende#g")
    if [[ "$content" != "$new" ]]; then
      wp post update "$id" --post_content="$new" --allow-root
      echo "updated page $id"
    fi
  done
  wp cache flush --allow-root 2>/dev/null || true
'
REMOTE

echo "=> Smoke"
curl -sL 'https://bypilar.dk/booking/' | grep -qi planway && echo 'FAIL: planway still present' && exit 1 || echo 'OK: no planway on /booking/'
curl -sL 'https://bypilar.dk/booking/' | grep -Fq 'https://app.bypilar.dk/t/bypilar/book?embed=1' && echo 'OK: HTTPS embed' || echo 'WARN: HTTPS embed string not found'
echo "Done."
