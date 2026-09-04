#!/usr/bin/env bash
# One-shot: pull Planway content-rewrite branch on Hetzner and push theme into live WP.
# Run on the Hetzner host (Console) as root:
#   curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/planway-content-rewrite-2c11/scripts/hetzner-console-planway-kill.sh | bash
set -euo pipefail

REPO_DIR="${PRAXIS_REPO_DIR:-/opt/PraxisOS}"
BRANCH="${PRAXIS_BRANCH:-cursor/planway-content-rewrite-2c11}"

echo "=> Repo ${REPO_DIR} @ ${BRANCH}"
if [[ ! -d "${REPO_DIR}/.git" ]]; then
  echo "No git checkout at ${REPO_DIR}" >&2
  exit 1
fi

cd "${REPO_DIR}"
git fetch origin "${BRANCH}"
git checkout -B "${BRANCH}" "origin/${BRANCH}"

bash scripts/push-bypilar-theme-live.sh
bash scripts/wp-cli-kill-planway.sh || true

echo "=> Redeploy app so /embed/v1/bypilar ships publicBookingOrigin (optional but recommended)"
if [[ -x scripts/deploy-hetzner.sh ]]; then
  bash scripts/deploy-hetzner.sh || true
fi

echo "=> Smoke"
for p in /booking/ /behandlinger/ /udekoerende/; do
  n=$(curl -sL "https://bypilar.dk${p}?nocache=$(date +%s)" | grep -ci planway || true)
  echo "$p planway_count=$n"
  [[ "$n" == "0" ]] || { echo "FAIL $p still has planway"; exit 1; }
done
curl -sL 'https://bypilar.dk/booking/' | grep -Fq 'https://app.bypilar.dk/t/bypilar/book?embed=1' && echo 'OK https embed' || echo 'WARN https embed missing'
echo Done.
