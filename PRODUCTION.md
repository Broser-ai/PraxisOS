# PraxisOS · Production go-live runbook

Sidste opdatering: 2026-07-31

Dette dokument er det praktiske runbook for at gå i luften — fra lokal `npm run dev`
til EU-deploy med rigtige integrationer.

Kodebasen ligger i **repo-roden** (ikke i en `prototype/`-mappe).

---

## TL;DR · 60 sekunder

```bash
# 1. Verificér build (skal være clean)
cd PraxisOS
npm install
npm run build          # ✓ Compiled · TypeScript OK · ~75 routes

# 2. Lokal start
npm run dev -- -H 127.0.0.1 -p 3002
# åbn http://127.0.0.1:3002/

# 3. Mock-data fungerer ud af kassen. Skift til Supabase når klar:
cp .env.example .env.local
# Udfyld PRAXIS_DB=supabase-local + SUPABASE_URL/keys
```

---

## Trin 1 · Forberedelse

1. **Domæner reserveret** · `praxisos.dk`, `praxis.app`, `*.praxis.app` (wildcard)
2. **CVR oprettet** · PraxisOS ApS · sat i `lib/payments.ts` som platform-merchant
3. **GDPR-dokumenter** · DPA, sub-processor liste, Art. 30-fortegnelse → lægges i `docs/legal/`
4. **NSIS-vurdering** · Substantial som baseline · Frej kører step-up til High ved sensitive operationer

---

## Trin 2 · Infrastruktur

### Database · Supabase EU (Ireland · eu-west-1)
```bash
# Engang
npm install -g supabase
supabase init
supabase login
supabase link --project-ref jajdtvduzkitjzcazcng

# Hver gang du ændrer schema
supabase db diff -f mit_modul        # genererer migration
supabase db push                      # push til prod
```

Migrations ligger i `supabase/migrations/`. Første migration `0001_initial_schema.sql`
opretter 18 tabeller med RLS-policies + hash-chain audit trigger.

> Bemærk: Vercel edge kører i `fra1` (Frankfurt). DB er `eu-west-1` (Ireland) — begge EU.

### Hosting · Vercel (Fluid Compute, Frankfurt)
```bash
npm i -g vercel
vercel link
vercel env add PRAXIS_DB production    # → supabase-eu
vercel env add SUPABASE_URL production
# osv. for alle keys i .env.example
vercel deploy --prod
```

Live URL: https://praxis-os-mu.vercel.app

---

## Trin 3 · DK-integrationer

Hver integration har en `lib/*.ts` modul og en `/admin/*` side der viser status.

| Integration | Modul | Status | Aktion før live |
|-------------|-------|--------|-----------------|
| **MitID broker** | `lib/auth.ts` | stub | Trust-aftale m. Idura/Signaturgruppen · client_id |
| **DAWA** | `app/api/dawa/` | live | Ingen aktion · public API |
| **CVR (cvrapi.dk)** | `app/api/cvr/` | live | 1000 lookups/dag · upgrade ved skalering |
| **NemSMS** | `lib/nemsms.ts` | stub | KOMBIT-onboarding · eller Bird.com |
| **MedCom** | `lib/reporting.ts` | stub | EAN-adresse · VANS-aftale · ca. 8 uger |
| **FMK / NSP** | `app/(internal)/admin/sundhed-dk/` | stub | Sundhedsdatastyrelsens trustaftale · 6 uger |
| **Sygeforsikringen "danmark"** | `lib/reporting.ts` | stub | Webservice-aftale · UN/EDIFACT D04A |
| **PraxisOS Pay** | `lib/payments.ts` | egen-built | Sætte real acquiring-bank op |

---

## Trin 4 · Tenant-onboarding

### Trial-kunder (gratis)
Markér tenant i `lib/tenants.ts` (eller `tenants`-tabel i Supabase):
```ts
trial: { unlimited: true, reason: "Pilot-kunde", since: "2026-06-15" }
```
Det disabler din platform-fee (`feeRateBp: 0`) og gør alle moduler aktive.

**by Pilar** er den primære trial-kunde. CVR 43947079.

### Betalende kunder
Selvbetjening via `/signup` → trin 1 (CVR-lookup) → trin 2 (kontakt) → trin 3 (plan).
Kalder POST `/api/signup` der opretter tenant + owner-konto (mock in-memory; Supabase service_role når env er sat).

---

## Trin 5 · Observability

- **Audit-log** · hash-chain via Postgres-trigger · vises i patientens "Min Log"
- **Sentry** · sæt `NEXT_PUBLIC_SENTRY_DSN`
- **Logflare** for Vercel-logs · `LOGFLARE_API_KEY`
- **Frej** anomali-engine kører i `app/(internal)/admin/agents/frej/engine/`

---

## Trin 6 · Compliance-tjekliste før salg

- [ ] DPA udarbejdet og signérbar af kunde i onboarding
- [ ] Trust-aftale m. Sundhedsdatastyrelsen i hus
- [ ] ISO 27001-light gennemført (pen-test bookt)
- [ ] Datatilsynet anmeldelse (ikke krævet for private SaaS, men best practice)
- [ ] Patient-flow: "Min Log" verificeret slutter på sundhed.dk
- [ ] Backup-strategi · PITR aktiveret i Supabase EU
- [ ] Disaster Recovery dokument · RTO 4t / RPO 1t

---

## Trin 7 · Pris-model i prod

Se `/pricing`. Sammenfatning:

| Plan | Pris | Bookings | Seats |
|------|------|----------|-------|
| Starter | 0 kr/md (trial) | 200/md | 1 |
| Practice | 595 kr/md | ubegrænset | 3 |
| Practice + AI | 1.295 kr/md | ubegrænset | 3 |
| Enterprise | tilbud | ubegrænset | ∞ |

Per-brug oveni: PraxisOS Pay 1,45%+0,50 kr · MitID 0,80 kr/login · NemSMS 0,18 kr/sms.

---

## Trin 8 · Health-monitorering

`/admin/health` viser realtids-status på alle integrationer.
