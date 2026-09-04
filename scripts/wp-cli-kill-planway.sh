#!/usr/bin/env bash
# WP-CLI friendly Planway → PraxisOS search-replace for live byPilar WordPress.
# Usage:
#   ./scripts/wp-cli-kill-planway.sh              # auto-detect docker WP on Hetzner via SSH
#   ./scripts/wp-cli-kill-planway.sh --local       # run wp in current shell / local container
#   WP_CONTAINER=bypilar_wp ./scripts/wp-cli-kill-planway.sh --local
#
# Requires: HETZNER_PRAXIS_SSH_PRIVATE_KEY or ~/.ssh/hetzner_praxis (remote mode)
#           wp-cli inside the WordPress container
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${PRAXIS_HOST:-167.233.171.184}"
USER="${PRAXIS_SSH_USER:-root}"
KEY_FILE="${HETZNER_SSH_KEY_FILE:-$HOME/.ssh/hetzner_praxis}"
MODE="${1:-remote}"
BOOK="https://app.bypilar.dk/t/bypilar/book"
BOOK_EMBED="https://app.bypilar.dk/t/bypilar/book?embed=1"

run_wp_replaces() {
  # Expects WP CLI available as: wp ...  (caller sets PATH / docker exec wrapper)
  local dry=()
  if [[ "${WP_CLI_DRY_RUN:-}" == "1" ]]; then
    dry=(--dry-run)
  fi

  echo "=> WP search-replace Planway → PraxisOS book"
  # Absolute Planway hosts (common variants)
  for from in \
    'https://bypilar.planway.com' \
    'http://bypilar.planway.com' \
    'https://www.planway.com' \
    'http://www.planway.com' \
    'https://planway.com' \
    'http://planway.com'
  do
    wp search-replace "$from" "$BOOK" --all-tables --precise --recurse-objects --skip-columns=guid "${dry[@]}" --allow-root 2>/dev/null \
      || wp search-replace "$from" "$BOOK" --all-tables --precise --recurse-objects "${dry[@]}" --allow-root || true
  done

  # Any leftover path-bearing Planway URLs that start with these prefixes
  for from in \
    'https://bypilar.planway.com/' \
    'http://bypilar.planway.com/' \
    'https://www.planway.com/' \
    'http://www.planway.com/'
  do
    wp search-replace "$from" "${BOOK}/" --all-tables --precise --recurse-objects --skip-columns=guid "${dry[@]}" --allow-root 2>/dev/null || true
  done

  echo "=> Force HTTPS on app.bypilar.dk"
  wp search-replace 'http://app.bypilar.dk' 'https://app.bypilar.dk' --all-tables --precise --recurse-objects --skip-columns=guid "${dry[@]}" --allow-root 2>/dev/null \
    || wp search-replace 'http://app.bypilar.dk' 'https://app.bypilar.dk' --all-tables --precise --recurse-objects "${dry[@]}" --allow-root || true

  echo "=> Prefer embed URL inside iframe-ish post content (best-effort)"
  # If content still has book without embed inside an iframe attribute, leave to runtime filter.
  # Normalize accidental double slashes on book path
  wp search-replace 'https://app.bypilar.dk/t/bypilar/book//' "$BOOK/" --all-tables --precise "${dry[@]}" --allow-root 2>/dev/null || true

  if command -v wp >/dev/null 2>&1; then
    wp cache flush --allow-root 2>/dev/null || true
    wp rewrite flush --allow-root 2>/dev/null || true
  fi

  echo "=> Canonical book (ref): $BOOK"
  echo "=> Canonical embed (ref): $BOOK_EMBED"
  echo "OK: wp-cli Planway kill finished"
}

if [[ "$MODE" == "--local" || "$MODE" == "local" ]]; then
  if [[ -n "${WP_CONTAINER:-}" ]]; then
    echo "=> Local docker exec ${WP_CONTAINER}"
    docker exec -i "$WP_CONTAINER" bash -lc "$(declare -f run_wp_replaces); run_wp_replaces"
  else
    run_wp_replaces
  fi
  exit 0
fi

# Remote (Hetzner) mode
if [[ -n "${HETZNER_PRAXIS_SSH_PRIVATE_KEY:-}" ]]; then
  mkdir -p "$(dirname "$KEY_FILE")"
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
  echo "Tip: run with --local inside the WP container, or deploy MU-plugin for runtime rewrite." >&2
  exit 1
fi

SSH=(ssh -i "$KEY_FILE" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "${USER}@${HOST}")

echo "=> Running wp-cli Planway kill on ${HOST}..."
"${SSH[@]}" 'bash -s' <<'REMOTE'
set -euo pipefail
BOOK="https://app.bypilar.dk/t/bypilar/book"
cid=""
for c in bypilar_wp bypilar-wordpress wordpress wp; do
  if docker ps --format '{{.Names}}' | grep -qx "$c"; then cid="$c"; break; fi
done
if [[ -z "$cid" ]]; then
  cid=$(docker ps --format '{{.ID}} {{.Names}}' | awk '/bypilar|wordpress/ {print $1; exit}')
fi
if [[ -z "${cid:-}" ]]; then
  echo "No WordPress container found — skip DB replace (runtime MU-plugin still covers HTML)." >&2
  exit 0
fi
echo "=> container: $cid"
docker exec "$cid" bash -lc '
  set -e
  if ! command -v wp >/dev/null 2>&1; then
    echo "wp-cli missing in container — skip DB replace"
    exit 0
  fi
  BOOK="https://app.bypilar.dk/t/bypilar/book"
  for from in \
    https://bypilar.planway.com \
    http://bypilar.planway.com \
    https://www.planway.com \
    http://www.planway.com \
    https://planway.com \
    http://planway.com
  do
    wp search-replace "$from" "'"$BOOK"'" --all-tables --precise --recurse-objects --skip-columns=guid --allow-root || true
  done
  wp search-replace "http://app.bypilar.dk" "https://app.bypilar.dk" --all-tables --precise --recurse-objects --skip-columns=guid --allow-root || true
  wp cache flush --allow-root 2>/dev/null || true
  echo "OK wp-cli replaces done"
'
REMOTE

echo "=> Public verify"
for p in /booking/ /behandlinger/ /udekoerende/; do
  n=$(curl -sL "https://bypilar.dk${p}?nocache=$(date +%s)" | grep -ci planway || true)
  echo "$p planway_count=$n"
done
echo "Done."
