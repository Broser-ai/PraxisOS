# PraxisOS — første review (localhost)

Native udkast af et komplet klinisk operativsystem: booking, journal, agentic AI, AR/CV, Physical AI body-scan. **Multi-tenant fra dag ét** — kan både være backend for bypilar.dk og sælges separat som white-label software.

---

## Start her — på 30 sekunder

```bash
cd C:\Users\Ambro2\praxisos\prototype
npm run dev
# åbn http://localhost:3001
```

Du lander på **`/review`** — en guided tour med 5 nøgle-skærme du skal klikke gennem.

> Fonts loades fra Google Fonts (kræver internet i browseren).

---

## De 5 ting du skal se

| # | URL | Hvad du ser |
|---|---|---|
| 1 | [`/demo/bypilar-website`](http://localhost:3001/demo/bypilar-website) | **Mock af bypilar.dk** med vores embed indsat (én script-linje). Klik "Book" → modal åbner med booking-flow på deres side |
| 2 | [`/t/bypilar`](http://localhost:3001/t/bypilar) | **White-label frontend** for bypilar — den fulde hostede version under deres brand |
| 3 | [`/t/nordlys`](http://localhost:3001/t/nordlys) | **Samme kode, andet brand** (Nordlys Klinik) — beviser multi-tenant virker |
| 4 | [`/admin/tenants`](http://localhost:3001/admin/tenants) | **Operatør-view** — alle tenants, plan, license-matrix |
| 5 | [`/admin/integration/bypilar`](http://localhost:3001/admin/integration/bypilar) | **Integrations-guide** — det vi sender til bypilar's udvikler |

## Interne moduler (staff-UI)

| URL | Indhold |
|---|---|
| [`/dashboard`](http://localhost:3001/dashboard) | Overblik · dagens program · Aria-natten-over |
| [`/kalender`](http://localhost:3001/kalender) | Uge-kalender · AI-foreslåede tider |
| [`/klienter`](http://localhost:3001/klienter) | Klient-DB med forløbs-trend |
| [`/klienter/mette`](http://localhost:3001/klienter/mette) | **AR hud-scan** før/efter-slider + kvantitative scores |
| [`/scribe`](http://localhost:3001/scribe) | **AI Scribe** — tryk «Start optagelse» for at se det virke |
| [`/agent`](http://localhost:3001/agent) | **Aria** — autonom booking-agent |
| [`/scan`](http://localhost:3001/scan) | **Fod-scan** — 3-agent swarm, plantar pressure, hallux valgus, biomarkers |
| [`/scan/start`](http://localhost:3001/scan/start) | **Live fod-scan-flow** — fra patient ankommer til klinisk rapport |
| [`/felt`](http://localhost:3001/felt) | Felt-service · offline-first rute |
| [`/indstillinger`](http://localhost:3001/indstillinger) | Integrationer + compliance |

## API-endpoints (klar til bypilar.dk)

```bash
# Liste af ydelser
curl http://localhost:3001/api/v1/bypilar/services

# Ledige tider
curl "http://localhost:3001/api/v1/bypilar/availability?service=fod-med&days=5"

# Opret booking → 201 + Aria-bekræftelse
curl -X POST http://localhost:3001/api/v1/bypilar/bookings \
  -H "content-type: application/json" \
  -H "idempotency-key: $(uuidgen)" \
  -d '{
    "serviceId": "fod-med",
    "startsAt": "2026-06-12T14:00:00+02:00",
    "modality": "Klinik",
    "client": { "name": "Jane Doe", "email": "jane@example.com", "phone": "+45 12 34 56 78" }
  }'
```

## Embed på bypilar.dk — det er **én linje**

```html
<script src="http://localhost:3001/embed/v1/bypilar" defer></script>

<!-- og hvor som helst en knap: -->
<button data-praxis-book="fod-med">Book medicinsk fodpleje</button>
```

Klik → modal åbner direkte på siden med booking-flowet. Bekræftet booking → 🎉 confetti + auto-luk efter 3,5 sek. Sender også `praxis:booking` custom event til kundens analytics.

## Stack
Next.js 16 (App Router, route groups) · React 19 · Tailwind v4 · TypeScript. Multi-tenant via `lib/tenants.ts` (fil-baseret nu, swappes til Supabase EU i Fase 0).

## Dokumenter
- `..\01-research-og-mvp-plan.md` — konkurrentanalyse + EasyPractice teardown
- `..\02-arkitektur-og-byggeplan.md` — fuld arkitektur + step-by-step byggeplan
- `..\03-multi-tenant-og-bypilar.md` — multi-tenant model + bypilar-integrationsplan
