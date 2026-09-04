#!/usr/bin/env bash
# One-shot: pull Planway-kill branch on Hetzner and push theme into live WP.
# Run on the Hetzner host (Console) as root:
#   curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/planway-kill-praxisos-only-2c11/scripts/hetzner-console-planway-kill.sh | bash
set -euo pipefail

REPO_DIR="${PRAXIS_REPO_DIR:-/opt/PraxisOS}"
BRANCH="${PRAXIS_BRANCH:-cursor/planway-kill-praxisos-only-2c11}"

echo "=> Repo ${REPO_DIR} @ ${BRANCH}"
if [[ ! -d "${REPO_DIR}/.git" ]]; then
  echo "No git checkout at ${REPO_DIR}" >&2
  exit 1
fi

cd "${REPO_DIR}"
git fetch origin "${BRANCH}"
git checkout -B "${BRANCH}" "origin/${BRANCH}"

bash scripts/push-bypilar-theme-live.sh

echo "=> Redeploy app so /embed/v1/bypilar ships publicBookingOrigin (optional but recommended)"
if [[ -x scripts/deploy-hetzner.sh ]]; then
  bash scripts/deploy-hetzner.sh || true
fi

echo "=> Smoke"
curl -sL 'https://bypilar.dk/booking/' | grep -qi planway && echo 'FAIL planway' && exit 1 || echo 'OK no planway'
curl -sL 'https://bypilar.dk/booking/' | grep -Fq 'https://app.bypilar.dk/t/bypilar/book?embed=1' && echo 'OK https embed' || echo 'WARN https embed missing'
curl -sL 'https://bypilar.dk/udekoerende/' | grep -qi planway && echo 'FAIL udekoerende still planway' && exit 1 || echo 'OK udekoerende'
echo Done.
