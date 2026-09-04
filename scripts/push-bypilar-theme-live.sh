#!/usr/bin/env bash
# Push pilar-theme + mu-plugins to live Hetzner WordPress (bypilar.dk).
# Deploys Planway content-rewrite MU-plugin (runtime HTML kill) + bridge.
# Requires: HETZNER_PRAXIS_SSH_PRIVATE_KEY or ~/.ssh/hetzner_praxis
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${PRAXIS_HOST:-167.233.171.184}"
USER="${PRAXIS_SSH_USER:-root}"
KEY_FILE="${HETZNER_SSH_KEY_FILE:-$HOME/.ssh/hetzner_praxis}"

if [[ -n "${HETZNER_PRAXIS_SSH_PRIVATE_KEY:-}" ]]; then
  mkdir -p "$(dirname "$KEY_FILE")"
  # Support both literal newlines and \n-escaped secrets
  python3 - "$KEY_FILE" <<'PY'
import os, pathlib, sys
raw = os.environ.get("HETZNER_PRAXIS_SSH_PRIVATE_KEY", "")
if "\\n" in raw and "\n" not in raw.strip().split(" ", 1)[-1][:80]:
    raw = raw.replace("\\n", "\n")
path = pathlib.Path(sys.argv[1])
path.write_text(raw if raw.endswith("\n") else raw + "\n")
path.chmod(0o600)
PY
fi

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Missing SSH key. Set HETZNER_PRAXIS_SSH_PRIVATE_KEY or $KEY_FILE" >&2
  exit 1
fi

SSH=(ssh -i "$KEY_FILE" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "${USER}@${HOST}")
THEME_SRC="${ROOT}/wordpress/themes/pilar-theme"
MU_BRIDGE="${ROOT}/wordpress/mu-plugins/praxisos-bridge.php"
MU_REWRITE="${ROOT}/wordpress/mu-plugins/bypilar-planway-content-rewrite.php"

echo "=> Locating live WordPress theme on ${HOST}..."
REMOTE_THEME="$("${SSH[@]}" 'bash -s' <<'REMOTE'
set -e
if command -v docker >/dev/null 2>&1; then
  cid=$(docker ps --format '{{.ID}} {{.Names}}' | awk '/bypilar|wordpress/ {print $1; exit}')
  if [[ -n "${cid:-}" ]]; then
    if docker exec "$cid" test -d /var/www/html/wp-content/themes/pilar-theme; then
      echo "docker://${cid}:/var/www/html/wp-content/themes/pilar-theme"
      exit 0
    fi
  fi
fi
for p in \
  /opt/PraxisOS/wordpress/themes/pilar-theme \
  /var/www/html/wp-content/themes/pilar-theme
do
  [[ -d "$p" ]] && { echo "$p"; exit 0; }
done
echo "NOT_FOUND"
REMOTE
)"

echo "=> Target: $REMOTE_THEME"
if [[ "$REMOTE_THEME" == NOT_FOUND ]]; then
  echo "Could not find pilar-theme on host" >&2
  exit 2
fi

deploy_mu() {
  local dest_dir="$1"
  local via_docker_cid="${2:-}"
  if [[ -n "$via_docker_cid" ]]; then
    "${SSH[@]}" "docker exec $via_docker_cid mkdir -p $dest_dir"
    cat "$MU_BRIDGE" | "${SSH[@]}" "docker exec -i $via_docker_cid tee $dest_dir/praxisos-bridge.php >/dev/null"
    cat "$MU_REWRITE" | "${SSH[@]}" "docker exec -i $via_docker_cid tee $dest_dir/bypilar-planway-content-rewrite.php >/dev/null"
  else
    "${SSH[@]}" "mkdir -p '$dest_dir'"
    cat "$MU_BRIDGE" | "${SSH[@]}" "tee '$dest_dir/praxisos-bridge.php' >/dev/null"
    cat "$MU_REWRITE" | "${SSH[@]}" "tee '$dest_dir/bypilar-planway-content-rewrite.php' >/dev/null"
  fi
}

if [[ "$REMOTE_THEME" == docker://* ]]; then
  rest="${REMOTE_THEME#docker://}"
  cid="${rest%%:*}"
  path="${rest#*:}"
  mu_dir="$(dirname "$(dirname "$path")")/mu-plugins"
  echo "=> docker cp theme into ${cid}:${path}"
  tar -C "$THEME_SRC" -cf - . | "${SSH[@]}" "docker exec -i $cid tar -C $path -xf -"
  echo "=> docker cp mu-plugins into ${cid}:${mu_dir}"
  deploy_mu "$mu_dir" "$cid"
  echo "=> Verify inside container"
  "${SSH[@]}" "docker exec $cid grep -n 'https://app.bypilar.dk/t/bypilar/book?embed=1' $path/parts/booking.phpfrag"
  "${SSH[@]}" "docker exec $cid test -f $mu_dir/bypilar-planway-content-rewrite.php && echo OK_rewrite_mu"
  "${SSH[@]}" "docker exec $cid grep -c planway.com $path/parts/behandlinger.phpfrag $path/parts/udekoerende.phpfrag || true"
else
  echo "=> tar stream theme to ${REMOTE_THEME}"
  tar -C "$THEME_SRC" -cf - . | "${SSH[@]}" "mkdir -p '$REMOTE_THEME' && tar -C '$REMOTE_THEME' -xf -"
  MU_DIR="$(dirname "$(dirname "$REMOTE_THEME")")/mu-plugins"
  echo "=> deploy mu-plugins to ${MU_DIR}"
  deploy_mu "$MU_DIR"
  "${SSH[@]}" "grep -n 'https://app.bypilar.dk/t/bypilar/book?embed=1' '$REMOTE_THEME/parts/booking.phpfrag'"
fi

echo "=> WP-CLI Planway DB search-replace (best-effort)"
if [[ -x "${ROOT}/scripts/wp-cli-kill-planway.sh" ]]; then
  "${ROOT}/scripts/wp-cli-kill-planway.sh" || echo "WARN: wp-cli kill failed (runtime rewrite still active)"
fi

echo "=> Public smoke (may need cache purge)"
for p in /booking/ /behandlinger/ /udekoerende/; do
  n=$(curl -sL "https://bypilar.dk${p}?nocache=$(date +%s)" | grep -ci planway || true)
  echo "$p planway_count=$n"
done
curl -sL "https://bypilar.dk/booking/?nocache=$(date +%s)" | grep -E 'iframe|planway|app\.bypilar' || true
echo "Done."
