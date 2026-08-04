# PraxisOS · Working Core Audit (2026-07-31)

## Verdict

HEAD was a high-fidelity **UI/API shell** on process-local mocks: login set an unsigned cookie nobody checked, signup was alert-theater, and booking/client POSTs returned JSON without storing anything.

This branch (`cursor/working-core-supabase-2c11`) turns the clinic loop into **real code paths**:

| Capability | Before | After |
|---|---|---|
| Session | Unsigned base64 cookie | HMAC-SHA256 signed (`lib/session-token.ts`) |
| Passwords | Plaintext `"demo"` | scrypt hashes (`lib/password.ts`) |
| Route protection | None | `middleware.ts` gates staff UI + list APIs |
| Signup | `alert()` mock | `POST /api/signup` creates tenant + owner |
| Clients POST | Fake id, not stored | Persists via `lib/data/repo.ts` |
| Bookings POST | Receipt only | Persists + appears in list |
| Database | Stub comments | `@supabase/supabase-js` service client when keys present |
| Fallback | — | Durable **memory store** (`globalThis`) when Supabase keys absent |

## What works now (without Alphaxiv swarm fantasy)

1. Login → signed cookie → `/dashboard` / `/klienter` / `/bookings` accessible  
2. Signup creates tenant + owner (`password: demo`)  
3. Public booking widget `POST /api/v1/{tenant}/bookings` **stores** the booking  
4. `GET …/bookings/list` and clients CRUD read/write the same store  
5. `/api/health` reports `backend: memory | supabase`

## Supabase production path

When `PRAXIS_DB` is `supabase-eu` **and** `SUPABASE_SERVICE_ROLE_KEY` is a real key:

- signup inserts `tenants` + `users` + `memberships`
- clients/bookings read/write Postgres (service role; filter by `tenant_id`)
- login can authenticate against `users.password_hash`

Apply migrations:

```bash
# 0001_initial_schema.sql then 0002_seed_demo_data.sql via Supabase SQL editor or CLI
```

Also set `PRAXIS_SESSION_SECRET` (≥16 chars) in Vercel Production + Preview.

> Note: this Cloud Agent environment redacts Vercel secret values to `[SENSITIVE]`, so live Supabase writes cannot be exercised here. Code paths are wired; verify after deploy or with local keys.

## Explicitly out of scope (still shell / later)

- MitID / passkey / real 2FA  
- Stripe / NemSMS / MedCom  
- Autonomous ARIA/FELIX/LUNA swarm, auto-merge, nail SSS renderer  
- Merging all of `savage-sweep-2026-07-12` (scanner/learning epics)

## Smoke test

```bash
npm run dev
node scripts/smoke-core.mjs
```
