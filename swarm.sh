#!/usr/bin/env bash
# PraxisOS · DelPilar Nexus swarm boot
# Starter ARIA orchestrator-status + Next.js (eller agent-worker) parallelt.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT}"

PORT="${PORT:-${PRAXIS_HOST_PORT:-3000}}"
export PORT
export HOSTNAME="${HOSTNAME:-0.0.0.0}"

echo ""
echo "=========================================="
echo "  PraxisOS · DelPilar Nexus swarm"
echo "=========================================="
echo ""

if [[ ! -d node_modules ]]; then
  echo "=> npm install..."
  npm install
fi

# Quick ARIA boot (Node resolves TS via next/tsx if available, else compiled path)
boot_aria() {
  if command -v npx >/dev/null 2>&1; then
    if npx --yes tsx -e "import { ariaOrchestrator } from './agents/ARIA-orchestrator.ts'; const b=await ariaOrchestrator.boot(); console.log(JSON.stringify(b));" 2>/dev/null; then
      return 0
    fi
  fi
  # Fallback: hit status endpoint once server is up
  echo "ARIA CLI boot skipped (tsx unavailable) — uses /api/v1/scan/process when app is live"
}

PIDS=()
cleanup() {
  echo ""
  echo "=> Stopper swarm..."
  for pid in "${PIDS[@]:-}"; do
    kill "${pid}" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

echo "=> Booter ARIA..."
boot_aria || true

if [[ "${1:-}" == "worker" ]]; then
  echo "=> Starter agent-worker..."
  npm run agent:worker &
  PIDS+=($!)
fi

echo "=> Starter Next.js på ${HOSTNAME}:${PORT}..."
if [[ -f .next/BUILD_ID ]]; then
  npm run start -- -H "${HOSTNAME}" -p "${PORT}" &
else
  npm run dev -- -H "${HOSTNAME}" -p "${PORT}" &
fi
PIDS+=($!)

# Wait for health, then warm ARIA via API
for i in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${PORT}/api/v1/scan/process" >/dev/null 2>&1; then
    echo "=> Swarm live · http://${HOSTNAME}:${PORT}"
    echo "   Scan API: POST /api/v1/scan/process"
    echo "   Journal:  /journal · Bird: /admin/bird · Agents: /admin/agents/automation"
    wait
    exit 0
  fi
  sleep 0.5
done

echo "App startede, men health-check timed out — processerne kører stadig."
wait
