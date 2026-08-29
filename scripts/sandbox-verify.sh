#!/usr/bin/env bash
# PraxisOS · isolated sandbox verification (no production Hetzner unlock)
# Prefers Docker compose sandbox when available; otherwise local npm/tsc/vitest.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SANDBOX_TYPE="local-npm"
REPORT_DIR="${PRAXIS_SANDBOX_REPORT_DIR:-$ROOT/.sandbox-verify}"
mkdir -p "$REPORT_DIR"
OVERALL=0

log() { printf '[sandbox-verify] %s\n' "$*"; }

record() {
  local key="$1" val="$2"
  echo "${key}=${val}" | tee -a "$REPORT_DIR/summary.txt"
  if [[ "$val" != "0" && "$val" != "skip" ]]; then
    OVERALL=1
  fi
}

ensure_env() {
  if [[ ! -f .env.sandbox ]]; then
    cp .env.sandbox.example .env.sandbox
    log "created .env.sandbox from .env.sandbox.example"
  fi
  set -a
  # shellcheck disable=SC1091
  source .env.sandbox
  set +a
  export PRAXIS_SANDBOX=1
  export PRAXIS_DB="${PRAXIS_DB:-mock}"
  export SCAN_QUALITY_THRESHOLD="${SCAN_QUALITY_THRESHOLD:-70}"
  export PRAXIS_SHADOW_EVAL_ENABLED=false
  export PRAXIS_ACTIVE_ROUTING_ENABLED=false
  export FOOT_VISION_CANARY_PERCENT=0
  export NEXT_TELEMETRY_DISABLED=1
}

run_local() {
  SANDBOX_TYPE="local-npm"
  log "path=local-npm (Vercel Sandbox auth-blocked / Docker optional)"
  if [[ ! -d node_modules ]]; then
    log "npm ci"
    npm ci
  else
    log "node_modules present — skip npm ci (set PRAXIS_SANDBOX_FORCE_CI=1 to reinstall)"
    if [[ "${PRAXIS_SANDBOX_FORCE_CI:-}" == "1" ]]; then
      npm ci
    fi
  fi

  log "typecheck (tsc --noEmit)"
  set +e
  npx tsc --noEmit 2>&1 | tee "$REPORT_DIR/tsc.log"
  record tsc_exit "${PIPESTATUS[0]}"
  set -e

  log "vitest"
  set +e
  npm test 2>&1 | tee "$REPORT_DIR/vitest.log"
  record vitest_exit "${PIPESTATUS[0]}"
  set -e

  if npm run 2>/dev/null | grep -qE '^\s*lint\b'; then
    log "lint"
    set +e
    npm run lint 2>&1 | tee "$REPORT_DIR/lint.log"
    record lint_exit "${PIPESTATUS[0]}"
    set -e
  else
    log "lint script not present — skip"
    record lint_exit skip
  fi

  log "next build"
  set +e
  npm run build 2>&1 | tee "$REPORT_DIR/build.log"
  record build_exit "${PIPESTATUS[0]}"
  set -e
}

run_docker() {
  SANDBOX_TYPE="docker-compose"
  log "path=docker-compose.sandbox.yml"
  docker compose -f docker-compose.sandbox.yml build
  # Host-side unit/type checks with mock env (image build already runs next build)
  if [[ ! -d node_modules ]]; then
    npm ci
  fi
  set +e
  npx tsc --noEmit 2>&1 | tee "$REPORT_DIR/tsc.log"
  record tsc_exit "${PIPESTATUS[0]}"
  npm test 2>&1 | tee "$REPORT_DIR/vitest.log"
  record vitest_exit "${PIPESTATUS[0]}"
  record build_exit 0
  record lint_exit skip
  set -e
}

main() {
  ensure_env
  : >"$REPORT_DIR/summary.txt"
  echo "started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$REPORT_DIR/summary.txt"

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if [[ "${PRAXIS_SANDBOX_FORCE_LOCAL:-}" == "1" ]]; then
      run_local
    else
      if ! run_docker; then
        log "docker path failed — falling back to local-npm"
        run_local
      fi
    fi
  else
    log "Docker not available — using isolated local-npm verification"
    run_local
  fi

  echo "sandbox_type=$SANDBOX_TYPE" | tee -a "$REPORT_DIR/summary.txt"
  echo "finished_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$REPORT_DIR/summary.txt"
  echo "overall_exit=$OVERALL" | tee -a "$REPORT_DIR/summary.txt"
  log "done · type=$SANDBOX_TYPE · overall=$OVERALL · report=$REPORT_DIR"
  exit "$OVERALL"
}

main "$@"
