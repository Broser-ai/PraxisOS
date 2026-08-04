#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"
echo "=> Omnichannel Swarm complete init"
make -C "${ROOT}" init
echo ""
echo "Next:"
echo "  1) Edit .env, erxes/.env, fonoster/.env (HOST_PUBLIC_IP!), dittofeed/.env"
echo "  2) Point DNS for crm/voice/engage + traefik hosts to this node"
echo "  3) make deploy-all && make doctor"
