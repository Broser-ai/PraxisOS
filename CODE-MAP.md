# PraxisOS · Code Map · Every File Explained

> Hver eneste fil i `prototype/` med 1-linje formål.
> Kompletterer `HANDOVER.md`.

## Configuration files (root)

| Fil | Formål |
|-----|--------|
| `package.json` | Next 16.2.7 · React 19 · TS 5.7 · Tailwind 4 |
| `next.config.mjs` | reactStrictMode + Turbopack root |
| `vercel.json` | Pin Next.js framework + Frankfurt region (fra1) |
| `tsconfig.json` | TypeScript strict-mode config |
| `postcss.config.mjs` | Tailwind PostCSS plugin |
| `.gitignore` | Standard Next.js + node_modules + .next + .env.local |
| `.env.example` | Template for alle env-vars |
| `.env.local` | Faktiske keys (gitignored) |
| `.vercel/project.json` | Project ID + Org ID for CLI-deploy |
| `next-env.d.ts` | Next.js type-declarations |
| `README.md` | Lokal dev guide |
| `PRODUCTION.md` | Go-live runbook |
| `PraxisOS-Forarbejde.docx` | Word-version af opstart-checklisten |

## Database schema

| Fil | Formål |
|-----|--------|
| `supabase/migrations/0001_initial_schema.sql` | 18 tabeller + RLS + triggers + extensions |

## Lib modules (forretningslogik · 19 filer)

| Fil | LOC | Formål |
|-----|-----|--------|
| `lib/tenants.ts` | 201 | Tenant-type, ALL_MODULES, getTenant, 2 seeds (bypilar trial · nordlys) |
| `lib/supabase.ts` | 126 | DB-mode switcher (mock/local/eu) + currentConfig + MIGRATIONS list |
| `lib/auth.ts` | 88 | Sessions + 4 demo-accounts (pilar/sofie/nadia/emil) |
| `lib/agents.ts` | 450 | 9 humaniserede AI-agenter med persona, voice, superpower, weakness |
| `lib/modules.ts` | 623 | 20 marketplace-moduler i 7 kategorier · pricing-models |
| `lib/dk-data.ts` | 350 | 8 DK-datakilder oversigt (MitID/DAWA/CVR/CPR/MedCom/FMK/NemSMS/danmark) |
| `lib/mcp-tools.ts` | 335 | 19 MCP-tools eksponeret via JSON-RPC 2.0 |
| `lib/subsidies.ts` | 252 | 9 DK-tilskudsordninger (danmark_g1/g2/g5, helbredstillaeg, etc) |
| `lib/payments.ts` | 211 | PraxisOS Pay · 9 metoder · TENANT_PAYMENT_CONFIG · PraxisRisk |
| `lib/bookings.ts` | 228 | Booking-model · status-types · no-show-risk |
| `lib/vouchers.ts` | 199 | Klippekort (sessions) + gavekort (balance) · 3-års udløb |
| `lib/nemsms.ts` | 197 | NemSMS templates · 6 kategorier · opt-in matrix (forældes til Bird) |
| `lib/reporting.ts` | 235 | EDI/MedCom/KOMBIT payload-builders |
| `lib/mock.ts` | 177 | Master mock-objekter (clinic, practitioner) |
| `lib/api-keys.ts` | 165 | API-key management · prefix + hashed_secret + scopes |
| `lib/scan.ts` | 139 | Foot-scan sensorer + 8 biomarkør-overlays · FEATURE_CAD_EXPORT=false |
| `lib/rate-limit.ts` | 132 | IP + user sliding-window med exponential backoff |
| `lib/clients.ts` | 107 | 5 klient-mock-profiler |
| `lib/staff.ts` | 62 | Staff + rolle-management |

## App routes · Public marketing (4)

| Route | Fil | Formål |
|-------|-----|--------|
| `/` | `app/page.tsx` | Landing · hero · værdier · 12 modul-cards · CTA |
| `/pricing` | `app/pricing/page.tsx` | 4 planer + per-brug-fees + add-on tabel |
| `/signup` | `app/signup/page.tsx` | 3-trins flow · CVR-lookup → kontakt → plan |
| `/about` | `app/about/page.tsx` | Manifesto + hvorfor PraxisOS + kontakt |

## App routes · Auth (4)

| Route | Fil | Formål |
|-------|-----|--------|
| `/login` | `app/login/page.tsx` | Email/password + magic-link options |
| `/login/mitid` | `app/login/mitid/page.tsx` | OIDC-flow · 5 phases · CPR Match for patient |
| `/login/passkey` | `app/login/passkey/page.tsx` | WebAuthn passkey (phishing-resistant) |
| `/login/reset` | `app/login/reset/page.tsx` | Password reset via magic-link |

## App routes · Error pages (2)

| Route | Fil | Formål |
|-------|-----|--------|
| 404 | `app/not-found.tsx` | "Den side findes ikke" + back-to-home |
| 500 | `app/error.tsx` | "Det her var ikke planen" + Frej log-besked |

## App routes · Klinik-internt · (internal)/ (12)

| Route | Fil | Formål |
|-------|-----|--------|
| `/review` | `app/(internal)/review/page.tsx` | Guided tour · 5 nøgleskærme |
| `/dashboard` | `app/(internal)/dashboard/page.tsx` | Key-metrics + dagens bookings |
| `/kalender` | `app/(internal)/kalender/page.tsx` | Uge/dag-view |
| `/klienter` | `app/(internal)/klienter/page.tsx` | Klient-liste med søg |
| `/klienter/[id]` | `app/(internal)/klienter/[id]/page.tsx` | Klient-detalje · journal · scans · bookings |
| `/bookings` | `app/(internal)/bookings/page.tsx` | Booking-liste |
| `/bookings/[id]` | `app/(internal)/bookings/[id]/page.tsx` | Booking-detalje |
| `/scribe` | `app/(internal)/scribe/page.tsx` | AI Scribe interface · live transcription |
| `/agent` | `app/(internal)/agent/page.tsx` | Aria · AI-agent panel |
| `/chat` | `app/(internal)/chat/page.tsx` | Team-chat |
| `/scan` | `app/(internal)/scan/page.tsx` | Scan-liste |
| `/scan/start` | `app/(internal)/scan/start/page.tsx` | Ny scan · 3-view fod-scanning |
| `/felt` | `app/(internal)/felt/page.tsx` | Felt-service dispatch (Bjørn) |
| `/indstillinger` | `app/(internal)/indstillinger/page.tsx` | User-præferencer |

## App routes · Admin · (internal)/admin/ (28)

| Route | Fil | Formål |
|-------|-----|--------|
| `/admin/tenants` | `admin/tenants/page.tsx` | Tenant-liste med stats |
| `/admin/new-tenant` | `admin/new-tenant/page.tsx` | Onboard ny tenant (manuel · TBD selvbetjening via /signup) |
| `/admin/payments` | `admin/payments/page.tsx` | PraxisOS Pay overview · transaktioner |
| `/admin/vouchers` | `admin/vouchers/page.tsx` | Klippekort + gavekort oversigt |
| `/admin/vouchers/[code]` | `admin/vouchers/[code]/page.tsx` | Voucher-detalje · audit-log |
| `/admin/subsidies` | `admin/subsidies/page.tsx` | 9 tilskudsordninger + status |
| `/admin/reporting` | `admin/reporting/page.tsx` | EDI/MedCom/KOMBIT-indberetninger |
| `/admin/api` | `admin/api/page.tsx` | API-keys + webhooks-mgmt |
| `/admin/nemsms` | `admin/nemsms/page.tsx` | NemSMS templates · 6 kategorier · opt-in (skal forældes til Bird) |
| `/admin/agents` | `admin/agents/page.tsx` | Agent-team oversigt · alle 9 |
| `/admin/agents/[id]` | `admin/agents/[id]/page.tsx` | Individuel agent-detalje |
| `/admin/agents/frej/engine` | `admin/agents/frej/engine/page.tsx` | 8-trins compliance-pipeline med 4 test-scenarier |
| `/admin/agents/niels/pipeline` | `admin/agents/niels/pipeline/page.tsx` | AI-scribe pipeline · Whisper+ClinicalBERT |
| `/admin/agents/sigrid/engine` | `admin/agents/sigrid/engine/page.tsx` | 9-trins sygesikrings-engine |
| `/admin/sundhed-dk` | `admin/sundhed-dk/page.tsx` | Trustaftale + FMK/MinLog status |
| `/admin/medcom` | `admin/medcom/page.tsx` | MedCom-EDI status · EAN-opsæt |
| `/admin/mcp` | `admin/mcp/page.tsx` | MCP-server status + 19 tools liste |
| `/admin/marketplace` | `admin/marketplace/page.tsx` | 20 moduler grid med pricing |
| `/admin/marketplace/[id]` | `admin/marketplace/[id]/page.tsx` | Modul-detalje |
| `/admin/marketplace/[id]/activate` | `admin/marketplace/[id]/activate/page.tsx` | 5-trins activation-wizard |
| `/admin/dk-data` | `admin/dk-data/page.tsx` | 8 DK-datakilder med status |
| `/admin/database` | `admin/database/page.tsx` | Supabase admin · tabeller · RLS · migrations |
| `/admin/security` | `admin/security/page.tsx` | Sikkerhed & adgang oversigt |
| `/admin/plan` | `admin/plan/page.tsx` | Klinikkens plan + faktura-historik (TBD) |
| `/admin/services` | `admin/services/page.tsx` | Klinikkens services · CRUD |
| `/admin/staff` | `admin/staff/page.tsx` | Personale + roller |
| `/admin/integration/[tenant]` | `admin/integration/[tenant]/page.tsx` | Per-tenant integrationsstatus |
| `/admin/health` | `admin/health/page.tsx` | ⭐ System-status dashboard (live integrations + checklist) |

## App routes · Tenant-frontend · t/[slug]/ (5)

| Route | Fil | Formål |
|-------|-----|--------|
| `/t/[slug]` | `t/[tenant]/page.tsx` | Branded tenant-landing |
| `/t/[slug]/book` | `t/[tenant]/book/page.tsx` | 5-trins booking-flow med PaymentStep |
| `/t/[slug]/portal` | `t/[tenant]/portal/page.tsx` | Klient-portal · bookings + scans + journal |
| `/t/[slug]/onboarding` | `t/[tenant]/onboarding/page.tsx` | Ny tenant-onboarding · 4-trin |
| `/t/[slug]/klippekort` | `t/[tenant]/klippekort/page.tsx` | Klippekort køb · brand-styled |
| `/t/[slug]/gavekort` | `t/[tenant]/gavekort/page.tsx` | Gavekort køb |

## App routes · Reservation (3)

| Route | Fil | Formål |
|-------|-----|--------|
| `/r/[id]` | `r/[id]/page.tsx` | Patient-reservation bekræftelse (link i email/SMS) |
| `/r/[id]/status` | `r/[id]/status/page.tsx` | Reservation-status |
| `/r/[id]/layout.tsx` | `r/[id]/layout.tsx` | Minimal layout (no chrome) |

## App routes · Demo (1)

| Route | Fil | Formål |
|-------|-----|--------|
| `/demo/bypilar-website` | `demo/bypilar-website/page.tsx` | Embed-demo · viser hvordan tenant's website kalder vores API |

## API endpoints (14)

| Path | Method | Fil | Formål |
|------|--------|-----|--------|
| `/api/auth/login` | POST | `api/auth/login/route.ts` | Email/password login · returnerer session-cookie |
| `/api/auth/logout` | POST | `api/auth/logout/route.ts` | Clear session-cookie |
| `/api/cvr/lookup` | GET | `api/cvr/lookup/route.ts` | Proxy til cvrapi.dk · 7-dages in-memory cache · 2 demo-firmaer |
| `/api/dawa/autocomplete` | GET | `api/dawa/autocomplete/route.ts` | DAWA-adresser via api.dataforsyningen.dk |
| `/api/events` | GET (SSE) | `api/events/route.ts` | Server-Sent Events stream |
| `/api/mcp/v1` | POST | `api/mcp/v1/route.ts` | MCP JSON-RPC 2.0 · 19 tools |
| `/api/v1/[tenant]/availability` | GET | route.ts | Ledige slots for service |
| `/api/v1/[tenant]/bookings` | POST | route.ts | Opret booking |
| `/api/v1/[tenant]/bookings/list` | GET | route.ts | Liste bookings |
| `/api/v1/[tenant]/clients` | GET/POST | route.ts | Klient-CRUD |
| `/api/v1/[tenant]/lookup` | POST | route.ts | CPR-match mod MitID-data |
| `/api/v1/[tenant]/services` | GET | route.ts | Tenant's udbudte services |
| `/api/v1/[tenant]/voucher` | POST | route.ts | Redeem klippekort/gavekort |
| `/embed/v1/[tenant]` | GET | route.ts | JS-snippet til kunde-website (`<script src=...>`) |

## Components (14)

| Fil | LOC | Formål |
|-----|-----|--------|
| `Sidebar.tsx` | 124 | Hovedmenu admin · 9 hovedlinks + 9 drift-links |
| `Topbar.tsx` | 286 | Søg + notifikationer + user-menu dropdown |
| `TrialBanner.tsx` | 25 | "Trial · 0 kr/md · alle moduler aktive" banner for bypilar |
| `FootScan.tsx` | 480 | Top/side/bottom-view fod-scanner med 8 biomarkør-overlays |
| `FootMesh3D.tsx` | 312 | Canvas-baseret 3D-mesh rotation (zero JS deps) |
| `SkinScan.tsx` | 96 | Æstetik-skanner UI til Nordlys-klinikker |
| `AddressAutocomplete.tsx` | 145 | DAWA-powered input med 200ms debounce |
| `CprMatch.tsx` | 92 | CPR-input + verifikation mod MitID-fødselsdato |
| `CvrLookup.tsx` | 152 | CVR-opslag + auto-fill firma-info |
| `NemSmsOptIn.tsx` | 158 | 6-kategori opt-in matrix |
| `PaymentStep.tsx` | 232 | PraxisOS Pay step i booking · viser 9 metoder + risk-score |
| `SubsidyBanner.tsx` | 94 | Auto-vælger bedste tilskud · falder til in_clinic ved 0 kr |
| `VoucherInput.tsx` | 134 | Klippekort/gavekort redeem-input |
| `SwarmPanel.tsx` | 45 | Agent-team aktivitets-panel |

## Scripts

| Fil | Formål |
|-----|--------|
| `scripts/generate_forarbejde_docx.py` | Python · genererer PraxisOS-Forarbejde.docx via python-docx |

## Total

- **60 endpoints** (49 pages + 14 API + 3 layouts)
- **19 lib-moduler** (~3.500 LOC forretningslogik)
- **14 components** (~2.300 LOC delt UI)
- **1 SQL migration** (450 LOC schema)
- **~15.000 LOC** total TypeScript/TSX/SQL

---

*Genereret 2026-06-16 fra `praxisos/prototype/` tree-walk*
