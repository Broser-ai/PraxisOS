# P0 · Secure Clinical Core — implementeringsplan

**Produkt:** PraxisOS (`Broser-ai/PraxisOS`) · pilot by Pilar  
**Ejernavn:** Michael Ambrosius (Broser)  
**Scope:** Plan only — **ingen** patient-chat, triage eller nye AI-features i denne P0.  
**Base:** `main` @ verificeret træ (41× `app/api/**/route.ts`)  
**Reference:** arkitekt-briefing `docs/ops/ai-fodpleje-arkitekt-briefing.md` (PR-branch), live prod 2026-09-03: `PRAXIS_DB=mock` / memory.

**P0-mål (skal lukkes):**

1. Produktion må **ikke** længere køre på `PRAXIS_DB=mock`.
2. Alle tenant-sensitive API-routes: konsistent auth, tenant-isolation, rolle-autorisering.
3. `GET /api/auth/me` implementeres og bruges af eksisterende `lib/staff-session.ts`.
4. Audit + `consent_events` er durable og **håndhæves** (ikke kun deklareret).

**Ikke-mål:** rewrite af auth/data-laget; nye AI-flader; Stripe/email/CRM.

---

# A. Route inventory

**Metode:** `find app/api -name route.ts` → 41 filer. Nedenfor er **alle** routes der læser/skriver klienter, bookings, journaler, scans/billeder, agent-runs, Bird/SMS, tenant-config, licenser eller API-keys — plus eksplicit markerede public-by-design booking-routes.

**Forkortelser:**

| Felt | Betydning |
|------|-----------|
| **Access i dag** | Hvad route-filen faktisk tjekker |
| **Krævet rolle** | Mål-rolle efter P0 (`lib/auth.ts` Role + `ROLE_PERMISSIONS`) |
| **Tenant-kilde** | Hvor tenant kommer fra i dag |
| **Risiko** | Klinisk/GDPR-risiko |
| **Anbefalet guard** | P0-guard (se §B) |

**Kritisk systemfund (gælder mange rækker):**

- `lib/request-auth.ts` → `authorizeTenantRequest` bruges **kun i tests** — **0** `route.ts` importerer den.
- `middleware.ts` laver **kun** bypilar-host routing — **injicerer ikke** `x-praxis-tenant|role|account`.
- Routes der tjekker `x-praxis-tenant` (clients, bookings/list) accepterer derfor **header-spoofing**, hvis nogen sender headeren uden cookie-verify.
- `GET /api/auth/me` er **NOT FOUND** (`app/api/auth/` har kun `login` + `logout`), mens `fetchStaffSession()` allerede kalder den.

---

## A.1 Klienter

| Route | Method | Access i dag | Krævet rolle | Tenant-kilde | Risiko | Anbefalet guard |
|-------|--------|--------------|--------------|--------------|--------|-----------------|
| `app/api/v1/[tenant]/clients/route.ts` | GET | Lokal `checkAuth`: accepterer **enhver** `x-praxis-tenant` *eller* Bearer der starter med `sk_live_`/`sk_test_`/`pk_test_dead` — **uden** `verifyApiKey` / tenant-match | `reception+` (permission `bookings`) · læs; `write:clients` for API-key | Path `[tenant]` | **Høj** — PII-liste + spoofable session-header + svag Bearer | `requireTenantAccess({ scopes: ["read:clients"], permissions: ["bookings"] })` |
| samme | POST | Samme svage `checkAuth` | `reception+` · API `write:clients` | Path + body | **Høj** — opret klient uden reel auth | `requireTenantAccess({ scopes: ["write:clients"], permissions: ["bookings"] })` + audit |

## A.2 Bookings

| Route | Method | Access i dag | Krævet rolle | Tenant-kilde | Risiko | Anbefalet guard |
|-------|--------|--------------|--------------|--------------|--------|-----------------|
| `app/api/v1/[tenant]/bookings/route.ts` | POST | **Ingen auth** (public booking) | **Public-by-design** (patient) | Path `[tenant]` | Middel — spam/abuse; OK for by Pilar embed | Se §A.9 public booking kit (rate-limit + origin/CORS allowlist + valgfri public booking key) — **må ikke kræve staff-login** |
| samme | OPTIONS | CORS preflight `*` | Public | — | Lav | Behold; stram `Allow-Origin` til kendte booking-hosts |
| `app/api/v1/[tenant]/bookings/list/route.ts` | GET | Kræver `x-praxis-tenant` **eller** Bearer prefix — ingen verify/tenant-match | `reception+` · API `read:bookings` | Path | **Høj** — staff booking-liste | `requireTenantAccess({ scopes: ["read:bookings"], permissions: ["bookings"] })` |

## A.3 Journaler

| Route | Method | Access i dag | Krævet rolle | Tenant-kilde | Risiko | Anbefalet guard |
|-------|--------|--------------|--------------|--------------|--------|-----------------|
| `app/api/journal/route.ts` | GET | **Ingen auth**; `tenant` query default `bypilar` | `practitioner` / `owner` / `support` (`journal`) | Query `tenant` | **Kritisk** — SOAP/klinikdata åben | `requireStaffSession` + tenant + `permissions: ["journal"]` |
| samme | POST | **Ingen auth** | `practitioner+` | Body `tenant` | **Kritisk** | Samme + audit `journal.created` |
| `app/api/journal/[id]/route.ts` | GET | **Ingen auth** | `practitioner+` | Implicit via entry | **Kritisk** — IDOR på tværs af tenants | `requireJournalAccess(id)` (load entry → tenant match + role) |
| samme | PATCH | **Ingen auth** | `practitioner+` | ID | **Kritisk** | Samme + audit |
| `app/api/journal/[id]/sign/route.ts` | POST | **Ingen auth** | `practitioner` / `owner` (ikke `reception`) | ID | **Kritisk** — juridisk signering | `requireRole(["practitioner","owner","support"])` + audit `journal.signed` |
| `app/api/journal/[id]/draft/route.ts` | POST | **Ingen auth** | `practitioner+` | ID | **Høj** — AI-SOAP uden consent-gate | Role + **consent gate** (`Sundhedsdata` / purpose `ai_draft`) |
| `app/api/journal/from-booking/route.ts` | POST | **Ingen auth** | `reception+` / `practitioner+` | Via `bookingId` → `lib/bookings` | **Høj** | Session + booking.tenant match |

**Persistens i dag:** `lib/journal.ts` skriver til `$PRAXIS_DATA_DIR/journal-store.json` når sat — ellers process-memory. P0 DB-cutover skal migrere disse entries (se §C).

## A.4 Scans / billeder / Nexus

| Route | Method | Access i dag | Krævet rolle | Tenant-kilde | Risiko | Anbefalet guard |
|-------|--------|--------------|--------------|--------------|--------|-----------------|
| `app/api/v1/scan/process/route.ts` | POST | **Ingen auth**; accepterer `imageBase64`/`imageUrl` + valgfri `tenantId`/`patientId`/`bookingId` | `practitioner+` (staff scan) | Body / booking | **Kritisk** — biometri + AI uden consent; kan spoofe tenant | `requireStaffSession` + tenant + **consent_events** før inference + audit |
| samme | GET | **Ingen auth**; status for `bypilar` | `owner` / `support` (ops) eller public readiness (kun non-secret) | Hardcoded `bypilar` | Middel — provider-status | Staff for detaljer; evt. strip secrets (allerede `secretsPublicStatus`) |
| `app/api/scan/config/route.ts` | GET | **Ingen auth** | Public readiness OK | — | Lav (hints, ikke raw keys) | Behold public GET **eller** staff-only hvis I vil skjule blocker-tekst |
| samme | POST | **Ingen auth** — skriver Replicate/Roboflow/OpenAI til `/data/secrets.json` | `owner` / `support` **kun** | — | **Kritisk** — secret write | `requireRole(["owner","support"])` + audit `secrets.updated` |

## A.5 Agent-runs / workflows / approvals / orchestrator / swarm

| Route | Method | Access i dag | Krævet rolle | Tenant-kilde | Risiko | Anbefalet guard |
|-------|--------|--------------|--------------|--------------|--------|-----------------|
| `app/api/agents/run/route.ts` | POST | **Ingen auth**; body `tenant` default `bypilar` | `practitioner+` / `owner` | Body | **Høj** — LLM/tools på klinikdata | `requireTenantAccess` (tenant fra session, ikke free body) |
| `app/api/agents/status/route.ts` | GET | **Ingen auth** — runs, approvals, jobs | `owner` / `support` | — | **Høj** — automation-leak | Staff session + role |
| `app/api/agents/approvals/route.ts` | GET | **Ingen auth** | `owner` / `practitioner` (afhængig af action) | — | **Høj** | Staff + role |
| samme | POST | **Ingen auth**; kan `signJournalEntry` + `sendBirdSms` marketing | `owner` (godkendelse) | Approval.tenant | **Kritisk** — SMS + journal-sign uden login | `requireRole(["owner","practitioner","support"])` + consent for marketing SMS + audit |
| `app/api/agents/tick/route.ts` | POST/GET | `AGENT_WORKER_SECRET` / `PRAXIS_EVENT_SECRET`; **hvis secret mangler → open** (`return true`) | Machine (`worker`) | Body/query | **Høj** i prod hvis secret unset | Fail-closed i production: manglende secret ⇒ 503; require header |
| `app/api/agents/workflows/route.ts` | GET | **Ingen auth** | `owner` / `support` | — | Middel | Staff |
| samme | POST | Worker-secret (open hvis unset) | Machine | Body | **Høj** | Fail-closed worker auth |
| `app/api/v1/[tenant]/orchestrator/route.ts` | POST | `decodeSession` + `session.tenant === tenant` | Session-rolle (allerede) | Path + cookie | Middel — **bedste eksisterende mønster** | Genbrug: udvid med `requireRole` ift. origin; audit allerede delvist via `lib/orchestrator.ts` |
| `app/api/v1/[tenant]/orchestrator/runs/[runId]/route.ts` | GET | Session cookie + tenant | Samme som orchestrator | Path | Middel | Behold session-guard |
| `app/api/v1/[tenant]/swarm/route.ts` | GET/POST | Session + tenant/support | `owner` / `support` (Broser) | Path | Middel–høj (worktrees/merge) | Behold; tilføj eksplicit role-check (ikke reception) |
| `app/api/v1/[tenant]/swarm/tick/route.ts` | POST | Session **eller** approve-token paths | `owner`/`support` / machine | Path | Middel | Behold; fail-closed tokens i prod |
| `app/api/v1/[tenant]/swarm/stream/route.ts` | GET | Parser `praxis_session` fra Cookie-header | `owner`/`support` | Path | Middel | Behold; ensret via guard-helper |
| `app/api/cron/swarm-tick/route.ts` | GET | `CRON_SECRET` / `x-vercel-cron`; non-prod open | Machine | Env tenant | Middel | Fail-closed i production |
| `app/api/v1/[tenant]/research/route.ts` (+ ask, papers) | GET/POST | Session cookie + tenant | `owner`/`support` (research) | Path | Lav–middel | Behold session; role gate |
| `app/api/mcp/v1/route.ts` | POST | Bearer **prefix-only** (ingen `verifyApiKey`); tools hardcoder ofte tenant `bypilar` | API-key scopes per tool | Hardcoded / args | **Høj** | `verifyApiKey` + tenant fra key; strip cross-tenant args |
| samme | GET | Info | Public OK | — | Lav | Behold |

## A.6 Bird / SMS / events

| Route | Method | Access i dag | Krævet rolle | Tenant-kilde | Risiko | Anbefalet guard |
|-------|--------|--------------|--------------|--------------|--------|-----------------|
| `app/api/bird/send/route.ts` | POST | **Ingen auth** — sender SMS hvis Bird konfigureret | `reception+` transactional; marketing kræver `owner` + consent | Ingen tenant i body | **Kritisk** — åben SMS-gateway | `requireStaffSession` + tenant + **consent_events** (purpose `sms_transactional` / `sms_marketing`) + audit |
| `app/api/bird/config/route.ts` | GET | **Ingen auth** (public status) | `owner`/`support` for detaljer | — | Lav–middel | GET kan forblive public readiness; POST: owner |
| samme | POST | **Ingen auth** — skriver Bird/OpenAI secrets | `owner`/`support` | — | **Kritisk** | `requireRole(["owner","support"])` + audit |
| `app/api/bird/status/route.ts` | GET | **Ingen auth** | Public readiness OK | — | Lav | Behold |
| `app/api/events/route.ts` | POST | `x-praxis-signature` HMAC; non-prod accepterer mismatch | Machine / internal | Body `tenant` | Middel | Prod allerede strict; kræv `PRAXIS_EVENT_SECRET` sat |
| samme | GET | **Ingen auth** — lister events | `owner`/`support` | Query | **Høj** | Staff + tenant filter enforced |

## A.7 Tenant-config / licenses / signup / API-keys

| Route | Method | Access i dag | Krævet rolle | Tenant-kilde | Risiko | Anbefalet guard |
|-------|--------|--------------|--------------|--------------|--------|-----------------|
| `app/api/tenant/setup/route.ts` | POST | **Ingen auth** | `owner` | Body `tenant` | **Høj** — brand/services hijack | `requireRole(["owner"])` + tenant match |
| `app/api/license/route.ts` | GET | **Ingen auth** | `owner`/`support` | Query | Middel | Staff |
| samme | POST | **Ingen auth** — activate/change_plan | `owner`/`support` | Body | **Høj** | `requireRole(["owner","support"])` + audit |
| `app/api/signup/route.ts` | POST | Rate-limit; opretter tenant+owner (memory eller Supabase) | Public (self-serve) | Body | Middel — abuse | Behold public + streng rate-limit/captcha; audit |
| API-keys CRUD | — | **Ingen dedicated route** i `app/api` (keys lever i `lib/api-keys.ts` memory + SQL `api_keys` i 0001) | `owner` + permission `api` | — | N/A endnu | P0: når UI/API lander → `requireRole(["owner"])` + hashed secrets i DB |

## A.8 Auth / health / lookups (relateret)

| Route | Method | Access i dag | Krævet rolle | Tenant-kilde | Risiko | Anbefalet guard |
|-------|--------|--------------|--------------|--------------|--------|-----------------|
| `app/api/auth/login/route.ts` | POST | Public + rate-limit/captcha | Public | Body tenant pick | Middel (credential stuffing) | Behold; kræv `PRAXIS_SESSION_SECRET` i prod (allerede throw i `session-token.ts`) |
| `app/api/auth/logout/route.ts` | POST | Clearer cookie | Public | — | Lav | Behold |
| `app/api/auth/me/route.ts` | GET | **NOT FOUND** | Logged-in staff | Cookie | **Blokerer staff-session** | **Implementér** (se §B) |
| `app/api/health/route.ts` | GET | Public — eksponer `dbMode`/`backend` | Public OK | — | Lav | Behold (ops) |
| `app/api/dawa/autocomplete/route.ts` | GET | Public proxy | Public | — | Lav | Rate-limit |
| `app/api/cvr/lookup/route.ts` | GET | Public proxy | Public (signup) | — | Lav–middel | Rate-limit |
| `app/api/v1/[tenant]/lookup/route.ts` | GET | **Public** — email → kendt klient + subsidies/vouchers | Public-by-design (booking) men **PII-lælsom** | Path + email query | **Høj** — email enumeration | Public kit + rate-limit + minimal response (ingen alder/schemes uden booking-session token) |
| `app/api/v1/[tenant]/services/route.ts` | GET | Public (dokumenteret headless) | Public-by-design | Path | Lav | Public kit |
| `app/api/v1/[tenant]/availability/route.ts` | GET | Public | Public-by-design | Path | Lav | Public kit |
| `app/api/v1/[tenant]/voucher/route.ts` | GET | Public code validate | Public-by-design | Path + code | Middel — code brute-force | Public kit + rate-limit |

---

## A.9 Public-by-design (by Pilar booking) — beskyt uden at knække embed

**Skal forblive uden staff-login:**

- `GET /api/v1/[tenant]/services`
- `GET /api/v1/[tenant]/availability`
- `POST /api/v1/[tenant]/bookings` (+ OPTIONS)
- `GET /api/v1/[tenant]/voucher`
- `GET /api/v1/[tenant]/lookup` (med begrænset payload)

**P0-beskyttelse (additive, ikke login):**

1. **Origin/Referer allowlist** per tenant (`lib/tenants.ts` domains + env `PRAXIS_BOOKING_CORS_ORIGINS`) — erstat `access-control-allow-origin: *` på write/list-sensitive public routes med allowlist (services/availability kan forblive `*` midlertidigt).
2. **Rate-limit** pr. IP + tenant (genbrug `lib/rate-limit.ts` mønster fra login/signup).
3. **Valgfri public booking key** (`pk_live_…` med scope `write:bookings` / `read:services`) via `Authorization: Bearer` — **ikke** breaking: hvis key mangler, tillad stadig allowlisted origin (by Pilar WordPress/embed). Når bypilar.dk kan sende key, kræv den.
4. **Aldrig** kræv `praxis_session` på patient booking — det knækker `/embed/v1` og `/t/bypilar/book`.
5. Regression-test: smoke booking POST for `bypilar` uden cookie skal fortsat returnere 201 (med rate-limit headers).

---

# B. Auth-design

## B.1 Princip

**Én** delt guard-stak der genbruger:

- `lib/session-token.ts` / `lib/auth.ts` (`decodeSession`, `Role`, `ROLE_PERMISSIONS`, `SESSION_COOKIE`)
- `lib/request-auth.ts` (`authorizeTenantRequest`, `AuthOk`/`AuthFail`)
- `lib/api-keys.ts` (`verifyApiKey`, scopes)
- Cookie-baserede mønstre allerede i `orchestrator` / `swarm`

**Ingen rewrite.** Luk hullerne: cookie → verified identity; strip forgeable headers; role checks; fail-closed worker secrets.

## B.2 Nye / udvidede filer

| Path | Ansvar |
|------|--------|
| `app/api/auth/me/route.ts` | **NY** — `GET` returnerer `StaffSession`-shape |
| `lib/api-guard.ts` | **NY** — tynde wrappers oven på eksisterende auth |
| `lib/request-auth.ts` | **UDVID** — resolve session fra cookie; strip/ignore client `x-praxis-*` medmindre sat af middleware |
| `middleware.ts` | **UDVID** — for `/api/*`: (1) slet indkommende `x-praxis-*`, (2) hvis gyldig `praxis_session`, injicer headers (som `authorizeTenantRequest` allerede forventer) |
| `lib/consent.ts` | **NY** — `assertConsent` / `recordConsentEvent` (se §D) |
| `lib/audit.ts` | **UDVID** — request-context + schema-align med SQL (se §D) |

### Typer (forslag — præcise)

```ts
// lib/api-guard.ts
import type { Role } from "@/lib/auth";
import type { ApiKeyScope } from "@/lib/api-keys";
import type { AuthOk, AuthFail } from "@/lib/request-auth";

export type GuardOk = AuthOk & {
  permissions: string[];
};

export type RequireTenantOpts = {
  scopes?: ApiKeyScope[];          // API-key path
  permissions?: string[];          // session: must intersect ROLE_PERMISSIONS[role]
  roles?: Role[];                  // explicit allow-list (fx journal.sign)
  allowPublicBooking?: never;      // ikke bland public her
};

export function resolveRequestAuth(req: Request): AuthOk | AuthFail;
// 1) decodeSession(cookie) → AuthOk mode session
// 2) else Bearer → verifyApiKey når tenant kendt
// 3) else 401

export function requireTenantAccess(
  req: Request,
  tenant: string,
  opts?: RequireTenantOpts,
): GuardOk | AuthFail;

export function requireRole(
  auth: AuthOk,
  roles: Role[],
): AuthOk | AuthFail;

export function requirePermission(
  auth: AuthOk,
  permission: string,
): AuthOk | AuthFail;

export function jsonAuthFail(fail: AuthFail): Response;
// NextResponse.json(fail.body, { status: fail.status }) — ingen stack/PII
```

**Sikkerhedsregel:** stol **aldrig** på klient-satte `x-praxis-*`. Enten middleware sætter dem efter HMAC-verify, eller `resolveRequestAuth` læser cookie direkte (foretrukket dobbelt-check i guard).

### `GET /api/auth/me`

Match `lib/staff-session.ts`:

```ts
// Response 200
{
  accountId, tenant, role,
  name, email, initials,
  tenantName  // fra getTenant(tenant).brand.name
}
// 401 { error: "unauthorized" }
```

Implementering: `decodeSession(cookie)` → `getAccountById` / Supabase user → JSON. **Ingen** ny session-model.

## B.3 Before/after sketches

### 1) Journal list (i dag åben)

```ts
// BEFORE — app/api/journal/route.ts
export async function GET(req: Request) {
  const tenant = url.searchParams.get("tenant") ?? "bypilar";
  return NextResponse.json({ entries: listJournal({ tenant, ... }) });
}

// AFTER
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tenant = url.searchParams.get("tenant");
  if (!tenant) return NextResponse.json({ error: "tenant_required" }, { status: 400 });
  const auth = requireTenantAccess(req, tenant, {
    permissions: ["journal"],
    roles: ["owner", "practitioner", "support"],
  });
  if (!auth.ok) return jsonAuthFail(auth);
  return NextResponse.json({ entries: listJournal({ tenant, ... }) });
}
```

### 2) Clients (erstat lokal checkAuth)

```ts
// BEFORE — accepterer spoofed x-praxis-tenant / ukontrolleret Bearer
const auth = checkAuth(req);

// AFTER
const auth = requireTenantAccess(req, tenant, {
  scopes: ["read:clients"],      // GET
  permissions: ["bookings"],
});
if (!auth.ok) return jsonAuthFail(auth);
```

### 3) Bird send (i dag åben SMS)

```ts
// AFTER — app/api/bird/send/route.ts
const auth = requireTenantAccess(req, tenantFromSessionOrBody, {
  permissions: ["bookings"], // reception may send transactional
});
if (!auth.ok) return jsonAuthFail(auth);
if (category === "marketing") {
  const roleGate = requireRole(auth, ["owner", "support"]);
  if (!roleGate.ok) return jsonAuthFail(roleGate);
}
await assertConsent({ tenant, clientId, purpose: category === "marketing" ? "sms_marketing" : "sms_transactional" });
auditLog("sms.sent", { tenant_id: tenant, actor_user_id: auth.accountId, ... });
```

**Safe errors:** kun stabile koder (`unauthorized`, `forbidden`, `tenant_mismatch`, `insufficient_role`, `consent_required`, `missing_consent`) — ingen journal-indhold, CPR eller stack i JSON.

---

# C. Database migration plan

## C.1 Nuværende tilstand (verificeret i kode + briefing)

| Faktum | Evidens |
|--------|---------|
| Default `PRAXIS_DB=mock` | `lib/supabase.ts` L13; `.env.example`, `.env.production.example` |
| Live prod (briefing 2026-09-03) | `GET /api/health` → `dbMode: "mock"`, memory |
| Cloud Supabase `jajdtvduzkitjzcazcng` | Briefing: **INACTIVE/paused** |
| Compose på `main` | `docker-compose.praxis.yml` (app + agent-worker), `docker-compose.sandbox.yml` |
| `docker-compose.db.yml` | **NOT FOUND på main** — findes på research-branch `cursor/supabase-selfhost-migrate-2c11` (reference, ikke merge-antagelse) |
| Migrations klar | `supabase/migrations/0001`–`0004` |
| `0005_scan_meshes` | Listet `planned` i `lib/supabase.ts` — **fil mangler** |
| Durable files | `$PRAXIS_DATA_DIR` → `secrets.json`, `journal-store.json`, swarm memory |

**Manuel beslutning (Michael / server-adgang):** Vælg A) self-host Postgres på Hetzner, eller B) genåbn cloud Supabase EU. Planen nedenfor er skrevet til **A** (matcher Hetzner-prod), med B som alternativ cutover af samme app-env.

## C.2 Trinvis cutover (self-host Postgres)

### Trin 0 — Michael manuel beslutning / server-adgang

- [ ] Bekræft Hetzner SSH + Docker på `167.233.171.184` (eller aktuel host).
- [ ] Vælg DB-host binding: **loopback-only** `127.0.0.1:5432` (anbefalet) vs. privat net.
- [ ] Generér secrets lokalt (ikke i git): `POSTGRES_PASSWORD`, `PRAXIS_SESSION_SECRET` (≥16), `SUPABASE_SERVICE_ROLE_KEY`/`ANON` hvis Kong/PostgREST bruges, `PRAXIS_AUDIT_MODE=supabase`, worker/event secrets.
- [ ] Beslut: kør I PostgREST/Kong (Supabase-stack) eller app direkte via `postgres` URL? **I dag** forventer `lib/supabase.ts` HTTP Supabase client (`SUPABASE_URL` + service role) — **ikke** raw `DATABASE_URL`.  
  → **Manuel beslutning:** enten (1) kør minimal Supabase API-stack foran Postgres, eller (2) tilføj senere `pg`-client path i repo (uden for snæver P0 hvis I genbruger existing Supabase JS).

> Planen opfinder **ikke** secrets. Placeholders kun i `.env*.example`.

### Trin 1 — Additive infra-filer (mergeable PR, ingen prod-ændring endnu)

Foreslå **nye** filer på main (kopier/tilpas fra research-branch — verificér før copy):

- `docker-compose.db.yml` — `pgvector/pgvector:pg17`, named volume `praxis_pgdata`, healthcheck `pg_isready`, migrations mount, optional migrate profile.
- `scripts/db-init-selfhost.sh` / `scripts/db-apply-migrations.sh` — kør `0001`→`0004` idempotent.
- Opdater `.env.production.example`: dokumentér `PRAXIS_DB=supabase-eu` **eller** ny mode `supabase-selfhost` **kun hvis** koden udvides; indtil da brug eksisterende `supabase-local`/`supabase-eu` med URL peget på self-host API.
- **Ikke** claim at filen allerede findes på main.

### Trin 2 — Secrets / env (Michael)

På server `.env.production` (volume/host — ikke commit):

```bash
# Mål efter cutover (værdier udfyldes af Michael)
PRAXIS_DB=supabase-eu   # eller supabase-selfhost når/hvis mode lander
SUPABASE_URL=...         # self-host Kong/API eller cloud
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
PRAXIS_SESSION_SECRET=...    # mangler i nuværende .env.production.example — SKAL tilføjes
PRAXIS_AUDIT_MODE=supabase
POSTGRES_PASSWORD=...        # kun compose.db
# Behold: BIRD_*, OPENAI_*, AGENT_WORKER_SECRET, PRAXIS_DATA_DIR=/data
```

**Fjern/forbyd:** `PRAXIS_DB=mock` i production env. App-boot kan senere fail-fast hvis `NODE_ENV=production && DB_MODE==="mock"`.

### Trin 3 — Start DB + migrations

```bash
# På host (Michael) — eksempel, ikke automatiseret her
docker compose -f docker-compose.db.yml --env-file .env.production up -d
docker compose -f docker-compose.db.yml --profile migrate run --rm praxis-db-migrate
# Verificér: psql \dt → tenants, clients, audit_log, ...
```

Kør i rækkefølge: `0001_initial_schema.sql` → `0002_seed_demo_data.sql` (kun hvis demo OK) → `0003` → `0004` → **ny** `0005_audit_log_align.sql` → **ny** `0006_consent_events.sql` (§D).

### Trin 4 — Data migration fra memory/JSON

| Kilde | Mål | Metode |
|-------|-----|--------|
| `lib/data/memory` clients/bookings | `clients` / `bookings` | One-shot script `scripts/migrate-memory-to-pg.ts` (læs seed + runtime store hvis dumpet) |
| `$PRAXIS_DATA_DIR/journal-store.json` | `journals` + `journal_entries` | Import script; bevar IDs hvor muligt |
| In-memory `apiKeys` | `api_keys` | Re-issue keys (hashed) — **ikke** copy plaintext secrets fra seed |
| Accounts i `lib/auth.ts` | `users` + `memberships` | Seed allerede i 0002; prod: opret rigtige hashes |
| `secrets.json` | forbliver fil-volume | **Ikke** flyt API-tokens til Postgres i P0 |

**Begrænsning:** Process-memory uden dump er **tabt** ved restart — forvent kun JSON-filer + seed. Marker eksplicit i cutover-runbook.

### Trin 5 — App cutover (beskyt by Pilar booking)

1. Deploy app-build der har auth-guards + DB mode (feature flags OK).
2. Sæt env → restart `docker compose -f docker-compose.praxis.yml`.
3. Smoke:  
   - `GET /api/health` → `backend: "supabase"`, `dbMode != mock`  
   - Public: `GET /api/v1/bypilar/services`, `POST /api/v1/bypilar/bookings` (test-booking)  
   - Staff: login → `GET /api/auth/me` → journal list 401 uden cookie / 200 med.
4. Hold `PRAXIS_DATA_DIR` volume for secrets + fallback journal indtil journal-repo er 100% på PG.

### Trin 6 — Health checks

| Check | Forventning |
|-------|-------------|
| Compose DB `pg_isready` | healthy |
| `GET /api/health` | `ok: true`, ikke memory |
| `db.ping()` | latency + ingen `SERVICE_ROLE_KEY missing` |
| App healthcheck i `docker-compose.praxis.yml` | findes (agents/status) — overvej tillæg health der også kræver DB |

### Trin 7 — Backup

- Named volume `praxis_pgdata` — daglig `pg_dump` til off-host (Michael sætter cron/restic).
- Behold snapshot af `/data` før cutover.

### Trin 8 — Rollback

1. Sæt `PRAXIS_DB=mock` midlertidigt **kun** hvis nød — accepter datatab/dual-write risiko; dokumentér som emergency.
2. Foretrukket rollback: peg `SUPABASE_URL` tilbage / stop skrivende migrate; app image previous tag.
3. DB volume **slettes ikke** ved app-rollback.
4. Public booking skal testes inden for 5 min efter rollback.

---

# D. Durable audit + consent

## D.1 Audit-events

### Eksisterende

- Runtime: `lib/audit.ts` — `auditLog` / `auditError`, modes `memory` | `supabase` | `stub`, PII-redact via `lib/redact.ts`.
- SQL: `audit_log` i `0001_initial_schema.sql` (hash-chain trigger).

### Schema-mismatch (skal fixes i P0)

`persistSupabase` POSTer felter:

`at, action, tenant_id, actor_user_id, target_ref, meta, level`

SQL-kolonner i dag:

`tenant_id, user_id, target_cpr_hashed, action, resource_type, resource_id, purpose, treatment_ref, ip, user_agent, geo, hash, prev_hash, at`

**Ingen** `meta`/`level`/`actor_user_id`/`target_ref` i SQL → supabase-mode vil fejle eller droppe data.

**P0 migration `0005_audit_log_align.sql` (forslag):**

```sql
alter table audit_log
  add column if not exists actor_user_id text,
  add column if not exists target_ref text,
  add column if not exists meta jsonb not null default '{}',
  add column if not exists level text not null default 'info';
  add column if not exists request_id text,
  add column if not exists route text,
  add column if not exists auth_mode text;
-- map user_id ← actor når uuid; behold actor_user_id til memory account ids (acc_*)
```

**AuditRecord (udvid meta-kontrakt, ikke nyt system):**

| Felt | Kilde |
|------|-------|
| actor | `accountId` / API key id |
| tenant | `tenant_id` |
| entity | `target_ref` = `journal/{id}`, `scan/{id}`, `sms/{id}` |
| before/after | kun safe metadata i `meta` (status, feltnavne — **ikke** fuld SOAP/CPR) |
| timestamp | `ts` / `at` |
| request context | `ip`, `user_agent`, `route`, `request_id` |

**Emit-krav P0:** journal create/patch/sign, scan process, bird send, secrets write, license change, login failure (allerede rate-limit — tilføj audit), consent record/revoke.

Production: `PRAXIS_AUDIT_MODE=supabase` **påkrævet** (fail-loud allerede hvis keys mangler i prod).

## D.2 `consent_events` (NY tabel)

**Findes ikke** i `0001`–`0004` (kun `clients.consent_level` enum-lignende text). Harness nævner `consent_events`, men writer/table mangler i dette træ.

**Migration `0006_consent_events.sql` (forslag):**

```sql
create table consent_events (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  client_id       uuid references clients(id) on delete set null,
  event_type      text not null
    check (event_type in (
      'granted', 'revoked', 'opt_out', 'superseded'
    )),
  purpose         text not null
    check (purpose in (
      'treatment', 'journal', 'photo_capture', 'ai_processing',
      'sms_transactional', 'sms_marketing', 'patient_guidance', 'research'
    )),
  consent_version text not null,          -- fx "bypilar-onboarding-v1"
  channel         text not null           -- web_onboarding | clinic_desk | sms_link | api
    check (channel in ('web_onboarding','clinic_desk','sms_link','api','import')),
  evidence        jsonb not null default '{}',  -- checkbox set, ip, user_agent, staff_id — no raw CPR
  effective_at    timestamptz not null default now(),
  revoked_at      timestamptz,
  actor_user_id   text,
  created_at      timestamptz not null default now()
);

create index on consent_events (tenant_id, client_id, purpose, effective_at desc);
alter table consent_events enable row level security;
-- same tenant isolation policy pattern as 0001
```

**Lib:** `lib/consent.ts`

- `recordConsentEvent(...)` → insert + `auditLog("consent.recorded", ...)`
- `hasActiveConsent({ tenant, clientId, purpose, at? })` → latest grant uden senere revoke/opt_out
- `assertConsent(...)` → kaster/returnerer `{ ok:false, error:"consent_required" }`

Map eksisterende `ClientProfile.consentLevel`:

| consentLevel | Implicit purposes (kun indtil events backfilles) |
|--------------|--------------------------------------------------|
| `Almindelig` | `treatment`, `sms_transactional` |
| `Sundhedsdata` | + `journal`, `photo_capture`, `ai_processing` |
| `Forskning` | + `research` |

P0: nye grants skrives som events; legacy level bruges som **fallback** med audit-warn, derefter kræv events for photo/SMS-marketing/AI.

## D.3 Enforcement points (BEFORE handling)

| Handling | Gate | Route / call-site |
|----------|------|-------------------|
| SMS transactional | `sms_transactional` | `app/api/bird/send`, agent approval SMS |
| SMS marketing | `sms_marketing` + owner | approvals `messages.send_marketing_sms`, bird send |
| Photo upload / scan | `photo_capture` | `app/api/v1/scan/process` **før** `ariaOrchestrator.dispatch` |
| AI-processing (SOAP draft, scan AI) | `ai_processing` | `journal/[id]/draft`, scan process, agents der rører journal |
| Patient guidance (fremtidige flows) | `patient_guidance` | **Ikke implementér chat nu** — læg hook i `lib/consent.ts` så senere features kalder samme assert |

Onboarding UI (`app/t/[tenant]/onboarding/page.tsx`) har allerede checkboxes — P0: POST dem til API der kalder `recordConsentEvent` (lille endpoint eller existing client create).

---

# E. Testplan

Minimum (Vitest + evt. route integration). Byg videre på `tests/request-auth.test.ts` og `tests/regulatory/audit-wiring.test.ts` hvis til stede.

| # | Case | Assert |
|---|------|--------|
| T1 | Unauth rejected | `GET /api/journal` uden cookie → 401; `GET /api/v1/bypilar/clients` uden auth → 401; `POST /api/bird/send` → 401 |
| T2 | Tenant A ↛ B | Session `bypilar` må ikke `GET` journal/clients for `nordlys` → 403 `tenant_mismatch`; spoofed `x-praxis-tenant: nordlys` uden cookie → 401 (ikke 200) |
| T3 | Reception limits | Role `reception`: må bookings/clients read; **ikke** `journal.sign`, **ikke** `scan/process`, **ikke** bird config POST, **ikke** license change → 403 `insufficient_role` |
| T4 | Audit on journal/scan/SMS | Efter sign/process/send med `PRAXIS_AUDIT_MODE=memory`: `_readMemorySink()` indeholder events; med supabase-mode: row i `audit_log` (integration) |
| T5 | Missing consent blocks | Client uden `photo_capture` → `POST /api/v1/scan/process` → 403 `consent_required` **før** provider-kald; uden `sms_marketing` → marketing send blokeret; uden `ai_processing` → draft blokeret |
| T6 | Public booking intact | Uden cookie: `GET services` 200; `POST bookings` 201 for bypilar test payload |
| T7 | `/api/auth/me` | Efter login cookie: 200 med `tenant`/`role`; `fetchStaffSession()` non-null |
| T8 | Worker fail-closed | `NODE_ENV=production` + unset `AGENT_WORKER_SECRET` → tick 503/401 (ikke open) |

---

# F. Implementation order

Små mergeable commits. **Booking-flow regressiones-testes i hvert commit der rører `v1/[tenant]/bookings|services|availability`.**

| Commit | Formål | Filer | Test | Acceptance | Rollback-risiko |
|--------|--------|-------|------|------------|-----------------|
| **F1** | `GET /api/auth/me` + dokumentér session-kontrakt | `app/api/auth/me/route.ts`, evt. lille test | me 401/200 | `fetchStaffSession` virker mod running app | Lav |
| **F2** | Middleware strip+inject `x-praxis-*` + `lib/api-guard.ts` + udvid `authorizeTenantRequest` (cookie resolve) | `middleware.ts`, `lib/api-guard.ts`, `lib/request-auth.ts`, `tests/request-auth.test.ts` | unit spoof/header | Spoofed headers alene ≠ auth | Lav–middel (middleware matcher) |
| **F3** | Guard journal + from-booking + sign/draft | `app/api/journal/**` | T1,T2,T3 journal | Uauth 401; reception kan ikke sign | Middel — staff UI skal sende cookies (allerede) |
| **F4** | Guard clients + bookings/list via `requireTenantAccess` (erstat lokal checkAuth) | `app/api/v1/[tenant]/clients`, `.../bookings/list` | T1,T2 | Bearer bruger ægte `verifyApiKey` | Middel — eksterne API-clients skal have gyldige keys |
| **F5** | Guard bird/scan secrets/license/tenant setup/agents status|run|approvals | `app/api/bird/**`, `scan/config`, `license`, `tenant/setup`, `agents/*` | T1,T3 | Secrets POST kræver owner | Middel |
| **F6** | Public booking kit (CORS allowlist + rate-limit) **uden** login-krav | `bookings/route.ts`, `services`, `availability`, `lookup`, `voucher` | T6 | by Pilar book stadig 201 | **Høj hvis CORS for streng** — start med log-only allowlist warn |
| **F7** | Consent lib + migration `0006` + gates på scan/SMS/AI-draft | `lib/consent.ts`, `supabase/migrations/0006_*.sql`, call-sites | T5 | Blok uden consent | Middel |
| **F8** | Audit align migration `0005` + request context + wire emits | `lib/audit.ts`, migration, journal/scan/SMS routes | T4 | `PRAXIS_AUDIT_MODE=supabase` virker mod schema | Middel |
| **F9** | Additive `docker-compose.db.yml` + scripts + `.env.production.example` docs (mock forbudt i prod) | compose/scripts/env example, evt. fail-fast i `lib/supabase.ts` | compose config validate | Fil findes på main; ingen hemmeligheder i git | Lav |
| **F10** | Cutover runbook + memory/JSON import script | `docs/ops/…`, `scripts/migrate-*-to-pg.ts` | dry-run mod lokal PG | Michael kan køre §C på Hetzner | **Manuel** — høj ops-risiko, lav kode-risiko |

**Anbefalet merge-rækkefølge:** F1→F2→F3→F4→F6 (beskyt booking midt i auth-rullen)→F5→F7→F8→F9→F10.

### Continue-dev (PR #34 · oven på F4–F10)

| Commit | Formål | Status |
|--------|--------|--------|
| **F11** | Middleware strip spoofable `x-praxis-*` | Done |
| **F12** | Agent worker/cron fail-closed in production | Done |
| **F13** | MCP `verifyApiKey` + tenant-from-key | Done |
| **F14** | CI typecheck + vitest | Done |
| **F15** | Orphan cleanup FootScan/SwarmPanel | Done |
| **F16** | `/api/health` ← `assertProductionDbConfig` | Done |
| **F17** | Onboarding → `POST …/consent` → `recordConsentEvent` | Done |
| **F18** | Audit supabase-mode + request-context tests | Done |
| **F19** | `GET /api/events` staff-gated | Done |
| **F20** | `GET /api/agents/workflows` staff-gated | Done |
| **F21** | CODE-MAP accuracy | Done |
| **F22** | Lookup/voucher isolated stricter rate-limit | Done |
| **F23** | Audit request context on tenant setup / license / scan process | Done |
| **F24** | Staff-gate `GET /api/v1/scan/process` + license GET tenant scope | Done |
| **F25** | Signup audit (`signup.success` / `.failure` / `.rate_limited`) | Done |
| **F26** | Health `detail` secrets redaction (`sanitizeHealthDetail`) | Done |
| **F27** | Operator checklist linking #33+#34 + cutover | Done |
| **F28** | Middleware strip identity headers edge cases | Done |
| **F29** | `authorizeTenantRequest` / guard usage audit (grep + tests) | Done |
| **F30** | Journal from-booking auth tests + audit context | Done |
| **F31** | Remaining mutation audit context (bird/scan/SMS/clients) | Done |
| **F32** | CVR / DAWA per-IP rate-limit | Done |
| **F33** | Strip key hints from public bird/scan config GET | Done |
| **F34** | Signup captcha step-up (login-parity threshold) | Done |
| **F35** | Journal mutation audit request context | Done |
| **F36** | Bird `/api/bird/status` strips `keyHint` | Done |
| **F37** | Login captcha-before-backoff (signup parity) | Done |
| **F38** | CODE-MAP refresh for F23–F37 | Done |
| **F39** | Operator checklist smoke refresh (F31–F38) | Done |
| **F40** | Agents approvals `approval.decided` audit context | Done |
| **F41** | Research / swarm / orchestrator → `requireTenantAccess` | Done |
| **F42** | Real Turnstile/hCaptcha verify (flagged; prod fail-closed stub) | Done |
| **F43** | Consent route `auditLogWithContext` | Done |
| **F44** | Public GET rate-limit bird/scan config status | Done |
| **F45** | Agents/run audit request context | Done |
| **F46** | Remaining `decodeSession` stragglers (prime missions) | Done |
| **F47** | Operator checklist update for F23–F40 (+ F41–F48) | Done |
| **F48** | Lookup/voucher remaining gaps (email/code validate, no memberId) | Done |
| **F49** | CODE-MAP + `.env.example` captcha docs (F41–F54) | Done |
| **F50** | `GET /api/auth/me` → `sessionFromRequest` + `auth.me` audit | Done |
| **F51** | Public GET rate-limit services / availability | Done |
| **F52** | Prime missions `auditLogWithContext` | Done |
| **F53** | Cron swarm-tick audit context | Done |
| **F54** | Checklist / PEC wiring for F49–F54 | Done |
| **F55** | Logout `logout.success` audit context | Done |
| **F56** | Agents/status `agent.status_viewed` audit | Done |
| **F57** | Health GET generous rate-limit | Done |
| **F58** | Logout/status/health PEC + F29 marker hygiene | Done |
| **F59** | MCP public surface rate-limit (initialize/ping/tools/list + GET) | Done |
| **F60** | Embed hardening (`/embed/v1` CORS align + RL + postMessage origin) | Done |
| **F61** | Operator checklist update for F49–F58 (+ F59–F64 smoke) | Done |
| **F62** | Mutation-route audit gaps → `auditLogWithContext` | Done |
| **F63** | Captcha sitekey UI skipped without keys; env placeholders + helper | Done |
| **F64** | Stragglers: MCP CORS allowlist, swarm/research/orchestrator audits | Done |
| **F65** | Services/availability CORS align with booking allowlist | Done |
| **F66** | Swarm/tick + research harvest `auditLogWithContext` | Done |
| **F67** | MCP unauthorized audit on bad Bearer | Done |
| **F68** | Agent worker auth → `auditLogWithContext` | Done |
| **F69** | Strip ACAO `*` from staff clients + bookings/list | Done |
| **F70** | Staff list audits (`booking.list_viewed` / `client.list_viewed`) | Done |
| **F71** | Plan/CODE-MAP hygiene for F65–F70 | Done |
| **F72** | Strip ACAO `*` from CVR/DAWA proxies | Done |
| **F73** | Middleware security headers (nosniff/referrer/frame; embed frameable) | Done |
| **F74** | Checklist coverage for F65–F73 | Done |
| **F75** | MCP `tools/call` → `mcp.tools_call` audit | Done |
| **F76** | Research paper GET → `research.paper_viewed` audit | Done |

**Explicit out of scope for disse commits:** patient-chat, triage, nye AI-agents, LiveKit voice-consent audio, CE/MDR features, LoRA.

---

## Appendix · Manuel checklist til Michael

1. SSH til Hetzner · bekræft `docker compose ps` for `praxisos_app`.
2. Vælg DB-strategi (self-host vs. unpause cloud Supabase).
3. Udfyld secrets i `.env.production` (session, DB, audit, worker) — **ikke** commit.
4. Efter F9: start `docker-compose.db.yml`, kør migrations.
5. Efter F10: import journal-store; skift `PRAXIS_DB`; verify `/api/health`.
6. Smoke by Pilar booking på `bypilar.dk` / embed.
7. Bekræft Bird send kræver login + consent i staging før prod-enforce hard-block.

---

*Dokumentversion: P0 plan · Secure Clinical Core · genereret fra faktisk `main`-træ + briefing-reference. Ingen implementation af AI-patientfeatures.*
