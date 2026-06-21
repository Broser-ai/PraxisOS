# PraxisOS – System Brief

> Genereret 2026-06-16 fra evidens i `prototype/PraxisOS-Forarbejde.docx`,
> `01-research-og-mvp-plan.md`, og selve kodebasen under `prototype/`.
> Påstande er kun medtaget hvis de optræder i dokumenterne eller i koden.
> Manglende information er markeret `NOT SPECIFIED`.

---

## 1. PURPOSE

PraxisOS er **klinikkens operativsystem — et state-of-the-art booking- og praksis-styringssystem til det brede sundheds-/wellness-marked** (terapeuter, klinikker, fysioterapeuter, psykologer, æstetik/skønhed og felt-service sundhed) (`01-research-og-mvp-plan.md`, line 3). Det løser EasyPractice's tre kerne-mangler i EU/DK-markedet: ingen native AI, ingen AR/CV-journalisering, og ingen felt-service-mobilitet — alt samlet på én EU-data-resident, GDPR Art. 9-compliant og MitID-integreret platform (`01-research-og-mvp-plan.md`, line 12-19).

## 2. TYPE

**(b) Software-system/app med logins og data — multi-tenant SaaS.**

Evidens:
- Schema i `prototype/supabase/migrations/0001_initial_schema.sql` definerer 18 tabeller (tenants, users, memberships, services, clients, bookings, journals, journal_entries, scans, payments, vouchers, subsidy_schemes, reports, events, audit_log, module_activations, api_keys, webhook_subscriptions) med Row-Level Security policies.
- `prototype/app/login/*` indeholder login-flows for MitID, passkey, og password-reset.
- Forarbejde-dokumentet beskriver `/signup` flow, multi-tenant arkitektur, og at "by Pilar er markeret som trial-tenant" (line 4).
- `prototype/lib/auth.ts`, `lib/api-keys.ts`, `lib/rate-limit.ts` viser sessions-, API-key- og access-kontrol-logik.
- Indeholder også offentlige sider (`app/page.tsx` landing, `app/pricing/page.tsx`, `app/about/page.tsx`) — men disse er salgs-/marketing-flader til det underliggende SaaS-produkt, ikke kerneproduktet.

## 3. USERS & ROLES

Fire roller defineret eksplicit i `0001_initial_schema.sql` (memberships.role CHECK constraint):

| Rolle | Hvad de gør (fra kode/docs) |
|-------|------------------------------|
| **owner** | NOT SPECIFIED i detaljer — implicit klinik-ejer der har fuld kontrol over tenanten |
| **practitioner** | Behandler · skriver journal · ser bookings · godkender AI-scribe (`journal_entries.ai_approved_at`, `journal_entries.author_id`) |
| **reception** | NOT SPECIFIED i detaljer — implicit administrativ rolle i klinikken |
| **support** | Cross-tenant adgang via RLS-policy (`current_setting('app.role') = 'support'`) — sandsynligvis PraxisOS-internt personale |

Yderligere brugertyper nævnt i kode/docs:
- **Klienter / patienter** — bookes via `/t/[tenant]/book`, har portal på `/t/[tenant]/portal`, kan se "Min Log" og bruge MitID-login (`app/login/mitid/page.tsx`, `CprMatch` flow)
- **Tenant-admin / klinik-ejer** — tilkøber moduler via `/admin/marketplace`, ser stats via `/admin/health`, håndterer staff
- **PraxisOS-personale** — har support-rolle, kan se alle tenants

9 humaniserede AI-agenter optræder også i `lib/agents.ts` (Aria, Niels, Sigrid, Magnus, Frej, Vega, Bjørn, Liv, Atlas) — de er ikke menneskelige brugere men autonome aktører i systemet.

## 4. DATA

> Den 4. opgave-prompt blev afkortet i input — jeg har tolket den som "hvilke data lagrer systemet?". Hvis spørgsmålet egentlig var noget andet, sig til.

Systemet lagrer disse data-kategorier (kilde: `prototype/supabase/migrations/0001_initial_schema.sql`):

**Tenant-data**
- `tenants` — slug, juridisk navn, CVR, brand-info (JSONB), domæner, license-plan, kontakt, trial-status
- `module_activations` — hvilke moduler hver tenant har aktive (trial/active/paused/cancelled)
- `api_keys` — pr.-tenant API-keys med scopes og rate-limits
- `webhook_subscriptions` — tenant-konfigurerede event-webhooks

**Brugere & adgang**
- `users` — email, navn, password_hash, **mitid_subject**, **cpr_hashed** (aldrig raw CPR), 2FA-status
- `memberships` — user × tenant × role

**Klinisk drift**
- `services` — udbudte ydelser pr. tenant (varighed, pris, kategori, modalities)
- `clients` — patienter: navn, kontakt, CPR-hash + CPR-masked til UI, samtykke-level, MitID-verifikation
- `bookings` — aftaler med starts_at/ends_at, modality (Klinik/Hjemmebesøg/Video), status, pris, no-show-risk
- `journals` + `journal_entries` — SOAP-noter (subjective/objective/assessment/plan), ICD-10 koder, AI-drafted flag, hash-chain audit, **pgvector embeddings** (1536-dim) til semantisk søgning
- `scans` — 3D foot scans, skin scans, body scans · biomarkers i JSONB · mesh-URL · thumbnails

**Økonomi**
- `payments` — beløb, fee, net-til-tenant, metode, risiko-score, captured/settled
- `vouchers` — klippekort + gavekort med sessions/balance, udløb, status
- `subsidy_schemes` — tilskuds-ordninger pr. klient (Sygesikringen "danmark", offentligt, helbredstillæg)
- `reports` — indberetninger til myndigheder (MedCom/EDI/KOMBIT-format, payload i JSONB)

**Audit & compliance**
- `events` — eventbus (type, data, tenant_id, sequence)
- `audit_log` — hash-chained log over hvem har set hvilken patient (target_cpr_hashed, action, IP, geo, user_agent, prev_hash, hash)

**Multi-tenant isolation**
- Alle tenant-data har `tenant_id uuid` og RLS-policy `tenant_id = current_setting('app.tenant_id')::uuid`. Cross-tenant leak er strukturelt umuligt.

**Regulatorisk**
- GDPR Art. 9 (særligt følsomme sundhedsdata) (`01-research-og-mvp-plan.md` line 19)
- EU-data-residens — Supabase i `eu-west-1` (Ireland) jf. seedet projekt (`mcp__supabase__list_projects` resultat)
- Audit-log hash-chain visualiseres som "Min Log" for patient på sundhed.dk

---

## Tech-stack (uden for de 4 spørgsmål, til kontekst)

Fra `prototype/package.json`, `vercel.json`, `next.config.mjs`:
- **Next.js 16.2.7** (App Router, Turbopack) · **React 19.2.7** · **TypeScript 5.7.3**
- **Tailwind v4.3.0**
- **Supabase EU** (Postgres 17 + pgvector + RLS) · region `eu-west-1`
- Deployed til **Vercel** (region `fra1` · Frankfurt) på `https://praxis-os-mu.vercel.app`
- Repo: `github.com/Broser-ai/PraxisOS` (privat)

## Status (fra docx, line 4)

> "Koden er ~85% færdig. Build er clean, 43/43 ruter returnerer 200, by Pilar er markeret som trial-tenant (gratis ubegrænset), public landing + signup-flow + pricing er live på localhost. De sidste 15% kræver eksterne aftaler (Supabase EU, Stripe, MitID broker m.fl.) før de kan kodes færdigt."

## Trial-kunde (fra docx, line 127)

> "by Pilar (pilot-kunde) kører gratis i mellemtiden."

CVR `43947079` · seedet i prod-DB som tenant `aca1bcb9-7505-4c72-847a-375027ffb0e1` med `trial.unlimited = true` og alle 11 moduler aktive.

---

*Spørgsmål 4 var afkortet i prompten — hvis du ville have noget andet besvaret under "DATA"
(fx datakilder, dataflows, eller data-eksport), så sig til, så omskriver jeg sektionen.*
