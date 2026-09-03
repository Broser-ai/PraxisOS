# PraxisOS · Code Map · Every File Explained

> Hver eneste fil i repo-roden med 1-linje formål.
> Kompletterer `HANDOVER.md`. Opdateret 2026-07-31.

## Configuration files (root)

| Fil | Formål |
|-----|--------|
| `package.json` | Next 16.2.12 · React 19 · TS 5.7 · Tailwind 4 |
| `next.config.mjs` | reactStrictMode + Turbopack root |
| `vercel.json` | Pin Next.js framework + Frankfurt region (fra1) |
| `tsconfig.json` | TypeScript strict-mode config |
| `postcss.config.mjs` | Tailwind PostCSS plugin |
| `.gitignore` | Standard Next.js + node_modules + .next + .env.local |
| `.env.example` | Template for alle env-vars |
| `.env.local` | Faktiske keys (gitignored) |
| `next-env.d.ts` | Next.js type-declarations |
| `README.md` | Lokal dev guide |
| `PRODUCTION.md` | Go-live runbook |
| `HANDOVER.md` | Komplet system-handover |
| `PRAXISOS-BRIEF.md` | Kort system-brief |
| `scripts/generate_forarbejde_docx.py` | Genererer Word-checklist (output gitignored) |

## Database schema

| Fil | Formål |
|-----|--------|
| `supabase/migrations/0001_initial_schema.sql` | 18 tabeller + RLS + triggers + extensions |

## Lib modules (forretningslogik · 19 filer)

| Fil | Formål |
|-----|--------|
| `lib/tenants.ts` | Tenant-type, ALL_MODULES, getTenant, registerTenant, 2 seeds |
| `lib/supabase.ts` | DB-mode switcher (mock/local/eu) + currentConfig + MIGRATIONS |
| `lib/auth.ts` | Sessions + 5 demo-accounts + registerOwnerAccount |
| `lib/agents.ts` | 9 humaniserede AI-agenter med persona, voice, superpower |
| `lib/modules.ts` | 20 marketplace-moduler i 7 kategorier |
| `lib/dk-data.ts` | 8 DK-datakilder oversigt |
| `lib/mcp-tools.ts` | 19 MCP-tools eksponeret via JSON-RPC 2.0 |
| `lib/subsidies.ts` | 9 DK-tilskudsordninger |
| `lib/payments.ts` | PraxisOS Pay · 9 metoder · PraxisRisk |
| `lib/bookings.ts` | Booking-model · status-types · no-show-risk |
| `lib/vouchers.ts` | Klippekort + gavekort · 3-års udløb |
| `lib/nemsms.ts` | NemSMS templates · 6 kategorier |
| `lib/reporting.ts` | EDI/MedCom/KOMBIT payload-builders |
| `lib/mock.ts` | Master mock-objekter (clinic, practitioner) |
| `lib/api-keys.ts` | API-key management · prefix + hashed_secret |
| `lib/scan.ts` | Foot-scan sensorer + biomarkør-overlays |
| `lib/rate-limit.ts` | IP + user sliding-window med exponential backoff |
| `lib/clients.ts` | 5 klient-mock-profiler |
| `lib/staff.ts` | Staff + rolle-management |

## App routes · Public marketing (4)

| Route | Fil | Formål |
|-------|-----|--------|
| `/` | `app/page.tsx` | Landing · hero · værdier · modul-cards · CTA |
| `/pricing` | `app/pricing/page.tsx` | 4 planer + per-brug-fees |
| `/signup` | `app/signup/page.tsx` | 3-trins flow · kalder `/api/signup` |
| `/about` | `app/about/page.tsx` | Manifesto + kontakt |

## App routes · Auth (4)

| Route | Fil | Formål |
|-------|-----|--------|
| `/login` | `app/login/page.tsx` | Email/password + magic-link options |
| `/login/mitid` | `app/login/mitid/page.tsx` | OIDC-flow stub · CPR Match |
| `/login/passkey` | `app/login/passkey/page.tsx` | WebAuthn passkey |
| `/login/reset` | `app/login/reset/page.tsx` | Password reset |

## App routes · Error pages (2)

| Route | Fil | Formål |
|-------|-----|--------|
| 404 | `app/not-found.tsx` | "Den side findes ikke" |
| 500 | `app/error.tsx` | "Det her var ikke planen" |

## App routes · Klinik-internt · (internal)/

| Route | Fil | Formål |
|-------|-----|--------|
| `/` (internal) | `app/(internal)/page.tsx` | Redirect → `/review` |
| `/review` | `review/page.tsx` | Guided tour |
| `/dashboard` | `dashboard/page.tsx` | Key-metrics + dagens bookings |
| `/kalender` | `kalender/page.tsx` | Uge/dag-view |
| `/klienter` · `[id]` | `klienter/...` | Klient-liste + detalje |
| `/bookings` · `[id]` | `bookings/...` | Booking-liste + detalje |
| `/scribe` | `scribe/page.tsx` | AI Scribe |
| `/agent` | `agent/page.tsx` | Aria-panel |
| `/chat` | `chat/page.tsx` | Team-chat |
| `/scan` · `/scan/start` | `scan/...` | Scan-liste + ny scan |
| `/felt` | `felt/page.tsx` | Felt-service |
| `/indstillinger` | `indstillinger/page.tsx` | User-præferencer |

## App routes · Admin · (internal)/admin/ (28)

Se `/admin/*` sider i HANDOVER §5.4 — inkl. tenants, payments, vouchers, subsidies, reporting, api, nemsms, agents (+ frej/niels/sigrid engines), sundhed-dk, medcom, mcp, marketplace, dk-data, database, security, plan, services, staff, integration, health, new-tenant.

## App routes · Tenant-frontend · t/[slug]/ (6)

| Route | Formål |
|-------|--------|
| `/t/[slug]` | Branded tenant-landing |
| `/t/[slug]/book` | 5-trins booking-flow |
| `/t/[slug]/portal` | Klient-portal |
| `/t/[slug]/onboarding` | Ny tenant-onboarding |
| `/t/[slug]/klippekort` | Klippekort køb |
| `/t/[slug]/gavekort` | Gavekort køb |

## App routes · Reservation (2) + Demo (1)

| Route | Formål |
|-------|--------|
| `/r/[id]` · `/status` | Patient-reservation |
| `/demo/bypilar-website` | Embed-demo |

## API endpoints (15)

| Path | Method | Formål |
|------|--------|--------|
| `/api/signup` | POST | Opret tenant + owner |
| `/api/auth/login` | POST | Email/password login |
| `/api/auth/logout` | POST | Clear session-cookie |
| `/api/cvr/lookup` | GET | Proxy til cvrapi.dk |
| `/api/dawa/autocomplete` | GET | DAWA-adresser |
| `/api/events` | GET (SSE) | Event-stream |
| `/api/mcp/v1` | POST | MCP JSON-RPC 2.0 · 19 tools |
| `/api/v1/[tenant]/availability` | GET | Ledige slots |
| `/api/v1/[tenant]/bookings` | POST | Opret booking |
| `/api/v1/[tenant]/bookings/list` | GET | Liste bookings |
| `/api/v1/[tenant]/clients` | GET/POST | Klient-CRUD |
| `/api/v1/[tenant]/lookup` | POST | CPR-match |
| `/api/v1/[tenant]/services` | GET | Tenant services |
| `/api/v1/[tenant]/voucher` | POST | Redeem voucher |
| `/embed/v1/[tenant]` | GET | JS-snippet |

## Components (12)

> `FootScan.tsx` and `SwarmPanel.tsx` were removed as confirmed orphans
> (F15 · no app/lib/test imports; active scan UI is `NexusScanPanel`,
> active agent panel is `/admin/swarm`).

| Fil | Formål |
|-----|--------|
| `Sidebar.tsx` | Hovedmenu admin |
| `Topbar.tsx` | Søg + notifikationer + user-menu |
| `TrialBanner.tsx` | Trial-banner for bypilar |
| `FootMesh3D.tsx` | Canvas 3D-mesh rotation |
| `SkinScan.tsx` | Æstetik-skanner UI |
| `AddressAutocomplete.tsx` | DAWA-powered input |
| `CprMatch.tsx` | CPR-verifikation |
| `CvrLookup.tsx` | CVR-opslag |
| `NemSmsOptIn.tsx` | 6-kategori opt-in |
| `PaymentStep.tsx` | PraxisOS Pay step |
| `SubsidyBanner.tsx` | Auto tilskuds-valg |
| `VoucherInput.tsx` | Klippekort/gavekort redeem |

## Total

- **~75 endpoints** (60 pages + 15 API)
- **19 lib-moduler** (~3.600 LOC forretningslogik)
- **14 components** (~2.300 LOC delt UI)
- **1 SQL migration** (~420 LOC schema)

---

*Opdateret 2026-07-31 fra repo-rod tree-walk*
