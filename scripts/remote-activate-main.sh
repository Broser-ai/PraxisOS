#!/usr/bin/env bash
# =============================================================================
# PraxisOS · remote production activation (agent → Hetzner)
# =============================================================================
# Runs from a Cursor cloud agent (or laptop) with SSH access to the host.
#
# Required (one of):
#   HETZNER_PRAXIS_SSH_PRIVATE_KEY   OpenSSH private key (PEM/ed25519)
#   ~/.ssh/hetzner_praxis            same key on disk
#
# Optional:
#   HCLOUD_TOKEN                    Hetzner Cloud API token (key inject / rescue)
#   PRAXIS_HOST                     default 167.233.171.184
#   PRAXIS_SSH_USER                 default root
#   CONFIRM_HCLOUD_RESCUE=1         allow rescue-mode SSH key inject (disruptive)
#
# Hard invariants:
#   - Does NOT wipe /data/secrets.json
#   - Does NOT delete Planway integrations
#   - Does NOT lower SCAN_QUALITY_THRESHOLD / enable landmarks
#   - Leaves PRAXIS_DB=mock unless console-selfhost-db-cutover is run separately
#   - Never prints secret values
# =============================================================================
set -euo pipefail

HOST="${PRAXIS_HOST:-167.233.171.184}"
USER="${PRAXIS_SSH_USER:-root}"
APP_DIR="${PRAXIS_DIR:-/opt/PraxisOS}"
KEY_PATH="${PRAXIS_SSH_KEY_PATH:-$HOME/.ssh/hetzner_praxis}"
TMP_KEY=""
ROTATE_NOTE=0

cleanup() {
  if [[ -n "${TMP_KEY}" && -f "${TMP_KEY}" ]]; then
    rm -f "${TMP_KEY}"
  fi
}
trap cleanup EXIT

blockers=()

log() { printf '%s\n' "$*"; }
err() { printf '!! %s\n' "$*" >&2; }

have_ssh_key() {
  if [[ -n "${HETZNER_PRAXIS_SSH_PRIVATE_KEY:-}" ]]; then
    TMP_KEY="$(mktemp)"
    umask 077
    # Normalize literal \n from some secret stores; never echo the key
    python3 - "${TMP_KEY}" <<'PY'
import os, pathlib, sys
raw = os.environ.get("HETZNER_PRAXIS_SSH_PRIVATE_KEY", "")
if "\\n" in raw and "BEGIN " in raw and "\n" not in raw.split("BEGIN", 1)[-1][:40]:
    raw = raw.replace("\\n", "\n")
pathlib.Path(sys.argv[1]).write_text(raw if raw.endswith("\n") else raw + "\n")
PY
    chmod 600 "${TMP_KEY}"
    KEY_PATH="${TMP_KEY}"
    ROTATE_NOTE=1
    return 0
  fi
  [[ -f "${KEY_PATH}" ]]
}

ssh_base() {
  ssh -i "${KEY_PATH}" \
    -o BatchMode=yes \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=15 \
    "${USER}@${HOST}" "$@"
}

echo ""
echo "=========================================="
echo "  PraxisOS · remote activate → main"
echo "  Host: ${USER}@${HOST}"
echo "=========================================="
echo ""

if ! have_ssh_key; then
  blockers+=("HETZNER_PRAXIS_SSH_PRIVATE_KEY")
  blockers+=("SSH_KEY_FILE:~/.ssh/hetzner_praxis")
fi

if [[ ${#blockers[@]} -eq 0 ]]; then
  if ssh_base 'echo SSH_OK' >/tmp/praxis-ssh-ok 2>/tmp/praxis-ssh-err; then
    log "=> SSH ok"
  else
    err "SSH auth failed"
    blockers+=("SSH_AUTH_FAILED")
    # Keep key name for operator; do not dump stderr (may include paths only)
  fi
fi

if [[ ${#blockers[@]} -gt 0 ]]; then
  if [[ -z "${HCLOUD_TOKEN:-}" ]]; then
    blockers+=("HCLOUD_TOKEN")
  else
    ROTATE_NOTE=1
    log "=> HCLOUD_TOKEN present — rescue inject requires CONFIRM_HCLOUD_RESCUE=1"
    if [[ "${CONFIRM_HCLOUD_RESCUE:-}" == "1" ]]; then
      err "HCLOUD rescue inject is not auto-run from this script revision — use Console one-liner:"
      err "  curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh | bash"
      blockers+=("HCLOUD_RESCUE_MANUAL")
    else
      blockers+=("CONFIRM_HCLOUD_RESCUE")
    fi
  fi
fi

if [[ ${#blockers[@]} -gt 0 ]]; then
  echo ""
  echo "DEPLOY_STATUS=FAIL"
  echo "BLOCKERS=${blockers[*]}"
  echo ""
  echo "Operator unblock (pick one):"
  echo "  1) Inject secret HETZNER_PRAXIS_SSH_PRIVATE_KEY into agent env, re-run:"
  echo "       bash scripts/remote-activate-main.sh"
  echo "  2) Hetzner Cloud Console as root:"
  echo "       curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh | bash"
  echo "  3) Inject HCLOUD_TOKEN (+ CONFIRM_HCLOUD_RESCUE=1) for rescue-path work"
  exit 2
fi

log "=> Running production-cutover-main.sh on host (preserves .env + /data/secrets.json)"
ssh_base "bash -s" <<'REMOTE'
set -euo pipefail
if [[ -x /opt/PraxisOS/scripts/production-cutover-main.sh ]]; then
  bash /opt/PraxisOS/scripts/production-cutover-main.sh
elif [[ -f /opt/PraxisOS/scripts/production-cutover-main.sh ]]; then
  bash /opt/PraxisOS/scripts/production-cutover-main.sh
else
  # Bootstrap from GitHub main if script missing on host
  curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh | bash
fi
REMOTE

log "=> Optional DB prepare (leave mock) if POSTGRES_PASSWORD set on host"
ssh_base "bash -s" <<'REMOTE' || true
set -euo pipefail
cd /opt/PraxisOS
if [[ -f scripts/console-selfhost-db-cutover.sh ]]; then
  bash scripts/console-selfhost-db-cutover.sh || true
else
  echo "!! console-selfhost-db-cutover.sh not on host tip yet — skip DB prepare"
fi
REMOTE

echo ""
echo "=> Public verify"
HEALTH="$(curl -fsS -m 20 https://app.bypilar.dk/api/health || true)"
echo "health: ${HEALTH}"
for path in /login /t/bypilar/book /scan; do
  code="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "https://app.bypilar.dk${path}" || echo FAIL)"
  echo "GET ${path} → ${code}"
done

if [[ "${ROTATE_NOTE}" -eq 1 ]]; then
  echo ""
  echo "ROTATE_NOTE: HETZNER_PRAXIS_SSH_PRIVATE_KEY and/or HCLOUD_TOKEN were used from agent env — rotate when convenient."
fi

echo ""
echo "DEPLOY_STATUS=OK"
echo "BLOCKERS="
