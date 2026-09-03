# PraxisOS · Code Map · Every File Explained

> Hver eneste fil i repo-roden med 1-linje formål.
> Kompletterer `HANDOVER.md`. Opdateret 2026-09-03 (F21).

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

## API endpoints (44 route handlers)

Auth notes: staff = session cookie; public = rate-limit / HMAC / allowlist as noted.

| Path | Method | Auth | Formål |
|------|--------|------|--------|
| `/api/signup` | POST | Public | Opret tenant + owner · **F25** · **F42 captcha** |
| `/api/auth/login` | POST | Public | Email/password login · **F37** · **F42 captcha** |
| `/api/auth/logout` | POST | Session | Clear session-cookie |
| `/api/auth/me` | GET | Session | Current account · **F50 audit** |
| `/api/health` | GET | Public | Readiness · **F16 fail-fast** · **F26 detail redact** |
| `/api/cvr/lookup` | GET | Public | Proxy til cvrapi.dk |
| `/api/dawa/autocomplete` | GET | Public | DAWA-adresser |
| `/api/events` | GET | Staff | Event-log (F19) |
| `/api/events` | POST | HMAC | Publish event (`x-praxis-signature`) |
| `/api/mcp/v1` | POST | API key | MCP JSON-RPC · verifyApiKey (F13) |
| `/api/license` | GET/POST | Owner/support | License · **F23 audit** · **F24 tenant scope** |
| `/api/tenant/setup` | POST | Owner | Tenant setup · **F23 audit context** |
| `/api/scan/config` | GET | Public+rate | Scan readiness · **F33** · **F44 rate** |
| `/api/scan/config` | POST | Owner | Scan secrets write |
| `/api/bird/config` | GET | Public+rate | Bird readiness · **F33** · **F44 rate** |
| `/api/bird/config` | POST | Owner | Bird secrets write |
| `/api/bird/send` | POST | Staff+consent | SMS send |
| `/api/bird/status` | GET | Public+rate | Bird status · **F36** · **F44 rate** |
| `/api/agents/status` | GET | Owner/support | Automation status |
| `/api/agents/run` | POST | Staff | Agent chat run · **F45 audit** |
| `/api/agents/approvals` | GET/POST | Staff | Approval list/decide · **F40** |
| `/api/agents/workflows` | GET | Owner/support | Workflow list (F20) |
| `/api/agents/workflows` | POST | Worker secret | Tick/run workflows |
| `/api/agents/tick` | GET/POST | Worker secret | Automation tick (F12 fail-closed) |
| `/api/cron/swarm-tick` | GET | Cron secret | Swarm cron · **F53 audit** |
| `/api/journal` | GET/POST | Staff | Journal list/create · **F35 audit** |
| `/api/journal/from-booking` | POST | Staff | Journal from booking · **F30** |
| `/api/journal/[id]` | GET/PATCH | Staff | Journal read/patch · **F35 audit** |
| `/api/journal/[id]/sign` | POST | Staff | Sign (NO_AUTO_JOURNAL_SIGN) · **F35** |
| `/api/journal/[id]/draft` | POST | Staff+consent | AI SOAP draft · **F35** |
| `/api/v1/scan/process` | GET | Staff | Scan pipeline readiness · **F24** |
| `/api/v1/scan/process` | POST | Staff+consent | Foot-scan process · **F23 audit** |
| `/api/v1/[tenant]/availability` | GET | Public+rate | Ledige slots · **F51** |
| `/api/v1/[tenant]/services` | GET | Public+rate | Tenant services · **F51** |
| `/api/v1/[tenant]/bookings` | POST | Public+kit | Opret booking (CORS+rate-limit) |
| `/api/v1/[tenant]/bookings/list` | GET | Staff/key | Liste bookings |
| `/api/v1/[tenant]/clients` | GET/POST | Staff/key | Klient-CRUD |
| `/api/v1/[tenant]/consent` | POST | Public+rate | Onboarding consent · **F17** · **F43 audit** |
| `/api/v1/[tenant]/lookup` | GET | Public+rate | Client/email lookup · **F22** · **F48** |
| `/api/v1/[tenant]/voucher` | GET | Public+rate | Voucher validate · **F22** · **F48** |
| `/api/v1/[tenant]/prime/missions` | * | Staff | Prime missions · **F46** · **F52 audit** |
| `/api/v1/[tenant]/orchestrator` | * | Staff | Orchestrator · **F41** |
| `/api/v1/[tenant]/swarm` | * | Staff | Swarm control · **F41** |
| `/api/v1/[tenant]/research` | * | Staff | Research tools · **F41** |
| `/embed/v1/[tenant]` | GET | Public | JS booking snippet |

## Components

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
| `NexusScanPanel.tsx` | Active foot-scan UI |
| `NexusProviderSetup.tsx` | Nexus provider setup |
| `AddressAutocomplete.tsx` | DAWA-powered input |
| `CprMatch.tsx` | CPR-verifikation |
| `CvrLookup.tsx` | CVR-opslag |
| `NemSmsOptIn.tsx` | 6-kategori opt-in |
| `PaymentStep.tsx` | PraxisOS Pay step |
| `SubsidyBanner.tsx` | Auto tilskuds-valg |
| `VoucherInput.tsx` | Klippekort/gavekort redeem |
| `AlphaViewer4D.tsx` | 4D alpha viewer |
| `FunktionerCatalog.tsx` | Feature catalog |
| `MarketingNav.tsx` | Marketing navigation |

## Total (F49 refresh)

- **44 API route handlers** (was listed as 15 — stale)
- **Lib modules** under `lib/` incl. consent, audit, captcha, prime, public-booking-kit, request-auth
- **17 components** (FootScan/SwarmPanel removed)
- **Migrations** `0001`–`0008` under `supabase/migrations/`
- Continue-dev slices **F11–F54** on PR #34

---

*Opdateret 2026-09-03 · F49 CODE-MAP accuracy pass (P0 continue-dev)*

