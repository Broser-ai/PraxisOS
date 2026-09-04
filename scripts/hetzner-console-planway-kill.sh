#!/usr/bin/env bash
# One-shot Planway kill on live byPilar WP (Hetzner Console as root).
#
# Broser one-liner (preferred when SSH key is missing from agents):
#   curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/planway-total-kill-live-2c11/scripts/hetzner-console-planway-kill.sh | bash
#
# Optional env:
#   PRAXIS_REPO_DIR=/opt/PraxisOS
#   PRAXIS_BRANCH=cursor/planway-total-kill-live-2c11
#   SKIP_WP_SEARCH_REPLACE=1   # skip wp-cli DB rewrite
#   SKIP_APP_DEPLOY=1          # skip scripts/deploy-hetzner.sh
set -euo pipefail

REPO_DIR="${PRAXIS_REPO_DIR:-/opt/PraxisOS}"
BRANCH="${PRAXIS_BRANCH:-cursor/planway-total-kill-live-2c11}"
BOOK_URL='https://app.bypilar.dk/t/bypilar/book'
BOOK_EMBED='https://app.bypilar.dk/t/bypilar/book?embed=1'

echo "=> Repo ${REPO_DIR} @ ${BRANCH}"
if [[ ! -d "${REPO_DIR}/.git" ]]; then
  echo "No git checkout at ${REPO_DIR}" >&2
  echo "Clone first: git clone https://github.com/Broser-ai/PraxisOS.git ${REPO_DIR}" >&2
  exit 1
fi

cd "${REPO_DIR}"
git fetch origin "${BRANCH}"
git checkout -B "${BRANCH}" "origin/${BRANCH}"

echo "=> Push theme + mu-plugin into live WordPress"
bash scripts/push-bypilar-theme-live.sh

wp_cli() {
  if command -v wp >/dev/null 2>&1; then
    wp "$@"
    return
  fi
  if command -v docker >/dev/null 2>&1; then
    local cid
    cid=$(docker ps --format '{{.ID}} {{.Names}}' | awk '/bypilar|wordpress/ {print $1; exit}')
    if [[ -n "${cid:-}" ]]; then
      docker exec -i "$cid" wp --allow-root "$@"
      return
    fi
  fi
  return 127
}

if [[ "${SKIP_WP_SEARCH_REPLACE:-0}" != "1" ]]; then
  echo "=> Optional wp-cli search-replace planway.com → PraxisOS book URLs"
  if wp_cli core is-installed >/dev/null 2>&1; then
    # Cover common Planway host variants without deleting the Planway account.
    wp_cli search-replace 'https://bypilar.planway.com' "${BOOK_URL}" --all-tables --precise --recurse-objects --skip-columns=guid || true
    wp_cli search-replace 'http://bypilar.planway.com' "${BOOK_URL}" --all-tables --precise --recurse-objects --skip-columns=guid || true
    wp_cli search-replace 'https://www.planway.com' "${BOOK_URL}" --all-tables --precise --recurse-objects --skip-columns=guid || true
    wp_cli search-replace 'http://www.planway.com' "${BOOK_URL}" --all-tables --precise --recurse-objects --skip-columns=guid || true
    wp_cli search-replace 'planway.com' 'app.bypilar.dk/t/bypilar/book' --all-tables --precise --recurse-objects --skip-columns=guid || true
    wp_cli search-replace 'http://app.bypilar.dk' 'https://app.bypilar.dk' --all-tables --precise --recurse-objects --skip-columns=guid || true
    wp_cli cache flush || true
  else
    echo "WARN: wp-cli not available — theme runtime rewrites still strip Planway on render"
  fi
fi

if [[ "${SKIP_APP_DEPLOY:-0}" != "1" ]]; then
  echo "=> Redeploy app so /embed/v1/bypilar ships publicBookingOrigin (optional but recommended)"
  if [[ -x scripts/deploy-hetzner.sh ]]; then
    bash scripts/deploy-hetzner.sh || true
  fi
fi

echo "=> Smoke verify (must be zero planway + HTTPS embed)"
fail=0
for path in /booking/ /behandlinger/ /udekoerende/; do
  html=$(curl -fsSL "https://bypilar.dk${path}?nocache=$(date +%s)" || true)
  if printf '%s' "$html" | grep -qi 'planway'; then
    echo "FAIL ${path} still contains planway"
    fail=1
  else
    echo "OK ${path} no planway"
  fi
done

booking=$(curl -fsSL "https://bypilar.dk/booking/?nocache=$(date +%s)" || true)
if printf '%s' "$booking" | grep -Fq "${BOOK_EMBED}"; then
  echo "OK https embed"
else
  echo "FAIL missing ${BOOK_EMBED}"
  fail=1
fi
if printf '%s' "$booking" | grep -qi 'data-praxis-book'; then
  echo "OK data-praxis-book"
else
  echo "WARN data-praxis-book missing on /booking/"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "Planway kill incomplete — check LiteSpeed/WP cache purge, then re-run." >&2
  exit 1
fi

echo "Done. Planway gone; PraxisOS booking live on byPilar."
