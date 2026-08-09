# PraxisOS – System Brief

> Opdateret 2026-07-31 fra evidens i kodebasen (repo-rod) + `HANDOVER.md`.
> Påstande er kun medtaget hvis de optræder i dokumenterne eller i koden.
> Manglende information er markeret `NOT SPECIFIED`.

---

## 1. PURPOSE

PraxisOS er **klinikkens operativsystem — et state-of-the-art booking- og praksis-styringssystem til det brede sundheds-/wellness-marked** (terapeuter, klinikker, fysioterapeuter, psykologer, æstetik/skønhed og felt-service sundhed). Det løser EasyPractice's tre kerne-mangler i EU/DK-markedet: ingen native AI, ingen AR/CV-journalisering, og ingen felt-service-mobilitet — alt samlet på én EU-data-resident, GDPR Art. 9-compliant og MitID-integreret platform.

## 2. TYPE

**(b) Software-system/app med logins og data — multi-tenant SaaS.**

Evidens:
- Schema i `supabase/migrations/0001_initial_schema.sql` definerer 18 tabeller med Row-Level Security policies.
- `app/login/*` indeholder login-flows for MitID, passkey, og password-reset.
- `app/api/signup` + `/signup` opretter nye tenants (mock in-memory; Supabase når env er sat).
- `lib/auth.ts`, `lib/api-keys.ts`, `lib/rate-limit.ts` viser sessions-, API-key- og access-kontrol-logik.
- Offentlige sider (`app/page.tsx`, `app/pricing/page.tsx`, `app/about/page.tsx`) er salgs-/marketing-flader til SaaS-produktet.

## 3. USERS & ROLES

Fire roller defineret eksplicit i `0001_initial_schema.sql` (memberships.role CHECK constraint):

| Rolle | Hvad de gør (fra kode/docs) |
|-------|------------------------------|
| **owner** | Klinik-ejer · fuld kontrol over tenanten |
| **practitioner** | Behandler · skriver journal · ser bookings · godkender AI-scribe |
| **reception** | Administrativ rolle i klinikken |
| **support** | Cross-tenant adgang via RLS-policy — PraxisOS-internt personale |

Yderligere brugertyper:
- **Klienter / patienter** — bookes via `/t/[tenant]/book`, portal på `/t/[tenant]/portal`
- **Tenant-admin / klinik-ejer** — tilkøber moduler via `/admin/marketplace`
- **PraxisOS-personale** — support-rolle (`emil@support.praxis.app`)

9 humaniserede AI-agenter i `lib/agents.ts` (Aria, Niels, Sigrid, Magnus, Frej, Vega, Bjørn, Liv, Atlas).

## 4. DATA

Systemet lagrer disse data-kategorier (kilde: `supabase/migrations/0001_initial_schema.sql`):

**Tenant-data** — tenants, module_activations, api_keys, webhook_subscriptions  
**Brugere & adgang** — users (mitid_subject, cpr_hashed), memberships  
**Klinisk drift** — services, clients, bookings, journals/journal_entries (SOAP + pgvector), scans  
**Økonomi** — payments, vouchers, subsidy_schemes, reports  
**Audit & compliance** — events, audit_log (hash-chained)

**Multi-tenant isolation** — RLS `tenant_id = current_setting('app.tenant_id')::uuid`.

**Regulatorisk**
- GDPR Art. 9 (særligt følsomme sundhedsdata)
- EU-data-residens — Supabase `eu-west-1` (Ireland) · Vercel edge `fra1` (Frankfurt)
- Audit-log hash-chain visualiseres som "Min Log" for patient

---

## Tech-stack

Fra `package.json`, `vercel.json`, `next.config.mjs`:
- **Next.js 16.2.12** (App Router, Turbopack) · **React 19** · **TypeScript 5.7**
- **Tailwind v4**
- **Supabase EU** (Postgres 17 + pgvector + RLS) · region `eu-west-1`
- Deployed til **Vercel** (region `fra1`) på `https://praxis-os-mu.vercel.app`
- Repo: `github.com/Broser-ai/PraxisOS` (privat) — kode i **repo-rod**

## Status

> Build er clean. ~60 pages + 15 API-routes. by Pilar er markeret som trial-tenant (gratis ubegrænset). Public landing + signup-flow + pricing er live. Produktion kører stadig i mock-mode indtil Vercel env-vars sættes. De sidste integrationer kræver eksterne aftaler (MitID broker, Stripe, MedCom m.fl.).

## Trial-kunde

> by Pilar (pilot-kunde) kører gratis i mellemtiden.

CVR `43947079` · seedet som tenant med `trial.unlimited = true` og alle 11 moduler aktive.
