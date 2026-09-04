# Planway → PraxisOS booking cutover · by Pilar

**Order:** Broser — Planway er FÆRDIG; produktion skal køre PraxisOS booking live.  
**Public app:** https://app.bypilar.dk  
**Customer book:** https://app.bypilar.dk/t/bypilar/book (`?embed=1` for iframe)  
**WordPress:** https://bypilar.dk · https://bypilar.dk/booking/  
**Retired customer path:** https://bypilar.planway.com (must not be linked from bypilar.dk)

**Host:** Hetzner `167.233.171.184` · `/opt/PraxisOS` · Traefik → `app.bypilar.dk`  
**Agent note (2026-09-04):** SSH / `HCLOUD_TOKEN` / `HETZNER_PRAXIS_SSH_PRIVATE_KEY` **not** available in this cloud agent. Live API smoke ran from outside; host git sync requires Broser console or restored SSH.

---

## Goal (definition of done)

| Surface | ON / OFF |
|---------|----------|
| PraxisOS `/t/bypilar/book` + `/t/bypilar/book?embed=1` | **ON** |
| PraxisOS public APIs `services` / `availability` / `bookings` | **ON** |
| WordPress `data-praxis-book` + embed script / HTTPS iframe | **ON** |
| Planway links on bypilar.dk (nav, CTAs, emails, Google Business) | **OFF** |
| `GET /api/health` | `ok: true`, `dbMode != mock`, `backend != memory` |

---

## Live baseline (agent verify · 2026-09-04)

| Check | Result |
|-------|--------|
| `GET /api/health` | **200** · `dbMode: mock` · `backend: memory` · detail SERVICE_ROLE missing |
| `GET /t/bypilar/book` | **200** |
| `GET /t/bypilar/book?embed=1` | **200** |
| `GET /api/v1/bypilar/services` | **200** · bookUrl wrongly `https://0.0.0.0:3000/...` (fixed in this PR via `publicOrigin`) |
| `GET /api/v1/bypilar/availability?service=fod-med` | **200** |
| `POST /api/v1/bypilar/bookings` | **201** · `backend: memory` (works, not durable) |
| `GET /embed/v1/bypilar` (Origin bypilar.dk) | **200** · live still `ACAO: *` (host lag vs main F60) |
| bypilar.dk homepage | `data-praxis-book` present · **no** Planway strings · **no** embed `<script src=.../embed/v1/bypilar>` |
| bypilar.dk/booking/ | iframe `src="http://app.bypilar.dk/t/bypilar/book?embed=1"` (**http** → mixed content on HTTPS WP) |
| Planway host | still responds HTTP 200 (expected until DNS/account retire) |
| SSH `root@167.233.171.184` | Permission denied (publickey) |

---

## Broser steps to flip (exact)

### A. Host deploy (Hetzner Cloud Console as root)

```bash
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh | bash
```

Or after this PR merges, pin the SHA:

```bash
export PRAXIS_BRANCH=main
curl -fsSL https://raw.githubusercontent.com/Broser-ai/PraxisOS/main/scripts/production-cutover-main.sh | bash
```

Preserves `.env.production` + `/data/secrets.json`.

### B. Production DB (required — kill mock)

On host, edit `/opt/PraxisOS/.env.production`:

```bash
PRAXIS_DB=supabase-eu          # or supabase-local + docker-compose.db.yml
PRAXIS_ENV=production
PRAXIS_REQUIRE_REAL_DB=1
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://app.bypilar.dk
PRAXIS_PUBLIC_BASE_URL=https://app.bypilar.dk
SUPABASE_URL=...               # cloud EU or self-host Kong
SUPABASE_SERVICE_ROLE_KEY=...  # MUST be set — health fails without it
SUPABASE_ANON_KEY=...
PRAXIS_SESSION_SECRET=...      # ≥16 chars
PRAXIS_AUDIT_MODE=supabase
```

Then:

```bash
cd /opt/PraxisOS
docker compose -f docker-compose.praxis.yml --env-file .env.production up -d --build
```

Self-host Postgres path: `docs/ops/p0-db-cutover-runbook.md`.

### C. WordPress (by Pilar) — Planway OFF / PraxisOS ON

1. **Embed script** in theme `<head>` (homepage + booking):
   ```html
   <script src="https://app.bypilar.dk/embed/v1/bypilar" defer></script>
   ```
2. **Iframe on `/booking/`** — force HTTPS (fix mixed content):
   ```html
   <iframe src="https://app.bypilar.dk/t/bypilar/book?embed=1" ...></iframe>
   ```
3. **`data-praxis-book` IDs** must match PraxisOS catalog: `fod-std`, `fod-ext`, `fod-lux`, `mani` (aligned in this PR).
4. Search/replace theme + posts: remove every `planway.com` / `bypilar.planway.com` href.
5. Optional redirect: Planway booking URL → `https://app.bypilar.dk/t/bypilar/book` (or WP `/booking/`).

### D. Restore agent SSH (optional, for future agents)

Inject cloud secret `HETZNER_PRAXIS_SSH_PRIVATE_KEY` matching a pubkey already in host `authorized_keys` (cutover script installs Cursor cutover + legacy pubkeys), **or** keep using Console one-liner only.

---

## Verify after flip

Run `docs/ops/praxisos-booking-smoke-checklist.md`. Minimum:

```bash
curl -sS https://app.bypilar.dk/api/health
# expect: ok:true, dbMode != mock, backend != memory

curl -sS https://app.bypilar.dk/api/v1/bypilar/services | jq '.services[0].bookUrl'
# expect: https://app.bypilar.dk/t/bypilar/book?service=...

curl -sS 'https://app.bypilar.dk/api/v1/bypilar/availability?service=fod-std&days=3' | jq '.service.id'
# expect: "fod-std"

# WordPress
curl -sS https://bypilar.dk/booking/ | grep -E 'planway|http://app.bypilar'
# expect: no matches; iframe must be https://app.bypilar.dk/...
```

---

## Code shipped in this cutover PR

- `lib/public-origin.ts` — Traefik-safe public origin (no `0.0.0.0` bookUrl / embed ORIGIN)
- Health fail-fast also via `PRAXIS_ENV` / `PRAXIS_REQUIRE_REAL_DB` / public bypilar base URL
- Compose pins `NODE_ENV=production`, `PRAXIS_ENV=production`, `PRAXIS_REQUIRE_REAL_DB=1`, public base `https://app.bypilar.dk`
- by Pilar service IDs aligned with live WP `data-praxis-book`
- Availability **404** on unknown service (no silent fallback to wrong treatment)
- Cutover script post-checks booking/health/services
