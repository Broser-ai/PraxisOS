# PraxisOS public booking · smoke checklist

**Tenant:** bypilar · **Host:** https://app.bypilar.dk  
**Use after:** host cutover / DB flip / WordPress embed change  
**Related:** `docs/ops/planway-praxisos-booking-cutover.md`

Mark each row pass/fail. Do not mark production cutover complete while health is `mock`/`memory`.

---

## 1. Health / backend

- [ ] `GET https://app.bypilar.dk/api/health` → **200**, `ok: true`
- [ ] `dbMode` is **not** `mock`
- [ ] `backend` is **not** `memory`
- [ ] No `SUPABASE_SERVICE_ROLE_KEY missing` in `detail`
- [ ] Production misconfig → **503** `db_config_invalid` (fail-fast), never silent mock-OK

```bash
curl -sS https://app.bypilar.dk/api/health | jq .
```

## 2. Public book UI

- [ ] `GET /t/bypilar/book` → **200**, services render
- [ ] `GET /t/bypilar/book?embed=1` → **200**, embed chrome (no staff chrome)
- [ ] `GET /t/bypilar/book?service=fod-std` → service pre-selected
- [ ] Page is frameable (no `X-Frame-Options` on book/embed paths)

```bash
curl -sSI 'https://app.bypilar.dk/t/bypilar/book?embed=1' | grep -iE 'HTTP/|x-frame'
```

## 3. Services + slots

- [ ] `GET /api/v1/bypilar/services` → **200**, ≥1 service
- [ ] Every `bookUrl` starts with `https://app.bypilar.dk/` (never `0.0.0.0` / `127.0.0.1`)
- [ ] Catalog includes WP IDs: `fod-std`, `fod-ext`, `fod-lux`, `mani`
- [ ] `GET /api/v1/bypilar/availability?service=fod-std&days=5` → **200**, `service.id == fod-std`
- [ ] Unknown service → **404** `service_not_found` (no silent wrong treatment)

```bash
curl -sS https://app.bypilar.dk/api/v1/bypilar/services | jq '.services[] | {id, bookUrl}'
curl -sS 'https://app.bypilar.dk/api/v1/bypilar/availability?service=fod-std&days=5' | jq '{id: .service.id, days: (.slots|length)}'
curl -sS -o /dev/null -w '%{http_code}\n' 'https://app.bypilar.dk/api/v1/bypilar/availability?service=does-not-exist'
```

## 4. Book flow (API)

- [ ] `POST /api/v1/bypilar/bookings` with allowlisted `Origin: https://bypilar.dk` → **201**
- [ ] Response `backend` is durable (not `memory`) after DB flip
- [ ] Response includes `id`, `startsAt`, `receiptUrl`
- [ ] Missing fields → **400**; abuse burst → **429**
- [ ] No `praxis_session` cookie required

```bash
curl -sS -X POST https://app.bypilar.dk/api/v1/bypilar/bookings \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://bypilar.dk' \
  -H "Idempotency-Key: smoke-$(date +%s)" \
  -d '{
    "serviceId":"fod-std",
    "startsAt":"2026-09-15T10:30:00+02:00",
    "client":{"name":"Smoke Test","email":"smoke+booking@example.com","phone":"+4511223344"},
    "modality":"Klinik"
  }' | jq '{id, backend, status, receiptUrl}'
```

## 5. Embed / WordPress

- [ ] `GET /embed/v1/bypilar` with `Origin: https://bypilar.dk` → **200** JS
- [ ] ACAO echoes `https://bypilar.dk` (not `*`) after host runs current main
- [ ] Embed script `ORIGIN` constant is `https://app.bypilar.dk`
- [ ] bypilar.dk loads `<script src="https://app.bypilar.dk/embed/v1/bypilar" defer>`
- [ ] `/booking/` iframe is **`https://`** (not `http://`)
- [ ] Homepage `data-praxis-book` opens PraxisOS modal (manual browser)
- [ ] Zero `planway.com` links on bypilar.dk nav/CTAs

```bash
curl -sS -H 'Origin: https://bypilar.dk' https://app.bypilar.dk/embed/v1/bypilar \
  | head -c 400
curl -sS https://bypilar.dk/booking/ | grep -Eo 'src="[^"]*bypilar[^"]*"'
curl -sS https://bypilar.dk/ | grep -ci planway   # expect 0
```

## 6. Planway OFF

- [ ] No Planway CTA on bypilar.dk homepage
- [ ] No Planway CTA on `/booking/`
- [ ] Staff told: customers use PraxisOS only
- [ ] Optional: Planway account paused / redirect configured

## 7. Sign-off

| Role | Name | Date | Pass? |
|------|------|------|-------|
| Broser (ops) | | | |
| Clinic spot-check (book real slot, then cancel) | | | |

**Notes:**
