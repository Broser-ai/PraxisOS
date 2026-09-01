#!/usr/bin/env bash
# =============================================================================
# PraxisOS · ONE Console paste · authorize SSH + self-host Postgres + restore
# =============================================================================
# Run as root on Hetzner Cloud Console for 167.233.171.184:
#
#   curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/cursor/supabase-selfhost-migrate-2c11/scripts/console-selfhost-db-cutover.sh | bash
#
# After merge to main you can also use:
#   curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/console-selfhost-db-cutover.sh | bash
#
# SAFE: does NOT destroy the server, wipe /data/secrets.json, touch DNS/Traefik,
# Replicate, Roboflow, GitHub, OpenAI, Bird, or delete Supabase cloud.
# Keeps production PRAXIS_DB=mock (cloud unused) unless PRAXIS_FLIP_SELFHOST=1.
# =============================================================================
set -euo pipefail

BRANCH="${PRAXIS_BRANCH:-cursor/supabase-selfhost-migrate-2c11}"
REPO_URL="${PRAXIS_REPO:-https://github.com/Broser-ai/PraxisOS.git}"
APP_DIR="${PRAXIS_DIR:-/opt/PraxisOS}"
CURSOR_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIE2kmCfC063RCzB5XpWEKajmKYoj8DkrEQWcQkrz5CSc cursor-praxisos-cutover-2026-09-01'
LEGACY_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAQ64x2uTpPE3JD8kXpo7T+XMKOpn+CzY3C/5aIvV6c5 cursor-hetzner-praxisos'
RAW_BASE="https://raw.githubusercontent.com/Broser-ai/PraxisOS/${BRANCH}"

echo ""
echo "=========================================="
echo "  PraxisOS · Console DB self-host cutover"
echo "=========================================="
echo ""

if [[ "${EUID}" -ne 0 ]]; then
  echo "Kør som root (Hetzner Console)."
  exit 1
fi

# --- 1) Authorize agent SSH keys (unblocks next agent) ---
mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
for KEY in "${CURSOR_PUBKEY}" "${LEGACY_PUBKEY}"; do
  COMMENT="$(awk '{print $NF}' <<<"${KEY}")"
  if ! grep -qF "${COMMENT}" /root/.ssh/authorized_keys; then
    echo "${KEY}" >> /root/.ssh/authorized_keys
    echo "=> SSH key added: ${COMMENT}"
  else
    echo "=> SSH key already present: ${COMMENT}"
  fi
done

# --- 2) Docker + network ---
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker || true
fi
docker network create omni_net 2>/dev/null || true

# --- 3) Repo checkout (preserve .env.production) ---
if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone -b "${BRANCH}" "${REPO_URL}" "${APP_DIR}" || \
    git clone "${REPO_URL}" "${APP_DIR}"
fi
cd "${APP_DIR}"

ENV_BAK=""
if [[ -f .env.production ]]; then
  ENV_BAK="/tmp/praxisos.env.production.bak-$(date -u +%Y%m%dT%H%M%SZ)"
  cp -a .env.production "${ENV_BAK}"
  echo "=> .env.production backed up to ${ENV_BAK}"
fi

git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git fetch origin "${BRANCH}" || git fetch origin
git checkout -B "${BRANCH}" "origin/${BRANCH}" 2>/dev/null || \
  git checkout -B "${BRANCH}" FETCH_HEAD || true
git reset --hard "origin/${BRANCH}" 2>/dev/null || git pull --ff-only || true
echo "=> Deployed SHA: $(git rev-parse HEAD)"

if [[ -n "${ENV_BAK}" && -f "${ENV_BAK}" ]]; then
  cp -a "${ENV_BAK}" .env.production
fi

# Ensure production env exists with safe defaults
if [[ ! -f .env.production ]]; then
  cp .env.production.example .env.production 2>/dev/null || cp .env.example .env.production
fi

# Postgres password for compose (generate once, keep if set)
if ! grep -q '^POSTGRES_PASSWORD=' .env.production 2>/dev/null; then
  PW="$(openssl rand -hex 24)"
  {
    echo ""
    echo "# Self-host Postgres (added by console-selfhost-db-cutover.sh)"
    echo "POSTGRES_USER=praxis"
    echo "POSTGRES_DB=praxisos"
    echo "POSTGRES_PASSWORD=${PW}"
    echo "POSTGRES_HOST_BIND=127.0.0.1"
    echo "POSTGRES_HOST_PORT=5432"
  } >> .env.production
  echo "=> Generated POSTGRES_PASSWORD in .env.production"
else
  echo "=> Reusing existing POSTGRES_PASSWORD"
fi

# Keep mock until Kong/PostgREST ready — cloud unused
if grep -q '^PRAXIS_DB=' .env.production; then
  if [[ "${PRAXIS_FLIP_SELFHOST:-0}" == "1" ]]; then
    sed -i 's/^PRAXIS_DB=.*/PRAXIS_DB=supabase-selfhost/' .env.production
    echo "=> PRAXIS_FLIP_SELFHOST=1 — set PRAXIS_DB=supabase-selfhost (requires Kong URL/keys)"
  else
    sed -i 's/^PRAXIS_DB=.*/PRAXIS_DB=mock/' .env.production
    echo "=> PRAXIS_DB=mock (intentional · cloud unused · self-host DB warm)"
  fi
else
  echo 'PRAXIS_DB=mock' >> .env.production
fi

# Clinical safety
if grep -q '^SCAN_QUALITY_THRESHOLD=' .env.production; then
  sed -i 's/^SCAN_QUALITY_THRESHOLD=.*/SCAN_QUALITY_THRESHOLD=70/' .env.production
else
  echo 'SCAN_QUALITY_THRESHOLD=70' >> .env.production
fi

# --- 4) Start Postgres (named volume praxis_pgdata) ---
echo "=> Starting docker-compose.db.yml (praxis-db)…"
docker compose -f docker-compose.db.yml --env-file .env.production up -d praxis-db

echo "=> Waiting for Postgres healthy…"
for i in $(seq 1 60); do
  if docker exec praxisos_db pg_isready -U praxis -d praxisos >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec praxisos_db pg_isready -U praxis -d praxisos

# --- 5) Schema is applied by docker-entrypoint-initdb.d on first volume.
#     Seed 0002 uses different UUIDs than cloud — wipe public data before restore.
echo "=> Waiting for init migrations (first boot)…"
sleep 5
for i in $(seq 1 90); do
  if docker exec praxisos_db psql -U praxis -d praxisos -tAc "SELECT to_regclass('public.tenants')" | grep -q tenants; then
    break
  fi
  sleep 2
done

echo "=> Truncating public tables (replace seed UUIDs with cloud dump)…"
docker exec praxisos_db psql -U praxis -d praxisos -v ON_ERROR_STOP=1 <<'SQL'
SET row_security = off;
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', r.tablename);
  END LOOP;
END $$;
SQL

# Ensure parity tables exist even if init skipped a file
for f in \
  supabase/migrations/0003_remote_parity_rls.sql \
  supabase/migrations/0004_swarm_snapshots_and_memory.sql \
  supabase/migrations/0005_agent_ledger.sql
do
  echo "  -> ensure $(basename "$f")"
  docker exec -i praxisos_db psql -U praxis -d praxisos -v ON_ERROR_STOP=0 < "$f" || true
done
docker exec -i praxisos_db psql -U praxis -d praxisos -v ON_ERROR_STOP=0 <<'SQL' || true
create table if not exists scan_meshes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  scan_id uuid references scans(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  storage_path text not null,
  public_url text,
  provider text not null default 'local-volume',
  content_type text default 'model/gltf-binary',
  bytes bigint,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table scan_meshes enable row level security;
SQL

# --- 6) Restore cloud logical dump (fixture in repo) ---
RESTORE_SQL="scripts/fixtures/supabase-cloud-data-restore.sql"
if [[ ! -f "${RESTORE_SQL}" ]]; then
  echo "=> Fetching restore SQL from ${RAW_BASE}/scripts/fixtures/…"
  mkdir -p scripts/fixtures
  curl -fsSL "${RAW_BASE}/scripts/fixtures/supabase-cloud-data-restore.sql" \
    -o "${RESTORE_SQL}"
fi

echo "=> Restoring cloud data (row_security off)…"
{
  echo "SET row_security = off;"
  echo "SET session_replication_role = replica;"
  cat "${RESTORE_SQL}"
} | docker exec -i praxisos_db psql -U praxis -d praxisos -v ON_ERROR_STOP=1

# --- 7) Verify counts ---
echo "=> Verify row counts (expect tenants=2 services=9 module_activations=18)…"
docker exec praxisos_db psql -U praxis -d praxisos -c \
  "SET row_security=off; SELECT 'tenants' t, COUNT(*)::int c FROM tenants UNION ALL SELECT 'services', COUNT(*)::int FROM services UNION ALL SELECT 'module_activations', COUNT(*)::int FROM module_activations ORDER BY 1;"

# --- 8) Keep app up (mock) — do not attach cloud ---
echo "=> Ensuring app compose is up (PRAXIS_DB=mock · cloud unused)…"
docker compose -f docker-compose.praxis.yml --env-file .env.production up -d --build || true
sleep 3
curl -sS http://127.0.0.1:3010/api/health || true
echo ""

cat <<'EOF'

==========================================
  DONE · self-host Postgres warm
==========================================
Next for Cursor agent (DELETE gate):
  1) SSH root@167.233.171.184 should now work with cutover key
  2) Confirm: docker ps | grep praxisos_db
  3) Confirm counts 2/9/18
  4) Keep PRAXIS_DB=mock (cloud unused) OR flip supabase-selfhost after Kong
  5) Re-run docs/ops/supabase-delete-gate.md → DELETE_READY yes
  6) Pause/delete ONLY Supabase project jajdtvduzkitjzcazcng

NEVER: hcloud server delete, secrets wipe, DNS/Traefik/Bird/vision pin changes.
EOF
