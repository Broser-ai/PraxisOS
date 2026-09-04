# P0 · DB cutover runbook · PraxisOS self-host Postgres

**Owner:** Michael Ambrosius (Broser) · **Manual** — this runbook is NOT automated.
**Scope:** switch production off `PRAXIS_DB=mock` onto durable Postgres (self-host Hetzner) without breaking by-Pilar embed booking.
**Reference:** `docs/ops/p0-secure-clinical-core-plan.md` §C · `docker-compose.db.yml` · `scripts/migrate-memory-to-pg.ts`.

> Invariants (do not weaken): `NO_AUTO_MERGE` · `NO_AUTO_DEPLOY` · `suggestion_only` ·
> `NO_AUTO_JOURNAL_SIGN` · `NO_MODEL_TRAINING` · `PATHOLOGY_SHADOW`. The cutover
> is performed by Michael on the host; no agent merges or deploys on its behalf.

---

## 0. Pre-flight (Michael, on Hetzner)

- [ ] SSH to `167.233.171.184` (or current host); confirm `docker compose ps` for `praxisos_app`.
- [ ] Choose DB strategy: **A** self-host Postgres (`docker-compose.db.yml`) — recommended for Hetzner prod; or **B** unpause cloud Supabase EU. This runbook assumes **A**.
- [ ] DB bind: **loopback-only** `127.0.0.1:5432` (default in compose). Use private net only if app runs on a separate host.
- [ ] Snapshot `/data` volume (`secrets.json`, `journal-store.json`) before cutover: `cp -a /data /data.pre-cutover.bak`.
- [ ] Generate secrets locally (NOT in git): `POSTGRES_PASSWORD`, `PRAXIS_SESSION_SECRET` (≥16), `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` (if running PostgREST/Kong), `AGENT_WORKER_SECRET`, `PRAXIS_EVENT_SECRET`.
- [ ] Decide PostgREST/Kong vs app-direct. Today `lib/supabase.ts` expects the Supabase JS client (`SUPABASE_URL` + service role). Point `SUPABASE_URL` at your self-host API stack.

## 1. Start Postgres + apply migrations (additive — does not switch app)

```bash
# from repo root on the host
bash scripts/db-init-selfhost.sh
# equivalent to:
#   docker compose -f docker-compose.db.yml --env-file .env.production up -d praxis-db
#   docker compose -f docker-compose.db.yml --profile migrate run --rm praxis-db-migrate
# verify:
docker compose -f docker-compose.db.yml exec praxis-db psql -U praxis -d praxis -c '\dt'
# expect: tenants, clients, bookings, journals, journal_entries, audit_log,
#          consent_events, api_keys, ... (0001→0008)
```

Migrations are idempotent (`IF NOT EXISTS`); re-running is safe. Order: `0001`→`0008`.

## 2. Import memory/JSON data (Michael, manual — do NOT auto-execute)

```bash
# DRY RUN first — prints SQL + summary, no DB writes:
npx tsx scripts/migrate-memory-to-pg.ts --dry-run --journal-store /data/journal-store.json

# Review the emitted SQL. Then execute (requires SUPABASE_URL + SERVICE_ROLE_KEY
# pointed at the self-host API/PostgREST):
npx tsx scripts/migrate-memory-to-pg.ts --execute --journal-store /data/journal-store.json
```

ID strategy: tenant_id by slug, client_id by email (per-tenant unique), journals
row per (tenant, client) created on demand. Legacy `jr_*` ids are preserved via
the `migrate_memory_to_pg()` SQL function shipped with the runbook (run it once
before `--execute`). Process-memory without a dump is **lost** at restart — only
`/data/journal-store.json` + seed are importable; document any loss.

| Source | Target | Method |
|--------|--------|--------|
| `journal-store.json` | `journals` + `journal_entries` | `scripts/migrate-memory-to-pg.ts` |
| in-memory clients/bookings | `clients` / `bookings` | 0002 seed (demo) — prod: re-create with real hashes |
| in-memory `apiKeys` | `api_keys` | **Re-issue** hashed keys — never copy plaintext `sk_live_` from seed |
| accounts `lib/auth.ts` | `users` + `memberships` | 0002 seed; prod: real password hashes |
| `secrets.json` | stays file-volume | NOT moved to Postgres in P0 |

## 3. Switch app DB mode (Michael)

Edit `.env.production` on the host (volume — NOT committed):

```bash
PRAXIS_DB=supabase-eu          # or supabase-local when a self-host mode lands
SUPABASE_URL=...               # self-host Kong/PostgREST or cloud
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
PRAXIS_SESSION_SECRET=...      # was MISSING — now required (throw in prod without it)
PRAXIS_AUDIT_MODE=supabase     # required before CE-mark
POSTGRES_PASSWORD=...          # only for docker-compose.db.yml
```

Remove/forbid `PRAXIS_DB=mock` in production env. Optionally wire
`assertProductionDbConfig()` from `lib/supabase.ts` into app boot / `/api/health`
to fail-fast on mock in prod (additive guard from F9).

Restart the app:

```bash
docker compose -f docker-compose.praxis.yml --env-file .env.production up -d
```

## 4. Smoke (protect by-Pilar booking)

- [ ] `GET /api/health` → `backend: "supabase"`, `dbMode != "mock"`.
- [ ] `db.ping()` → latency, no `SERVICE_ROLE_KEY missing`.
- [ ] Public: `GET /api/v1/bypilar/services` → 200; `POST /api/v1/bypilar/bookings` (test booking) → **201** (no cookie — embed regression).
- [ ] Staff: login → `GET /api/auth/me` → 200; `GET /api/journal?tenant=bypilar` → 401 without cookie / 200 with.
- [ ] Consent gate: scan/process for a client without `photo_capture` consent → 403 `consent_required`.
- [ ] Audit: with `PRAXIS_AUDIT_MODE=supabase`, a journal sign writes a row to `audit_log` (check `select * from audit_log order by at desc limit 5`).

## 5. Health checks

| Check | Expectation |
|-------|-------------|
| Compose DB `pg_isready` | healthy |
| `GET /api/health` | `ok: true`, not memory |
| `db.ping()` | latency, no missing keys |
| App healthcheck (`/api/agents/status`) | up |

## 6. Backup

- Named volume `praxis_pgdata` — daily `pg_dump` to off-host (Michael sets cron/restic).
- Keep `/data` snapshot taken in step 0.

## 7. Rollback (emergency only)

1. Preferred: point `SUPABASE_URL` back / stop write-side migrate; redeploy previous app image tag.
2. `PRAXIS_DB=mock` **only** as last-resort emergency — accept dual-write/data-loss risk; document as incident. The DB volume is NOT deleted on app rollback.
3. Re-test public booking within 5 minutes of rollback.

---

## What is intentionally NOT automated

- **Merge / deploy** — `NO_AUTO_MERGE`, `NO_AUTO_DEPLOY`. The PR is opened; a human merges and deploys.
- **Cutover execution** — steps 0–4 are performed by Michael on the host. The import script defaults to `--dry-run`; `--execute` is a manual, explicit action.
- **Secret generation** — no secrets are committed; placeholders live only in `.env.production.example`.
- **`clinical_status` change / invariant weakening** — none.
- **Model training / LoRA** — out of P0 scope.

## Blockers requiring Broser

- Hetzner SSH + Docker access (server access) — cannot be done from the agent VM.
- Choice of DB strategy (self-host vs unpause cloud Supabase) — manual decision.
- Generation/entry of production secrets — must be done on the host, not in git.
- Final smoke on `bypilar.dk` / embed after cutover — requires prod access.
