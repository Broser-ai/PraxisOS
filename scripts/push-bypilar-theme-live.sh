#!/usr/bin/env bash
# Push pilar-theme + mu-plugin to live Hetzner WordPress (bypilar.dk).
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
MU_SRC="${ROOT}/wordpress/mu-plugins/praxisos-bridge.php"

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

if [[ "$REMOTE_THEME" == docker://* ]]; then
  rest="${REMOTE_THEME#docker://}"
  cid="${rest%%:*}"
  path="${rest#*:}"
  mu_dir="$(dirname "$(dirname "$path")")/mu-plugins"
  echo "=> docker cp theme into ${cid}:${path}"
  tar -C "$THEME_SRC" -cf - . | "${SSH[@]}" "docker exec -i $cid tar -C $path -xf -"
  "${SSH[@]}" "docker exec $cid mkdir -p $mu_dir"
  cat "$MU_SRC" | "${SSH[@]}" "docker exec -i $cid tee $mu_dir/praxisos-bridge.php >/dev/null"
  echo "=> Verify inside container"
  "${SSH[@]}" "docker exec $cid grep -n 'https://app.bypilar.dk/t/bypilar/book?embed=1' $path/parts/booking.phpfrag"
  "${SSH[@]}" "docker exec $cid grep -c planway $path/parts/behandlinger.phpfrag $path/parts/udekoerende.phpfrag || true"
else
  echo "=> tar stream theme to ${REMOTE_THEME}"
  tar -C "$THEME_SRC" -cf - . | "${SSH[@]}" "mkdir -p '$REMOTE_THEME' && tar -C '$REMOTE_THEME' -xf -"
  MU_DIR="$(dirname "$(dirname "$REMOTE_THEME")")/mu-plugins"
  "${SSH[@]}" "mkdir -p '$MU_DIR'"
  cat "$MU_SRC" | "${SSH[@]}" "tee '$MU_DIR/praxisos-bridge.php' >/dev/null"
  "${SSH[@]}" "grep -n 'https://app.bypilar.dk/t/bypilar/book?embed=1' '$REMOTE_THEME/parts/booking.phpfrag'"
fi

echo "=> Public smoke (may need cache purge)"
curl -sL "https://bypilar.dk/booking/?nocache=$(date +%s)" | grep -E 'iframe|planway|app\.bypilar' || true
echo "Done."
