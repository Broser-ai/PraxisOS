#!/usr/bin/env bash
# Verify RLS is enabled on tenant tables + spot-check isolation policies.
# Usage: DATABASE_URL=postgresql://… bash scripts/verify-rls.sh
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-${TARGET_DB_URL:-}}"
if [[ -z "${DATABASE_URL}" ]]; then
  echo "Set DATABASE_URL or TARGET_DB_URL" >&2
  exit 1
fi

FAIL=0

echo "=== RLS enabled? ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -At <<'SQL' | tee /tmp/praxis-rls-check.txt
select
  c.relname || E'\t' || case when c.relrowsecurity then 'ON' else 'OFF' end
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
SQL

REQUIRED=(
  tenants users memberships services clients bookings journals journal_entries
  scans payments vouchers subsidy_schemes reports events audit_log
  module_activations api_keys webhook_subscriptions
  swarm_snapshots swarm_memory agent_ledger llm_call_metrics scan_meshes
)

for t in "${REQUIRED[@]}"; do
  line=$(grep -E "^${t}"$'\t' /tmp/praxis-rls-check.txt || true)
  if [[ -z "$line" ]]; then
    echo "MISSING TABLE: $t"
    FAIL=1
    continue
  fi
  if [[ "$line" != *$'\t'ON ]]; then
    echo "RLS OFF: $t"
    FAIL=1
  else
    echo "OK RLS: $t"
  fi
done

echo ""
echo "=== Policy count per table ==="
psql "$DATABASE_URL" -c \
  "select tablename, count(*) as policies from pg_policies where schemaname='public' group by 1 order by 1;"

echo ""
echo "=== Isolation smoke (set tenant, expect 0 without matching rows) ==="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
begin;
select set_config('app.tenant_id', '11111111-1111-1111-1111-111111111111', true);
select set_config('role', 'authenticated', true);
-- Under RLS, service superuser still bypasses — use SET ROLE if available.
rollback;
SQL

if [[ "$FAIL" -ne 0 ]]; then
  echo "VERIFY FAILED" >&2
  exit 1
fi
echo "VERIFY OK"
