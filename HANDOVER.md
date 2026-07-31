# PraxisOS · Complete Handover

> **Status pr. 2026-07-31** · Single-source-of-truth for hele systemet.
> Hvis du tager dette dokument + repo'et på `github.com/Broser-ai/PraxisOS`,
> kan en ny udvikler tage over uden at spørge til noget.
>
> **Vigtigt:** Al kode ligger i **repo-roden** — der er ingen `prototype/`-mappe.

---

## 0 · TL;DR (60 sekunder)

| Hvad | Hvor | Status |
|------|------|--------|
| **Produktion-URL** | https://praxis-os-mu.vercel.app | ✓ LIVE · 200 OK |
| **GitHub-repo** | https://github.com/Broser-ai/PraxisOS | ✓ privat · pushed |
| **Vercel-projekt** | `prj_hxngix2sxpmKAkwA0pUvUyOBkldj` (`praxis-os`) | ✓ deployed |
| **Supabase-projekt** | `jajdtvduzkitjzcazcng` (eu-west-1 · Ireland) | ✓ 18 tabeller + RLS + seedet |
| **Trial-kunde** | by Pilar (CVR 43947079, alle 11 moduler, 0 kr/md) | ✓ live i DB |
| **Demo-kunde** | Nordlys Klinik ApS | ✓ live i DB |
| **Build-status** | clean · TypeScript pass · 60 pages + 15 API (~75 routes) | ✓ |
| **Næste blocker** | Env-vars ikke sat i Vercel (kører i mock-mode) | ⏳ 90 sek manuelt arbejde |

---

## 1 · Executive Summary

**PraxisOS** er klinikkens operativsystem — et state-of-the-art booking-, journal- og praksis-styringssystem for det brede sundheds-/wellness-marked. Det er bygget i Danmark for dansk sundhedsvæsen, med 9 humaniserede AI-agenter (Aria, Niels, Sigrid, Magnus, Frej, Vega, Bjørn, Liv, Atlas), MitID-login, DAWA-adressevalidering, CVR-lookup, MedCom-afregning og PraxisOS Pay (egen-built payment-engine).

**Kerne-differentiering vs. EasyPractice**: native AI (scribe, voice-receptionist, no-show prediktor), AR/CV journalisering, foot-only Physical AI scanning, og felt-service modul. **Alt EU-data-resident · GDPR Art. 9 compliant · MitID fra dag ét.**

Forretningsmodellen er multi-tenant SaaS med modulær prissætning:
- **Starter** 0 kr/md (trial · 200 bookings)
- **Practice** 595 kr/md (3 seats · ubegrænset)
- **Practice + AI** 1.295 kr/md (+ Aria, Niels, Sigrid)
- **Enterprise** custom
- Plus per-brug fees: PraxisOS Pay 1,45% + 0,50 kr · MitID 0,80 kr/login · NemSMS 0,18 kr/sms · AI Scribe 3 kr/session

By Pilar er pilot-kunde og kører **gratis ubegrænset** (markeret med `trial.unlimited = true` i `lib/tenants.ts` og i DB).

---

## 2 · System Architecture

### 2.1 · High-level

```
┌──────────────────────────────────────────────────────────────────┐
│                       BROWSER (klient/staff)                      │
│  Tenant-frontend     Klinik-admin       Public landing            │
│  /t/[slug]/*         /admin/*           / /pricing /signup        │
└──────────────────────────────┬──────────────────────────────────-─┘
                               │ HTTPS
                ┌──────────────▼───────────────┐
                │     Vercel Edge · Frankfurt   │
                │     (Next.js 16 + Fluid       │
                │      Compute · Node 24)       │
                └──────────────┬───────────────┘
                               │
   ┌───────────────────────────┼──────────────────────────────┐
   │                           │                              │
┌──▼──────────┐  ┌─────────────▼──────┐  ┌────────────────────▼──┐
│  Supabase   │  │ External · MitID    │  │ External (later)      │
│  Postgres 17│  │ DAWA, CVR-API       │  │ Stripe, Idura,        │
│  eu-west-1  │  │ Idura broker        │  │ Bird.com, MedCom      │
│  + pgvector │  │ NSP/FMK             │  │                       │
│  + RLS      │  └─────────────────────┘  └───────────────────────┘
└─────────────┘
```

### 2.2 · Tech-stack

| Lag | Teknologi | Version |
|-----|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.2.7 |
| Runtime | React | 19.2.7 |
| Sprog | TypeScript | 5.7.3 |
| Styling | Tailwind v4 | 4.3.0 |
| Database | Postgres (Supabase) | 17.6.1 |
| Vector-search | pgvector | inkluderet |
| Auth-broker | Idura Verify (tidl. Criipto / Signaturgruppen) | — |
| Region | EU (`eu-west-1` Supabase · `fra1` Vercel) | — |
| Node | 24.x | LTS |

### 2.3 · Multi-tenant model

Hver tenant er **strukturelt isoleret** via Postgres Row-Level Security:

```sql
CREATE POLICY services_isolation ON services FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

Inden hver request sætter backend:
```sql
SET LOCAL app.tenant_id = '<tenant-uuid>';
SET LOCAL app.role = 'practitioner';
```

15 ud af 18 tabeller har RLS. De 3 undtagelser (`tenants`, `users`, `memberships`) har separate policies der tillader specifik adgang (anon kan læse tenant-info via slug, authenticated kan se egen user/memberships).

**Cross-tenant data-leak er strukturelt umuligt** — selv hvis backend-kode glemmer at filtrere på `tenant_id`, blokkerer Postgres requesten.

### 2.4 · Modes (`PRAXIS_DB` env-var)

| Mode | Hvad det er |
|------|-------------|
| `mock` | In-memory data fra `lib/*.ts` (default · default for prototyping) |
| `supabase-local` | Lokal Supabase via `supabase start` (Docker) |
| `supabase-eu` | Produktion · Frankfurt/Ireland |

Switcher i `lib/supabase.ts:13-15`. Defensive parsing fanger whitespace eller ukendte værdier og falder tilbage til `mock`.

---

## 3 · Repository Structure

```
PraxisOS/                              ← repo-rod = hele kodebasen
│
├── HANDOVER.md                        ← du er her
├── PRAXISOS-BRIEF.md                  ← system-brief (kort intro)
├── CODE-MAP.md                        ← fil-for-fil oversigt
├── PRODUCTION.md                      ← deployment-runbook
├── README.md                          ← lokal dev guide
├── .env.example                       ← env-skabelon (committed)
├── .env.local                         ← faktiske keys (gitignored)
├── package.json
├── next.config.mjs
├── vercel.json                        ← Next.js framework pin + fra1
├── tsconfig.json
├── postcss.config.mjs
│
├── app/                               ← 60 pages + 15 API routes
│   ├── page.tsx                       ← / landing
│   ├── pricing/ · signup/ · about/
│   ├── not-found.tsx · error.tsx
│   ├── (internal)/                    ← Klinik-admin UI
│   │   ├── layout.tsx · page.tsx (→ /review)
│   │   ├── review/ · dashboard/ · kalender/
│   │   ├── klienter/[id]/ · bookings/[id]/
│   │   ├── scribe/ · agent/ · chat/
│   │   ├── scan/start/ · felt/ · indstillinger/
│   │   └── admin/                     ← 28 admin-sider inkl. /health
│   ├── t/[tenant]/                    ← Tenant-frontend (brandet)
│   ├── login/                         ← Auth (standard · mitid · passkey · reset)
│   ├── r/[id]/                        ← Patient-reservation
│   ├── demo/bypilar-website/
│   ├── api/
│   │   ├── signup/route.ts            ← Tenant-signup (mock + klar til Supabase)
│   │   ├── auth/login|logout/
│   │   ├── cvr/lookup/ · dawa/autocomplete/
│   │   ├── events/ · mcp/v1/
│   │   └── v1/[tenant]/…              ← Public tenant API
│   └── embed/v1/[tenant]/             ← JS-embed-snippet
│
├── components/                        ← 14 delte UI-komponenter
├── lib/                               ← 19 modul-files (data + logic)
├── supabase/migrations/
│   └── 0001_initial_schema.sql        ← 18 tabeller + RLS + triggers
└── scripts/
    └── generate_forarbejde_docx.py    ← genererer Word-checklist (gitignored output)
```

> Eksterne research-docs (`01-…md` … `04-…md`) og `PraxisOS-Forarbejde.docx` ligger **uden for** dette repo (lokalt hos owner / sendt separat).

---

## 4 · Database Schema (18 tabeller)

Migrationen `supabase/migrations/0001_initial_schema.sql` har følgende struktur. Alle tabeller kører på Postgres 17 i Supabase EU-west-1.

### Core (3 tabeller)
| Tabel | Formål | RLS | Vigtige felter |
|-------|--------|-----|---------------|
| `tenants` | Klinikker · 1 row = 1 SaaS-kunde | ✓ (slug/role) | slug, legal_name, cvr, brand (jsonb), domains, mode, license (jsonb), trial (jsonb) |
| `users` | Brugere (alle tenants samlet) | ✓ (self) | email, password_hash, mitid_subject, cpr_hashed |
| `memberships` | User × Tenant × Role | ✓ (self) | role (owner/practitioner/reception/support) |

### Klinisk drift (5 tabeller)
| Tabel | Formål | RLS |
|-------|--------|-----|
| `services` | Klinikkens ydelser | ✓ tenant_id |
| `clients` | Patienter | ✓ tenant_id |
| `bookings` | Aftaler | ✓ tenant_id |
| `journals` + `journal_entries` | SOAP-noter med ICD-10, embeddings (1536-dim pgvector), audit-hash | ✓ tenant_id |
| `scans` | 3D fod/skin/body-scan med biomarkers (jsonb) | ✓ tenant_id |

### Økonomi (4 tabeller)
| Tabel | Formål | RLS |
|-------|--------|-----|
| `payments` | Transaktioner · PraxisOS Pay | ✓ tenant_id |
| `vouchers` | Klippekort (`clip`) + gavekort (`gift`) | ✓ tenant_id |
| `subsidy_schemes` | Tilskudsordninger per klient | ✓ tenant_id |
| `reports` | Indberetning til myndigheder | ✓ tenant_id |

### Platform (6 tabeller)
| Tabel | Formål | RLS |
|-------|--------|-----|
| `events` | Eventbus (type + jsonb data) | ✓ tenant_id |
| `audit_log` | Hash-chained log · "Min Log" | ✓ tenant_id |
| `module_activations` | Hvilke moduler tenant har | ✓ tenant_id |
| `api_keys` | API-keys per tenant | ✓ tenant_id |
| `webhook_subscriptions` | Tenant-webhooks | ✓ tenant_id |

### Triggers
- `set_updated_at` på tenants/clients/bookings
- `audit_hash_chain` · SHA-256(tenant_id|action|target|at|prev_hash)

### Extensions
- `uuid-ossp` · UUID v4
- `pgcrypto` · digest()
- `vector` · pgvector

### Live state efter seeding
```
tenants:            2 rows  (bypilar trial · nordlys active)
services:           9 rows  (5 bypilar + 4 nordlys)
module_activations: 18 rows (11 bypilar trial + 7 nordlys active)
clients:            0 rows  (TBD)
bookings:           0 rows  (TBD)
[øvrige]:           0 rows
```

---

## 5 · Routes (60 pages + 15 API ≈ 75 endpoints)

### 5.1 · Public marketing (4)
- `/` · landing med hero, værdier, modul-grid, CTA
- `/pricing` · 4 planer + per-brug-fees
- `/signup` · 3-trins flow (CVR-lookup → kontakt → plan)
- `/about` · manifesto + kontakt

### 5.2 · Auth (4)
- `/login` · email/password + magic-link options
- `/login/mitid` · OIDC-flow med 5 phases (initiating/broker/app-confirm/cpr-match/success)
- `/login/passkey` · WebAuthn
- `/login/reset` · password-reset

### 5.3 · Klinik-internt (12) · alle under `(internal)/`
- `/review` · guided tour (default landing efter login)
- `/dashboard` · key-metrics
- `/kalender` · uge/dag-view
- `/klienter` · liste · `/klienter/[id]` detalje
- `/bookings` · liste · `/bookings/[id]` detalje
- `/scribe` · AI-scribe interface
- `/agent` · agent-panel (Aria · receptionist)
- `/chat` · team-chat
- `/scan` · scan-liste · `/scan/start` ny scan (3-view)
- `/felt` · felt-service
- `/indstillinger`

### 5.4 · Admin (28) · alle under `(internal)/admin/`
| Route | Hvad |
|-------|------|
| `/admin/tenants` | Tenant-administration |
| `/admin/new-tenant` | Opret ny tenant |
| `/admin/payments` | PraxisOS Pay overview |
| `/admin/vouchers` · `[code]` | Klippekort/gavekort |
| `/admin/subsidies` | 9 tilskudsordninger |
| `/admin/reporting` | EDI/MedCom/KOMBIT |
| `/admin/api` | API-keys + webhooks |
| `/admin/nemsms` | NemSMS templates + opt-in |
| `/admin/agents` · `[id]` | Agent-team oversigt |
| `/admin/agents/frej/engine` | 8-trins compliance-pipeline |
| `/admin/agents/niels/pipeline` | AI-scribe pipeline |
| `/admin/agents/sigrid/engine` | Sygesikrings-engine |
| `/admin/sundhed-dk` | Trustaftale-status |
| `/admin/medcom` | MedCom-status |
| `/admin/mcp` | MCP-server status |
| `/admin/marketplace` · `[id]` · `/activate` | 20 moduler + activation-wizard |
| `/admin/dk-data` | 8 DK-datakilder |
| `/admin/database` | Supabase-status |
| `/admin/security` | Sikkerhed & adgang |
| `/admin/plan` | Klinikkens plan |
| `/admin/services` | Klinikkens services |
| `/admin/staff` | Personale |
| `/admin/integration/[tenant]` | Integrationer per tenant |
| `/admin/health` | System-status dashboard ⭐ |

### 5.5 · Tenant-frontend (5) · `t/[slug]/`
- `/t/bypilar` · branded landing
- `/t/bypilar/book` · 5-trins booking
- `/t/bypilar/portal` · klient-portal
- `/t/bypilar/onboarding` · ny tenant-setup
- `/t/bypilar/klippekort` · `/gavekort`

### 5.6 · Patient-reservation (2)
- `/r/[id]` · booking-bekræftelse til klient
- `/r/[id]/status` · status

### 5.7 · Demo (1)
- `/demo/bypilar-website` · embed-demo

### 5.8 · API endpoints (15)
| Path | Method | Hvad |
|------|--------|------|
| `/api/signup` | POST | Opret tenant + owner (mock in-memory; Supabase når env sat) |
| `/api/auth/login` | POST | Email/password |
| `/api/auth/logout` | POST | Session-clear |
| `/api/cvr/lookup` | GET | Proxy til cvrapi.dk · 7-dages cache |
| `/api/dawa/autocomplete` | GET | DAWA-adresser |
| `/api/events` | GET (SSE) | Event-stream |
| `/api/mcp/v1` | POST (JSON-RPC 2.0) | MCP-server · 19 tools |
| `/api/v1/[tenant]/availability` | GET | Ledige slots |
| `/api/v1/[tenant]/bookings` | POST | Opret booking |
| `/api/v1/[tenant]/bookings/list` | GET | Liste |
| `/api/v1/[tenant]/clients` | GET/POST | Klient-CRUD |
| `/api/v1/[tenant]/lookup` | POST | CPR-match |
| `/api/v1/[tenant]/services` | GET | Tenant's services |
| `/api/v1/[tenant]/voucher` | POST | Redeem klippekort |
| `/embed/v1/[tenant]` | GET | JS-snippet til kundens website |

---

## 6 · Lib Modules (19 filer · forretningslogik)

### Core data
- **`tenants.ts`** (201 LOC) — Tenant-type, ALL_MODULES, MODULE_LABELS, getTenant(), getTenantByDomain(), hasModule(), 2 seeds (bypilar + nordlys)
- **`mock.ts`** (177 LOC) — Master mock-objekter (clinic, practitioner, klient-eksempler)
- **`supabase.ts`** (126 LOC) — DB-mode switcher · DB_MODE · currentConfig · MIGRATIONS · TABLES
- **`scan.ts`** (139 LOC) — Foot-scan data · sensorer · biomarkers · `FEATURE_CAD_EXPORT=false`

### Auth & adgang
- **`auth.ts`** — Sessions · 5 demo-accounts (pilar, sofie, nadia, emil reception, emil support)
- **`api-keys.ts`** (165 LOC) — API-key prefix · hashed_secret · scopes
- **`rate-limit.ts`** (132 LOC) — IP + user sliding-window med exp backoff
- **`staff.ts`** (62 LOC) — Staff/rolle-management

### Booking + klinisk
- **`bookings.ts`** (228 LOC) — Booking-model · status-types · no-show-risk
- **`clients.ts`** (107 LOC) — 5 klient-profiler

### Økonomi
- **`payments.ts`** (211 LOC) — TENANT_PAYMENT_CONFIG · PaymentMethod (mobilepay/dankort/card/applepay/googlepay/klarna/swish/bank) · 9 metoder
- **`vouchers.ts`** (199 LOC) — Klippekort (sessions_total/remaining) + gavekort (balance_oere) · 3-års udløb
- **`subsidies.ts`** (252 LOC) — 9 ordninger: danmark_g1/g2/g5, offentlig_g1/g2, helbredstillaeg, diabetes, kronisk_p7, privat_forsikring

### DK-integrationer
- **`dk-data.ts`** (350 LOC) — 8 datakilder oversigt (MitID/DAWA/CVR/CPR/MedCom/FMK/NemSMS/danmark)
- **`reporting.ts`** (235 LOC) — EDI/MedCom/KOMBIT payload-builders
- **`nemsms.ts`** (197 LOC) — NemSMS templates · 6 kategorier (booking_bekraeftelse, paamindelse, ...) · opt-in matrix

### AI & automation
- **`agents.ts`** (450 LOC) — 9 humaniserede agenter med persona, voice, superpower, weakness:
  | # | Navn | Rolle | Superpower | Weakness |
  |---|------|-------|------------|----------|
  | 1 | **Aria** | AI-receptionist | Voice booking 24/7 | Mangler kontekst på komplekse cases |
  | 2 | **Niels** | AI-scribe | Whisper+ClinicalBERT SOAP-noter | 30s lag |
  | 3 | **Sigrid** | Sygesikrings-agent | 9-step automatisk afregning | EDI breaker hvis felt mangler |
  | 4 | **Magnus** | No-show prediktor | ML risk-score | Cold-start for nye klinikker |
  | 5 | **Frej** | Compliance/sikkerhed | 8-trins pipeline · anomali-detect | Konservativ · giver false positives |
  | 6 | **Vega** | Marketing | Kampagne-orkestration | Ikke regulering-aware |
  | 7 | **Bjørn** | Felt-service dispatch | ML-route-optimering | Vejr-data-blindspot |
  | 8 | **Liv** | Klient-relations | Re-engagement | Kan virke "for venlig" |
  | 9 | **Atlas** | Code-gen agent | Self-reflecting modul-build | Eksperimentel (sidste agent) |

- **`mcp-tools.ts`** (335 LOC) — 19 tools eksponeret via MCP (JSON-RPC 2.0):
  - **Booking**: list_bookings, create_booking, cancel_booking
  - **Klient**: get_client, search_clients, create_client
  - **Journal**: get_journal_entries, semantic_search_journal
  - **Tilskud**: check_subsidy_eligibility, submit_subsidy
  - **Indberetning**: create_medcom_report, list_pending_reports
  - **Voucher**: list_vouchers, create_voucher, redeem_voucher
  - **Payment**: list_payments, capture_payment
  - **Tenant**: get_tenant_info, list_active_modules

### Modul-marketplace
- **`modules.ts`** (623 LOC) — 20 moduler i 7 kategorier:
  | Kategori | Moduler |
  |----------|---------|
  | Core | Booking · Journal · Betaling · Kommunikation |
  | AI | Aria · Niels · Sigrid · Magnus · Frej · Vega · Bjørn · Liv |
  | DK-integration | MitID · DAWA · CVR · MedCom · FMK · NemSMS · danmark |
  | Klinisk | AR-journal · Fod-scan · Skin-scan |
  | Felt | Hjemmebesøg · Bjørn-dispatch |
  | Marketing | Vega-kampagner · Klippekort |
  | Insights | Magnus · Dashboard · Heatmaps |

  Hver modul har: `id, name, kategori, pris (subscription/usage/free), pris-detaljer, dependencies, gdpr-impact, status (live/stub/pending)`

---

## 7 · Components (14 stk)

| Component | LOC | Hvad |
|-----------|-----|------|
| `Sidebar.tsx` | 124 | Hovedmenu med Drift-sektion · 18 links |
| `Topbar.tsx` | 286 | Søg + notifikationer + user-menu |
| `TrialBanner.tsx` | 25 | "Trial · alt inkluderet · 0 kr/md" banner for bypilar |
| `FootScan.tsx` | 480 | Top/side/bottom-view interaktiv scan med biomarkør-overlays |
| `FootMesh3D.tsx` | 312 | Canvas-baseret 3D-rotation (no Three.js) |
| `SkinScan.tsx` | 96 | Æstetik-skanner til Nordlys |
| `AddressAutocomplete.tsx` | 145 | DAWA-powered med debounce |
| `CprMatch.tsx` | 92 | CPR-input → match mod MitID-fødselsdato |
| `CvrLookup.tsx` | 152 | CVR-opslag med auto-fill |
| `NemSmsOptIn.tsx` | 158 | 6-kategori opt-in matrix |
| `PaymentStep.tsx` | 232 | PraxisOS Pay step i booking-flow |
| `SubsidyBanner.tsx` | 94 | Auto-vælger bedste tilskud · falder til in_clinic ved 0 kr |
| `VoucherInput.tsx` | 134 | Klippekort/gavekort redeem-flow |
| `SwarmPanel.tsx` | 45 | Agent-team aktivitets-panel |

---

## 8 · Authentication & Authorization

### 8.1 · Login-flows (4)
1. **Standard login** (`/login`) — email/password + remember-me
2. **MitID** (`/login/mitid`) — OIDC via Idura broker · 5 phases · CPR Match for patienter
3. **WebAuthn passkey** (`/login/passkey`) — phishing-resistant for klinikere
4. **Password reset** (`/login/reset`) — magic-link

### 8.2 · Demo-accounts (mock-mode · `lib/auth.ts`)
| Email | Tenant | Rolle | Adgangskode |
|-------|--------|-------|-------------|
| pilar@bypilar.dk | bypilar | owner | `demo` |
| sofie@bypilar.dk | bypilar (+ nordlys) | practitioner | `demo` |
| nadia@nordlys.dk | nordlys | owner | `demo` |
| emil@bypilar.dk | bypilar | reception | `demo` |
| emil@support.praxis.app | bypilar + nordlys | support | `demo` |

### 8.3 · Roller (DB-niveau)
- `owner` · fuld tenant-adgang
- `practitioner` · behandler · journal · bookings
- `reception` · administrativ · ikke journal
- `support` · PraxisOS-internt · cross-tenant via RLS

### 8.4 · Session-context (RLS bridge)
Backend sætter inden hver query:
```sql
SET LOCAL app.tenant_id = '<uuid>';
SET LOCAL app.role = 'practitioner';
SET LOCAL app.user_subject = '<mitid-sub>';
```

`service_role` (Supabase) bypasser RLS automatisk — bruges af `/api/signup` og admin-tasks.

---

## 9 · DK-Integrationer (8 datakilder)

| # | Integration | Status | Modul | Eksterne lead-time |
|---|-------------|--------|-------|--------------------|
| 1 | **MitID** | stub (UI klar · venter på broker-credentials) | `app/login/mitid/` | ~2 uger (Idura/Signaturgruppen) |
| 2 | **DAWA** | ✓ live (public API) | `app/api/dawa/autocomplete/` | 0 — bruger nu |
| 3 | **CVR** | ✓ live (cvrapi.dk + 7d cache) | `app/api/cvr/lookup/` | 0 — bruger nu |
| 4 | **CPR Match** | ✓ live (privat SaaS-flow) | `components/CprMatch.tsx` | 0 |
| 5 | **MedCom** | stub | `lib/reporting.ts` · `app/admin/medcom/` | ~8 uger (EAN + VANS) |
| 6 | **FMK / NSP** | stub (trustaftale pending) | `app/admin/sundhed-dk/` | ~6 uger (Sundhedsdatastyrelsen) |
| 7 | **NemSMS** | stub (KOMBIT pending) | `lib/nemsms.ts` | ~3-4 uger |
| 8 | **Sygesikringen "danmark"** | stub (EDIFACT D04A) | `lib/reporting.ts` · `lib/subsidies.ts` | ~4-6 uger |

**Plus eksterne ikke i ovenstående**:
- **Supabase EU** — ✓ live (project `jajdtvduzkitjzcazcng`)
- **Vercel** — ✓ live (`prj_hxngix2sxpmKAkwA0pUvUyOBkldj`)
- **GitHub** — ✓ live (`Broser-ai/PraxisOS`)
- **Stripe Connect** — ikke oprettet endnu (1 dag onboarding)
- **Idura Signatures** — ikke aktiveret endnu (1 dag onboarding)
- **Bird.com** — connector oprettet, ikke kodet endnu

---

## 10 · Payment System (PraxisOS Pay)

**Egen-built · ikke Adyen** (eksplicit besluttet 2026-06-08). Bygges som platform-payment med tenant-sub-ledgers.

### Metoder (`lib/payments.ts`)
| Metode | Kontekst |
|--------|----------|
| mobilepay | DK · default for bypilar |
| dankort | DK |
| card | Visa/Mastercard |
| applepay | mobile |
| googlepay | mobile |
| klarna | BNPL |
| swish | SE-roaming |
| bank | bank-overførsel |
| invoice | erhvervs |

### Pris-model
- Bypilar (trial): **0 platform-fee** (vi tager intet)
- Andre tenants: **1,45% + 0,50 kr** (kunne sænkes ved volumen)
- Payout-delay: 2 dage default

### PraxisRisk + PraxisTrust 2
- **PraxisRisk** · ML risk-score (0-100) baseret på beløb, klient-historik, geo, device
- **PraxisTrust 2** · MitID step-up når risk > tenant.riskThreshold (default 30-35)
- Vores 3DS-ækvivalent · ingen 3DS-fee fra Visa/Mastercard

### Tenant payment config
```ts
TENANT_PAYMENT_CONFIG = {
  bypilar: { feeRateBp: 0, fixedFeeOere: 0, paymentMode: "auth_only", ... },
  nordlys: { feeRateBp: 145, fixedFeeOere: 50, paymentMode: "prepay", ... }
}
```

### TODO før live
- [ ] Stripe Connect Custom som under-the-hood acquiring (Fase 1)
- [ ] Direct acquiring m. Nets/Worldline (Fase 2 · efter 5M kr/år)
- [ ] PCI-DSS scoping (kun SAQ-A da vi ikke håndterer kortdata direkte)

---

## 11 · Vouchers & Subsidies

### Vouchers (`lib/vouchers.ts`)
- **Klippekort** · sessions_total · sessions_remaining · service_id
- **Gavekort** · balance_oere · original_balance_oere
- 3-års udløb (`expires_at`) default
- Unique kode (8-tegn alphanumerisk)
- Status: active / used / expired / refunded

### Subsidies (`lib/subsidies.ts` · 9 ordninger)
1. **danmark_g1** · Sygesikringen "danmark" gruppe 1
2. **danmark_g2** · gruppe 2
3. **danmark_g5** · gruppe 5
4. **offentlig_g1** · offentlig sygesikring gruppe 1
5. **offentlig_g2** · gruppe 2
6. **helbredstillaeg** · pension/førtidspension
7. **diabetes** · diabetes-tilskud
8. **kronisk_p7** · kronisk § 7
9. **privat_forsikring** · private forsikringer

Sigrid (agent) auto-vælger bedste tilskud i `SubsidyBanner.tsx` og falder tilbage til `in_clinic` hvis 0 kr.

---

## 12 · Foot Scanning (Physical AI)

**Foot-only** · CAD-eksport hidden bag feature-flag (`FEATURE_CAD_EXPORT=false`).

### Views (`components/FootScan.tsx`)
- **Top** · plantar-view
- **Side** · lateral profil
- **Bottom** · sole

### Sensors (`lib/scan.ts`)
- 12 plantar pressure-sensorer
- 8 biomarkør-overlays:
  - hallux_valgus_angle
  - arch_height_index
  - heel_strike_pattern
  - pronation_angle
  - met_head_pressure
  - hammertoe_detection
  - calluses_detection
  - skin_temperature

### 3D Mesh (`components/FootMesh3D.tsx`)
- Canvas-baseret rotation · no Three.js (zero JS-dependencies)
- 64-poly low-poly mesh til visualisering
- 3D-mesh-URL gemmes i `scans.mesh_url` (Supabase Storage TBD)

---

## 13 · Public Marketing & Signup

### Landing (`app/page.tsx`)
- Hero · "Klinikkens operativsystem · Built for Denmark"
- 3 værdier (multi-tenant · 9 agenter · DK-stack færdig)
- 12 modul-cards (af 20)
- CTA · "Start gratis trial · 30 dage"

### Pricing (`app/pricing/page.tsx`)
4 planer:
| Plan | Pris | Inkluderet |
|------|------|-----------|
| Starter | 0 kr/md (trial) | 200 bookings · 1 seat · Pay 1,75% |
| Practice | 595 kr/md | 3 seats · ubegrænset · Pay 1,45% |
| Practice + AI | 1.295 kr/md | + Aria/Niels/Sigrid |
| Enterprise | tilbud | white-label |

Plus per-brug:
- MitID 0,80 kr/login
- NemSMS 0,18 kr/sms
- MedCom 0,95 kr/besked
- AI Scribe 3,00 kr/session
- Pay 1,45% + 0,50 kr/transaktion
- Fod-scan 12 kr/analyse

### Signup (`app/signup/page.tsx`)
3-trins flow:
1. **CVR-lookup** · auto-fill firma-info fra cvrapi.dk
2. **Kontakt** · navn · email · mobil (MitID-bekræftelse i prod)
3. **Plan** · Starter/Practice/Practice+AI · review

Kalder POST `/api/signup` der opretter tenant + owner i mock-mode. Supabase service_role-insert er næste skridt når env-vars er sat.

---

## 14 · Trial Customer · by Pilar

Trial-mekanismen er central. By Pilar betaler **0 kr** indtil PraxisOS er commerciel.

### Hvor det er markeret
1. **`lib/tenants.ts:99-104`** · `trial: { unlimited: true, reason: "...", since: "2026-06-15" }`
2. **`lib/payments.ts:78-81`** · `feeRateBp: 0, fixedFeeOere: 0`
3. **`components/TrialBanner.tsx`** · vises på alle admin-sider
4. **DB · tenants.trial JSONB**:
   ```json
   { "unlimited": true, "reason": "Pilot-kunde...", "since": "2026-06-15" }
   ```
5. **DB · module_activations** · alle 11 moduler med `status='trial'` og `trial_ends_at='2099-12-31'`

### Hvordan deaktiveres trial (når pilot slutter)
1. Sæt `trial` til `null` i DB:
   ```sql
   UPDATE tenants SET trial = null WHERE slug = 'bypilar';
   ```
2. Opdatér `lib/payments.ts` · `feeRateBp: 145, fixedFeeOere: 50`
3. Skift moduler fra `trial` → `active`:
   ```sql
   UPDATE module_activations SET status = 'active'
   WHERE tenant_id = (select id from tenants where slug='bypilar');
   ```
4. Send faktura (Sprint 2 billing-engine)

---

## 15 · Production Deployment State

### 15.1 · Supabase
| Item | Value |
|------|-------|
| Project ID | `jajdtvduzkitjzcazcng` |
| Org | `iuavjiizsmjobkcmhtmt` |
| Region | `eu-west-1` (Ireland) |
| Postgres | 17.6.1.127 |
| Status | ACTIVE_HEALTHY |
| URL | `https://jajdtvduzkitjzcazcng.supabase.co` |
| Migrations | 1 applied (`initial_schema`) + 1 applied (`enable_rls_core_tables`) |
| Tables | 18 (alle med RLS) |
| Data | 2 tenants · 9 services · 18 module-aktiveringer |
| Backups | not configured (todo) |

### 15.2 · Vercel
| Item | Value |
|------|-------|
| Project ID | `prj_hxngix2sxpmKAkwA0pUvUyOBkldj` |
| Project navn | `praxis-os` (med bindestreg) |
| Team | `team_0T0jNK1Ygi8hvJ4oVjHTBmg1` · "Michael's projects" Pro |
| Region | `fra1` (Frankfurt) |
| Live URL | https://praxis-os-mu.vercel.app |
| Custom domain | ingen endnu |
| Latest deployment | `dpl_BVbkqaHCWDRcKdU3tNHfmemEDT2P` · READY |
| Build time | ~23 sek |
| Routes | ~75 (60 pages + 15 API; ~53 static-prerendered) |

**Bemærk**: GitHub er forbundet til Vercel-projektet [`praxis-os`](https://vercel.com/michaels-projects-78cbfa56/praxis-os) — push til `main` trigger autodeploy. Manuel CLI (`vercel deploy --prod --yes`) er kun fallback.

### 15.3 · GitHub
| Item | Value |
|------|-------|
| Repo | `Broser-ai/PraxisOS` (privat) |
| Branch | `main` |
| Latest commit | se `git log -1` på `main` / PR-branch |
| Commits | se `git log --oneline` |
| Source files | ~132 (uden node_modules) |
| Owner | Broser-ai (GitHub) |
| Linked til Supabase | ✓ Yes (auto-deploy ikke aktivt endnu) |

### 15.4 · Env-vars (Vercel Production)
**Status: sat** (2026-07-31) · Production + Preview.

```
PRAXIS_DB                       = supabase-eu
NEXT_PUBLIC_SUPABASE_URL        = https://jajdtvduzkitjzcazcng.supabase.co
SUPABASE_URL                    = https://jajdtvduzkitjzcazcng.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = (sat · sensitive)
SUPABASE_ANON_KEY               = (sat · sensitive)
SUPABASE_SERVICE_ROLE_KEY       = (sat · sensitive)
NEXT_PUBLIC_BASE_URL            = https://praxis-os-mu.vercel.app
NEXT_PUBLIC_APP_REGION          = eu-west-1
```

Dashboard: https://vercel.com/michaels-projects-78cbfa56/praxis-os/settings/environment-variables

> Bemærk: Appen kører stadig mock-data-paths i kode indtil `@supabase/supabase-js` er wired.
> Env-vars er på plads, så næste skridt er rigtig client i `lib/supabase.ts`.

---

## 16 · Build & Deploy Process

### 16.1 · Local dev
```bash
cd PraxisOS
npm install                    # one-time
npm run dev -- -H 127.0.0.1 -p 3002
# åbn http://127.0.0.1:3002/
```

### 16.2 · Build (verify)
```bash
npm run build
# Forventet: ✓ Compiled · TypeScript pass · ~75 routes
```

### 16.3 · Deploy til Vercel
```bash
# Auto fra GitHub (NÅR Vercel-GitHub-link er fixet)
git push origin main           # trigger auto-deploy

# Eller manuel via CLI
cd PraxisOS
vercel deploy --prod --yes
```

### 16.4 · Supabase migrations
```bash
# Via MCP-server (i Claude Code · som dette)
# eller:
supabase db diff -f <name>     # generér ny migration
supabase db push               # push til prod
```

### 16.5 · CI/CD (TODO)
Endnu ikke opsat. Anbefaling:
- GitHub Actions: lint + build + type-check på hver PR
- Auto-deploy main → prod via Vercel
- Migration-tests mod ephemeral Supabase branches

---

## 17 · Operations Runbook

### 17.1 · Hvis prod-site er nede
1. Tjek Vercel dashboard: https://vercel.com/michaels-projects-78cbfa56/praxis-os/deployments
2. Tjek seneste deployment-status
3. Hvis ERROR → check build-logs · pas på TypeScript-fejl
4. Hvis BLOCKED → check Settings · Git · Deployment Protection
5. Rollback til forrige READY deployment via Vercel UI

### 17.2 · Hvis Supabase-DB svarer ikke
1. Tjek Supabase dashboard: https://supabase.com/dashboard/project/jajdtvduzkitjzcazcng
2. Status skal være `Healthy`
3. Check connection-pool i Settings · Database
4. Pause/restart projekt hvis nødvendigt

### 17.3 · Hvis trial-banner forsvinder
1. Tjek `lib/tenants.ts` har `trial: { unlimited: true, ... }` for bypilar
2. Tjek DB: `SELECT trial FROM tenants WHERE slug = 'bypilar';`
3. Tjek `components/TrialBanner.tsx` er i `(internal)/layout.tsx`

### 17.4 · Rotation af keys
**Service-role-key** (CRITICAL):
1. Supabase dashboard → Settings → API → Reset service_role
2. Opdatér Vercel env: `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy
4. (Den gamle key er auto-invalid efter reset)

**Anon-key** (lavere risk):
1. Samme proces · men anon er public-by-design

### 17.5 · Backup-strategi (TODO)
- Supabase Pro: aktivér PITR (Point-In-Time-Recovery)
- 7-dages backups + 24h granularitet
- DR-test 1x/kvartal

---

## 18 · Security & Compliance

### 18.1 · GDPR
- **Art. 9** (særligt følsomme data) compliant
- Data-residens: EU only (Ireland + Frankfurt)
- CPR aldrig raw · altid `cpr_hashed` (SHA-256) + `cpr_masked` (****-1234) til UI
- Audit-log med hash-chain · patient kan se "Min Log" på sundhed.dk

### 18.2 · NSIS niveauer
- Default: **Substantial** · MitID app eller code display
- Step-up til **High** for sensitive operationer (Frej beslutter)

### 18.3 · RLS-garanti
Alle 15 tenant-tabeller har:
```sql
CREATE POLICY <table>_isolation ON <table> FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```
Cross-tenant leak er **strukturelt umuligt**.

### 18.4 · Audit-log hash-chain
Hver insert beregner:
```
hash = SHA256(tenant_id | action | target_cpr | at | prev_hash)
```
Manipulation kan opdages ved at re-køre kæden.

### 18.5 · Dokumenter der mangler
- [ ] DPA-skabelon (Datatilsynet standard)
- [ ] Sub-processor liste (Supabase, Vercel, OpenAI, Sentry, Stripe, Idura, Bird)
- [ ] Art. 30-fortegnelse
- [ ] Privatlivspolitik + Cookie-politik (da-DK)
- [ ] Servicevilkår for kunder

### 18.6 · Pen-test
- IKKE udført
- Anbefaling: NCC Group (Aalborg) eller Improsec · ~30-50k kr engangs · 4-8 ugers ventetid

---

## 19 · Known Issues / Limitations

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Env-vars sat, men kode bruger stadig mock-storage (ingen `@supabase/supabase-js` endnu) | medium | Sprint 1 · wire client |
| 2 | `/api/signup` opretter mock-tenant · mangler ægte Supabase-insert | medium | Sprint 1 (service_role) |
| 4 | Stripe Connect ikke koblet · ingen rigtig billing | high | Sprint 2 |
| 5 | MitID-flow er mock · Idura broker ikke aktiveret | high | Sprint efter Idura-onboarding |
| 6 | Email-pipeline mangler · ingen booking-bekræftelser sendes | high | Sprint 2 + Bird.com |
| 7 | Atlas (kode-gen agent) er kun stub | low | Sprint 4 |
| 8 | Backup-strategi ikke konfigureret | medium | Aktivér PITR i Supabase Pro |
| 9 | CI/CD pipeline mangler (ud over Vercel Git-integration) | low | GitHub Actions setup |

---

## 20 · Next Steps · Roadmap

### Sprint 1 · Nuværende
- [x] **Env-vars sat i Vercel** (Production + Preview) · redeployet
- [x] GitHub ↔ Vercel forbundet ([`praxis-os`](https://vercel.com/michaels-projects-78cbfa56/praxis-os))
- [x] `/api/signup` POST-handler (mock in-memory · wired fra `/signup`)
- [ ] `/api/signup` → ægte Supabase-insert via service_role
- [ ] `lib/supabase.ts` server-client (real fetch · ikke mock)
- [ ] Merge til `main` → autodeploy via Vercel Git-integration

### Sprint 2 · Faktura + billing (3-4 dage)
- [ ] Stripe Connect Custom setup
- [ ] Subscription management (monthly Plan-opkrævning)
- [ ] Usage-based billing (per-brug fees)
- [ ] Faktura-PDF generator (dansk format · momsfri)
- [ ] `/admin/plan/faktura-historik`
- [ ] **Bird.com integration** (afløser NemSMS) · SMS + email + WhatsApp

### Sprint 3 · Kontrakt-signering (1 dag)
- [ ] Tenant-kontrakt PDF-generator
- [ ] POST hash til **Idura Signatures** · MitID Erhverv
- [ ] Webhook · gem signed PDF i Supabase Storage
- [ ] `/admin/contract` viser signed kontrakter

### Sprint 4 · Atlas (1-2 dage)
- [ ] Self-reflecting kode-gen engine
- [ ] Kunde-ønske → Atlas → modul → review → deploy
- [ ] Eksempel-flow demo

### Sprint 5 · Polish (1-2 dage)
- [ ] Onboarding-tour for nye tenants
- [ ] Testimonials (Pilar første)
- [ ] Demo-video på landing
- [ ] Help-center (FAQ)

### Eksterne onboardings (parallel)
- [ ] MitID broker · Idura (2 uger)
- [ ] Trustaftale · Sundhedsdatastyrelsen (6 uger)
- [ ] MedCom EAN + VANS (8 uger)
- [ ] Sygeforsikringen "danmark" (4-6 uger)
- [ ] Pen-test + ISO 27001-light (4 uger)
- [ ] Advokat · servicevilkår (2 uger)

---

## 21 · External Dependencies (vendors)

| Vendor | Hvad | Aktiveret | Pris | Action |
|--------|------|-----------|------|--------|
| Supabase | DB + Storage + Realtime | ✓ | gratis tier OK · $25/md Pro | senere upgrade for PITR |
| Vercel | Hosting | ✓ Pro | inkluderet i Pro-plan | — |
| GitHub | Source control | ✓ | gratis (privat repo) | — |
| Anthropic Claude | AI-coder | ✓ (du har Pro) | usage-based | — |
| Stripe | Payments-acquiring | ❌ | 1,4% + 1,80 kr per transaktion | opret Stripe-konto |
| Idura Verify | MitID broker | ❌ | €67/md Small · 1.000 logins | opret sandbox |
| Idura Signatures | E-signering med MitID | ❌ | €139/md Small · 200 sign · 1.200 DKK setup-fee | aktivér efter pilot |
| Bird.com | SMS/email/WhatsApp | ❌ | pay-as-you-go (DK SMS ~0,20-0,40 kr) | opret API-key + channels |
| cvrapi.dk | CVR-lookup | ✓ | gratis 1.000/dag | — |
| DAWA | Adresser | ✓ | gratis public API | — |
| Sentry | Error tracking | ❌ | gratis 5k events/md | opret projekt |
| OpenAI | AI-pipelines (Whisper, GPT) | ❌ | usage-based | opret key |
| NemSMS · KOMBIT | Officiel Digital Post SMS | ❌ | 0,18 kr/sms | **droppet · Bird i stedet** |

---

## 22 · Cost Model (estimat for pilot-måned)

### Faste omkostninger
| Vendor | Plan | Pris/md |
|--------|------|---------|
| Supabase | Free → Pro når > 500 MB | 0 → 25 USD/md (~190 kr) |
| Vercel Pro | nuværende plan | inkluderet i din eksisterende |
| Anthropic Claude | Pro | inkluderet i din eksisterende |
| Idura Verify Small | 1.000 logins/md | €67 (~500 kr) |
| Stripe Connect | platform-fee 0,25% | usage-baseret |
| **Faste total** | | **~700 kr/md** |

### Variable omkostninger (eksempel · 50 bookings/md for bypilar)
| Item | Pris | Volumen | Total |
|------|------|---------|-------|
| MitID logins | 0,037 EUR/login | 100/md | ~28 kr |
| Bird SMS | 0,30 kr/SMS | 100/md | 30 kr |
| Bird email | 0,01 kr | 200/md | 2 kr |
| Stripe-fees | 1,4% + 1,80 kr | 50 × 500 kr | ~440 kr |
| **Variable total** | | | **~500 kr/md** |

### Total estimat Fase 1
**~1.200 kr/md fast cost** for at køre PraxisOS med 1 trial-kunde (bypilar).

Når 5+ betalende kunder lander, dækker subscription-revenue (5 × 595 kr = 2.975 kr/md) det rigeligt.

---

## 23 · Filer du SKAL kende

1. **`HANDOVER.md`** ← (du læser den nu)
2. **`PRAXISOS-BRIEF.md`** · kort system-brief
3. **`CODE-MAP.md`** · fil-for-fil oversigt
4. **`PRODUCTION.md`** · go-live runbook
5. **`README.md`** · lokal dev guide
6. **`.env.example`** · env-template
7. **`supabase/migrations/0001_initial_schema.sql`** · DB-skema
8. **`lib/tenants.ts`** · tenant-model + seeds + `registerTenant`
9. **`lib/agents.ts`** · 9 humaniserede AI-agenter
10. **`lib/modules.ts`** · 20 moduler i marketplace
11. **`lib/payments.ts`** · PraxisOS Pay config
12. **`lib/subsidies.ts`** · 9 DK-tilskudsordninger
13. **`app/api/signup/route.ts`** · tenant-signup API

> `PraxisOS-Forarbejde.docx` genereres via `scripts/generate_forarbejde_docx.py` og er gitignored.

---

## 24 · Hvordan ny udvikler kommer i gang

```bash
# 1. Clone
git clone git@github.com:Broser-ai/PraxisOS.git
cd PraxisOS

# 2. Install
npm install

# 3. Env
cp .env.example .env.local
# Hent Supabase keys fra: https://supabase.com/dashboard/project/jajdtvduzkitjzcazcng/settings/api

# 4. Run
npm run dev -- -H 127.0.0.1 -p 3002

# 5. Åbn
# http://127.0.0.1:3002/
# Login: pilar@bypilar.dk / demo
```

Læs så `HANDOVER.md` (denne fil) end-to-end · ca. 15 min.

---

## 25 · Kontakt

- **Owner**: Michael (ReNew-DK, ma@keap.me)
- **GitHub**: Broser-ai
- **Vercel-team**: Michael's projects (Pro)
- **Supabase-org**: iuavjiizsmjobkcmhtmt

---

*Opdateret 2026-07-31 · PraxisOS · ma@keap.me*
*Check `git log` for ændringer efter denne dato.*
