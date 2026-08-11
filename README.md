# PraxisOS — første review (localhost)

Native udkast af et komplet klinisk operativsystem: booking, journal, agentic AI, AR/CV, Physical AI body-scan. **Multi-tenant fra dag ét** — kan både være backend for bypilar.dk og sælges separat som white-label software.

> Kodebasen ligger i **repo-roden** (`github.com/Broser-ai/PraxisOS`). Der er ingen `prototype/`-mappe.

---

## Start her — på 30 sekunder

```bash
git clone git@github.com:Broser-ai/PraxisOS.git
cd PraxisOS
npm install
npm run dev -- -H 127.0.0.1 -p 3002
# åbn http://127.0.0.1:3002/
```

Du lander på **`/`** (public landing). Staff-tour: **`/review`**. Login: `pilar@bypilar.dk` / `demo`.

> Fonts loades fra Google Fonts (kræver internet i browseren).

---

## De 5 ting du skal se

| # | URL | Hvad du ser |
|---|---|---|
| 1 | [`/demo/bypilar-website`](http://127.0.0.1:3002/demo/bypilar-website) | **Mock af bypilar.dk** med vores embed indsat (én script-linje). Klik "Book" → modal åbner med booking-flow på deres side |
| 2 | [`/t/bypilar`](http://127.0.0.1:3002/t/bypilar) | **White-label frontend** for bypilar — den fulde hostede version under deres brand |
| 3 | [`/t/nordlys`](http://127.0.0.1:3002/t/nordlys) | **Samme kode, andet brand** (Nordlys Klinik) — beviser multi-tenant virker |
| 4 | [`/admin/tenants`](http://127.0.0.1:3002/admin/tenants) | **Operatør-view** — alle tenants, plan, license-matrix |
| 5 | [`/admin/integration/bypilar`](http://127.0.0.1:3002/admin/integration/bypilar) | **Integrations-guide** — det vi sender til bypilar's udvikler |

## Interne moduler (staff-UI)

| URL | Indhold |
|---|---|
| [`/dashboard`](http://127.0.0.1:3002/dashboard) | Overblik · dagens program · Aria-natten-over |
| [`/kalender`](http://127.0.0.1:3002/kalender) | Uge-kalender · AI-foreslåede tider |
| [`/klienter`](http://127.0.0.1:3002/klienter) | Klient-DB med forløbs-trend |
| [`/klienter/mette`](http://127.0.0.1:3002/klienter/mette) | **AR hud-scan** før/efter-slider + kvantitative scores |
| [`/scribe`](http://127.0.0.1:3002/scribe) | **AI Scribe** — tryk «Start optagelse» for at se det virke |
| [`/agent`](http://127.0.0.1:3002/agent) | **Aria** — autonom booking-agent |
| [`/scan`](http://127.0.0.1:3002/scan) | **Fod-scan** — 3-agent swarm, plantar pressure, hallux valgus, biomarkers |
| [`/scan/start`](http://127.0.0.1:3002/scan/start) | **Live fod-scan-flow** — fra patient ankommer til klinisk rapport |
| [`/felt`](http://127.0.0.1:3002/felt) | Felt-service · offline-first rute |
| [`/indstillinger`](http://127.0.0.1:3002/indstillinger) | Integrationer + compliance |
| [`/admin/health`](http://127.0.0.1:3002/admin/health) | System-status · go-live checklist |
| [`/signup`](http://127.0.0.1:3002/signup) | 3-trins signup · POST `/api/signup` |

## API-endpoints (klar til bypilar.dk)

```bash
# Liste af ydelser
curl http://127.0.0.1:3002/api/v1/bypilar/services

# Ledige tider
curl "http://127.0.0.1:3002/api/v1/bypilar/availability?service=fod-med&days=5"

# Opret booking → 201 + Aria-bekræftelse
curl -X POST http://127.0.0.1:3002/api/v1/bypilar/bookings \
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
<script src="http://127.0.0.1:3002/embed/v1/bypilar" defer></script>

<!-- og hvor som helst en knap: -->
<button data-praxis-book="fod-med">Book medicinsk fodpleje</button>
```

Klik → modal åbner direkte på siden med booking-flowet. Bekræftet booking → 🎉 confetti + auto-luk efter 3,5 sek. Sender også `praxis:booking` custom event til kundens analytics.

## Stack
Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript. Multi-tenant via `lib/tenants.ts` (fil-baseret nu; `PRAXIS_DB=supabase-eu` i prod).

## Dokumenter
- `HANDOVER.md` — komplet system-handover (single source of truth)
- `CODE-MAP.md` — fil-for-fil oversigt
- `PRAXISOS-BRIEF.md` — kort system-brief
- `PRODUCTION.md` — go-live runbook
- `.env.example` — env-skabelon
