#!/usr/bin/env bash
# Bootstrap omni_net + Traefik ACME storage for Omnichannel Swarm.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

echo "=> Omnichannel Swarm init (${ROOT})"
docker network create omni_net 2>/dev/null || echo "   omni_net already exists"

mkdir -p traefik/letsencrypt
touch traefik/letsencrypt/acme.json
chmod 600 traefik/letsencrypt/acme.json

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "=> Wrote .env from .env.example — set ACME_EMAIL and TRAEFIK_BASIC_AUTH"
fi

if [[ ! -f erxes/.env && -f erxes/.env.example ]]; then
  cp erxes/.env.example erxes/.env
  echo "=> Wrote erxes/.env from example — rotate DB passwords before prod"
fi

echo "=> Done. Next:"
echo "   make start-gateway"
echo "   make deploy-erxes"
echo "   Point DNS A/AAAA for *.praxios.dk / *.cirkel.dk / *.dpnnails.dk to this host"
