# Supabase → Hetzner self-host · PraxisOS

**Ordre:** Michael (Broser) — flyt det der ligger på Supabase over på egen server, og merge manglende functions/data ind i PraxisOS.  
**Agent-branch:** `cursor/supabase-selfhost-migrate-2c11`  
**Target host:** Hetzner `167.233.171.184` (EU) · durable Docker volume `praxis_pgdata`  
**Cloud-projekt (læs-only dump):** `jajdtvduzkitjzcazcng` · region `eu-west-1` · status ACTIVE_HEALTHY  

**Delete authorization (Broser):** OK to delete/pause **only** this Supabase project **after** the gate in [`supabase-delete-gate.md`](./supabase-delete-gate.md) passes. **Never** touch Hetzner / Replicate / Roboflow / GitHub / OpenAI / Bird / DNS / Traefik / `/data/secrets.json`.

**Ikke gjort endnu:** cloud delete (gate FAIL · `DELETE_READY: no`) · commit ikke `service_role` keys · sænk ikke `SCAN_QUALITY_THRESHOLD` · flip ikke vision pins.

---

## 1. Live inventory (Supabase MCP · 2026-09-01)

Captured via Supabase MCP (`list_projects`, `list_tables`, `list_migrations`, `list_edge_functions`, `get_advisors`, `execute_sql`). **No remote writes / deletes.**

### Projects found

| id / ref | name | org | region | status | Postgres | API URL |
|----------|------|-----|--------|--------|----------|---------|
| `jajdtvduzkitjzcazcng` | **PraxisOS** | `iuavjiizsmjobkcmhtmt` | `eu-west-1` | `ACTIVE_HEALTHY` | 17.6.x · ga | `https://jajdtvduzkitjzcazcng.supabase.co` |

Only this one project is accessible on the linked Supabase account.

### Remote applied migrations

| version | name |
|---------|------|
| `20260616074641` | `initial_schema` (includes `tenants.trial`, ASCII modality, `tenants_select`, isolation policies, triggers) |
| `20260616074751` | `enable_rls_core_tables` (RLS on tenants/users/memberships + anon/auth policies) |

### Public tables (all RLS ON · **0 rows each**)

`tenants`, `users`, `memberships`, `services`, `clients`, `bookings`, `journals`, `journal_entries`, `scans`, `payments`, `vouchers`, `subsidy_schemes`, `reports`, `events`, `audit_log`, `module_activations`, `api_keys`, `webhook_subscriptions`

Missing on remote (but used / planned in app): `swarm_snapshots`, `swarm_memory`, `agent_ledger`, `llm_call_metrics`, `scan_meshes`.

### Edge functions / storage / extensions / schemas

| Area | Live finding |
|------|----------------|
| Edge Functions | **none** |
| Storage buckets | **none** (`storage.buckets` empty) |
| Extensions | `vector` 0.8.0 (**public**), `uuid-ossp`+`pgcrypto` (**extensions**), `pg_stat_statements`, `supabase_vault`, `plpgsql` |
| App-relevant schemas | `public` (+ cloud system: `auth`, `storage`, `realtime`, `extensions`, `vault`, `graphql*`, `supabase_migrations`) |
| Triggers | `tenants/clients/bookings_updated_at` → `set_updated_at`; `audit_log_hash` → `audit_hash_chain` |
| `journal_entries.embedding` | `vector(1536)` + ivfflat cosine index |
| Security advisors | WARN `audit_hash_chain` mutable search_path; WARN `vector` in public |
| Performance advisors | mostly unused-index / auth RLS suggestions (empty DB) — no action for cutover |

### Kodebrug af Supabase

| Flade | Hvor | Noter |
|-------|------|--------|
| Client / mode | `lib/supabase.ts` | `PRAXIS_DB`: `mock` (default) · `supabase-local` · `supabase-eu` · **`supabase-selfhost`** (ny) |
| Service writes | `lib/data/repo.ts`, `app/api/signup` | tenants, users, memberships, clients, bookings, services |
| Audit | `lib/audit.ts` | REST → `audit_log` når `PRAXIS_AUDIT_MODE=supabase` |
| Swarm persist | `lib/swarm/persist.ts` | `swarm_snapshots` (manglede på remote!) |
| Swarm memory | `agents/memory/swarm-memory.ts` | `swarm_memory` + localEmbed **64-dim** (manglede på remote!) |
| Storage | `lib/scanner/resolve-image.ts` | bucket `scans` (ingen buckets på remote) |
| Health / admin | `app/api/health`, admin database-side | ping via service client |
| Env | `.env.example` | `SUPABASE_URL`, `SUPABASE_*_KEY`, `NEXT_PUBLIC_SUPABASE_*` |

Auth i PraxisOS er **egen session (HMAC / MitID)** — ikke primært Supabase Auth. GoTrue findes på cloud, men app-flow bruger ikke `auth.users` til klinik-login.

Realtime: ikke brugt i app-kode. Edge Functions: **0** på remote.

### Repo-migrationer

| Fil | Status |
|-----|--------|
| `0001_initial_schema.sql` | ready · policy-name fix (`*_isolation` matches remote) |
| `0002_seed_demo_data.sql` | ready |
| `0003_remote_parity_rls.sql` | **ny** · remote RLS + `trial` + modality UTF-8 + `tenants_select` + search_path harden |
| `0004_swarm_snapshots_and_memory.sql` | **ny** · kode krævede dem |
| `0005_agent_ledger.sql` | **ny** · tidligere «planned» |
| `0006_scan_meshes_and_storage.sql` | **ny** · tidligere «planned» + bucket |

### Remote vs repo (gap matrix)

| Emne | Remote | Repo før denne PR | Handling |
|------|--------|-------------------|----------|
| 18 kernetabeller | ja · **0 rækker** | ja i 0001 | dump/restore (tomt i praksis) |
| `tenants.trial` | ja | nej | **merge** → 0003 |
| RLS users/memberships + anon tenants | ja (`enable_rls_core_tables`) | nej | **merge** → 0003 |
| `tenants_select` policy | ja | ja i 0001 (uden RLS enable) | **idempotent** i 0003 |
| Modality `Hjemmebesoeg` vs `Hjemmebesøg` | ASCII på remote | UTF-8 i app/seed | **merge/fix** → 0003 |
| Isolation policy names | `*_isolation` | buggy `%I_tenant_isolated` | **fix** → 0001 |
| `swarm_snapshots` / `swarm_memory` | nej | nej (kun kode) | **merge** → 0004 |
| `agent_ledger` / `llm_call_metrics` | nej | planned | **merge** → 0005 |
| `scan_meshes` + storage `scans` | nej / ingen buckets | planned | **merge** → 0006 (+ applied on cloud) |
| Edge functions | ingen | ingen | leave |
| Realtime subscriptions | ikke brugt | — | leave |
| Auth schema (GoTrue) | system | — | leave (app bruger egen auth) |
| `pg_cron` | ikke installeret | kommenteret i 0001 | leave indtil der er jobs |
| Advisors | `audit_hash_chain` search_path · vector i public | — | search_path **fixed** i 0003 (+ cloud); vector schema move leave |

**Cloud efter merge (MCP apply_migration, data urørt):**  
`swarm_snapshots`, `swarm_memory`, `agent_ledger`, `llm_call_metrics`, `scan_meshes` + bucket `scans` · modality/search_path hardened. Row counts stadig **0**.

### Gap-beslutning (merge vs leave)

**Merge (gjort i repo):** remote RLS-migration, `trial`-kolonne, modality-align, `tenants_select` idempotency, isolation policy-name fix, swarm-tabeller, agent ledger, scan meshes + scans-bucket SQL.

**Leave / unsure:** cloud-only system schemas (auth/storage/realtime internals), empty edge functions, pg_cron until jobs exist, moving `vector` out of `public` (needs careful cutover), deleting the cloud project. Isolation policies still lack `WITH CHECK` (matches live remote — leave unless Broser wants tighter INSERT checks).

---

## 2. Arkitektur på Hetzner (fase 2)

Anbefalet sti (EU · durable):

1. **Postgres 17 + pgvector** via `docker-compose.db.yml` → named volume `praxis_pgdata` (overlever recreate).
2. **API-lag** (vælg én):
   - **A (simpelt / anbefalet først):** kun Postgres + app forbliver i `PRAXIS_DB=mock` indtil PostgREST/Kong er klar; derefter cutover.
   - **B (fuld Supabase-kompatibel):** officielle [supabase/docker](https://github.com/supabase/docker) stack på samme host (Kong `:8000`, PostgREST, Auth, Storage). Peg `SUPABASE_URL` på Kong. Behold samme `@supabase/supabase-js` klient.
3. App: `docker-compose.praxis.yml` uændret default (`PRAXIS_DB=mock`). Self-host aktiveres kun via env.

Port-binding: DB lytter default `127.0.0.1:5432` (ikke offentlig). App binder `0.0.0.0:$PORT` som i dag.

---

## 3. Runbook · cutover (uden at slette cloud)

### Forudsætninger

- SSH til `167.233.171.184` **eller** Hetzner Cloud Console som root.
- Database-password fra Supabase Dashboard → Settings → Database (til dump).
- Ny stærk `POSTGRES_PASSWORD` til Hetzner (gemmes kun i `/opt/PraxisOS/.env.production` — ikke i git).

### A. På agent/laptop — dump (source untouched)

```bash
# Session pooler eller direct host fra Dashboard
export SOURCE_DB_URL='postgresql://postgres.jajdtvduzkitjzcazcng:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres'
bash scripts/supabase-dump-remote.sh
# → ./backups/supabase-…/{schema.sql,data.sql,public.dump,MANIFEST.txt}
```

### B. På Hetzner — start durable DB

```bash
cd /opt/PraxisOS
git fetch origin && git checkout cursor/supabase-selfhost-migrate-2c11 && git pull

# Tilføj til .env.production (eksisterende clinical keys bevares):
# POSTGRES_PASSWORD=…   # ny
# POSTGRES_USER=praxis
# POSTGRES_DB=praxisos

docker network create omni_net 2>/dev/null || true
chmod +x scripts/db-init-selfhost.sh scripts/db-apply-migrations.sh \
  scripts/supabase-dump-remote.sh scripts/supabase-restore-hetzner.sh scripts/verify-rls.sh

docker compose -f docker-compose.db.yml --env-file .env.production up -d
# Første boot kører migrations via init-script.
# Senere: docker compose -f docker-compose.db.yml --env-file .env.production --profile migrate run --rm praxis-db-migrate
```

### C. Restore data (hvis der er rækker — pt. 0)

```bash
# Kopiér dump-mappe op på serveren, derefter:
export TARGET_DB_URL='postgresql://praxis:PASS@127.0.0.1:5432/praxisos'
APPLY_REPO_MIGRATIONS=0 bash scripts/supabase-restore-hetzner.sh ./backups/supabase-…
# Eller schema-from-repo + data-only:
APPLY_REPO_MIGRATIONS=1 bash scripts/supabase-restore-hetzner.sh ./backups/supabase-…
DATABASE_URL="$TARGET_DB_URL" bash scripts/verify-rls.sh
```

### D. (Valgfri) Fuld Supabase API-stack

```bash
# Officiel stack i /opt/supabase — følg supabase/docker README
# Sæt JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY (generér, commit ALDRIG)
# Kong public URL fx http://167.233.171.184:8000 eller https://db.bypilar.dk
```

Derefter i `/opt/PraxisOS/.env.production`:

```bash
PRAXIS_DB=supabase-selfhost
SUPABASE_URL=http://127.0.0.1:8000          # Kong
NEXT_PUBLIC_SUPABASE_URL=https://db.bypilar.dk
SUPABASE_ANON_KEY=…                         # genereret
SUPABASE_SERVICE_ROLE_KEY=…                 # genereret · kun server
PRAXIS_AUDIT_MODE=supabase
# Behold: SCAN_QUALITY_THRESHOLD=70 · vision pins · Bird · OpenAI
```

Genstart app:

```bash
docker compose -f docker-compose.praxis.yml --env-file .env.production up -d
curl -sS http://127.0.0.1:3010/api/health | head
```

### E. Env cutover-checklist

- [ ] `PRAXIS_DB=mock` stadig default i `.env.example` (uændret mock-dev)
- [ ] Production: `PRAXIS_DB=supabase-selfhost` først efter Kong/PostgREST health OK
- [ ] `SUPABASE_SERVICE_ROLE_KEY` kun server-side / `.env.production`
- [ ] Ingen keys i git / PR
- [ ] `SCAN_QUALITY_THRESHOLD=70` uændret
- [ ] `FOOT_VISION_CANARY_PERCENT` / Trellis / Roboflow pins uændrede
- [ ] Cloud-projekt ACTIVE som rollback indtil [`supabase-delete-gate.md`](./supabase-delete-gate.md) = PASS (`DELETE_READY: yes`)
- [ ] `verify-rls.sh` grøn
- [ ] Backup af `praxis_pgdata` (Hetzner snapshot eller `pg_dump` cron)
- [ ] Inventory/pg_dump under `./backups/` documented (see `docs/ops/supabase-backup-pointers.md`)

### F. Rollback

1. Sæt `PRAXIS_DB=mock` eller `supabase-eu` + gamle cloud-URL/keys i `.env.production`
2. `docker compose -f docker-compose.praxis.yml --env-file .env.production up -d`
3. Cloud-data er urørt

---

## 4. Console one-liner (hvis SSH-nøgle mangler)

Hvis Cursor-agent får `Permission denied (publickey)`:

1. Hetzner Cloud → server → **Console** → root  
2. Tilføj deploy-nøgle (fra eksisterende cutover-script) **eller** kør manuelt trin B–D ovenfor efter `git pull` af denne branch.  
3. Se også `docs/ops/production-cutover-2026-09-01.md`.

---

## 5. Residual risks

1. **SSH blocked** fra denne agent — host-cutover kræver Console / autoriseret nøgle.  
2. **Tom cloud-DB** — der er intet patientdata at migrere pt.; risiko er primært schema-drift fremover.  
3. **Uden Kong/PostgREST** kan app ikke bruge `supabase-js` mod ren Postgres — hold `mock` eller kør supabase/docker.  
4. **Storage** — bucket SQL kræver `storage`-schema (Supabase stack); plain Postgres springer bucket-delen over.  
5. **Modality constraint** på cloud brugte ASCII; app forventer `Hjemmebesøg` — rettet i 0003 ved restore/apply.  
6. Kliniske vision-thresholds må ikke røres under DB-cutover.

---

## 6. MCP inventory snapshot (2026-09-01 · project `jajdtvduzkitjzcazcng`)

Confirmed via Supabase MCP against Michael’s PraxisOS project (URL `https://jajdtvduzkitjzcazcng.supabase.co`, host `db.jajdtvduzkitjzcazcng.supabase.co`, Postgres 17.6, `ACTIVE_HEALTHY`). **No passwords or keys were written to git.**

| Surface | Result |
|---------|--------|
| Migrations | `20260616074641_initial_schema`, `20260616074751_enable_rls_core_tables` (matches screenshot hint `enable_rls_cor…`) |
| Public tables | 18 · all `relrowsecurity=true` · **0 rows** each |
| Edge functions | none |
| Storage buckets | none |
| Advisors | `audit_hash_chain` mutable search_path (fixed in repo `0003`); `vector` in `public` (left) |

**Tables (RLS on):** `tenants`, `users`, `memberships`, `services`, `clients`, `bookings`, `journals`, `journal_entries`, `scans`, `payments`, `vouchers`, `subsidy_schemes`, `reports`, `events`, `audit_log`, `module_activations`, `api_keys`, `webhook_subscriptions`.

**Remote-only vs repo `0001` (merged in `0003`):** `tenants.trial jsonb`; policies `tenants_anon_read`, `tenants_authenticated_read`, `users_self_read`, `memberships_self_read`; modality check still ASCII `Hjemmebesoeg` on cloud.

**Connection cutover env (secrets only on host):**

```text
PRAXIS_DB=supabase-selfhost
SUPABASE_URL=<Kong or https://db.bypilar.dk>
SUPABASE_ANON_KEY=<generated · not from screenshot>
SUPABASE_SERVICE_ROLE_KEY=<generated · server-only>
# Direct Postgres (ops only): postgresql://praxis:<HOST_PASS>@127.0.0.1:5432/praxisos
# Cloud direct (dump only): db.jajdtvduzkitjzcazcng.supabase.co:5432/postgres
```
