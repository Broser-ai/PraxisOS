> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.


# Michael's Action List · Human-only opgaver

**Sidst opdateret:** 2026-07-17 · efter Sprint 6 Batch 3 landet (334/334 tests grønne · build clean)
**Princip:** Denne liste er kun opgaver jeg (Claude) IKKE kan gøre autonomt. Alt kode-, dokument- og test-arbejde er allerede løbet og landet.

---

## 🧭 Sprint 6 blocker-track · MOSTLY-DONE ✅

Alle 19 audit-blockere er trackede i [`docs/harness/SPRINT-6-BLOCKER-PLAN.md`](docs/harness/SPRINT-6-BLOCKER-PLAN.md) og kombineret consolidated status i [`SPRINT-6-STATUS.md`](SPRINT-6-STATUS.md). Sprint 6 er substantielt lukket:

| Batch | Blockers | Status pr. 2026-07-17 |
|---|---|---|
| **Batch 1** shipped 2026-07-16 · commit `9f56ffd` | B1 (audit.ts) · B2 (canDispatchAgent) · B4 (orchestrator auth) | ✅ fixed · 150/150 tests grønne |
| **Batch 2** shipped 2026-07-16 | B3 · B7-partial · B8 · B9 + C2 · C3 (security + shared-store + regulatory-wiring) | ✅ landet · 220/220 tests grønne |
| **Batch 3** shipped 2026-07-17 | B12-progress · B15-progress · UX-a11y · CSP-headers · session-integration · consolidated docs | ✅ landet · **334/334 tests grønne** |
| **Sprint 7 kode-track** ⚪ | B5 · B6 · B7-rest · B10 · B11 · B13 · B14 · B19 | pending · impl-agent-swarm |
| **Michael-track** 👤 | B17 (Patient-Zero) · B18 (Ortos LOI) | pending · dine egne opkald · se §1 + §3 nedenfor |
| **Presafe-track** ⏸️ | B16 (Presafe letter) | on-hold · bevidst deprioriteret pr. dig 2026-07-13 |

**Michael-track (B17, B18) og Presafe-track (B16) er de eneste Sprint 6 blockere jeg *ikke* kan lukke autonomt.** Sprint 6 close-rate: **14/19 lukket eller substantielt wired · 5 til Sprint 7 · 3 til Michael-track.**

---

## 🔴 KRITISK denne uge (mandagen)

### ~~1. Send Presafe DK pre-submission letter~~ · ⏸️ PÅ HOLD (B16)

**Status pr. 2026-07-13:** Michael sætter Presafe på hold. by Pilar fungerer
som komplet test-objekt før vi engagerer Notified Body.

- **Fil bevaret:** [`docs/PRESAFE-DK-PRE-SUBMISSION-LETTER.md`](docs/PRESAFE-DK-PRE-SUBMISSION-LETTER.md) — klar til afsendelse når vi genoptager MDR-track
- **Konsekvens:** Class IIa-features (Niels/Scanner/Configurator/Liv) forbliver `frozen` i produktion. Class 0-features (Aria/Sigrid/Frej/Magnus/Vega/Bjørn) shippes fint uden CE-mark
- **Genoptag når:** by Pilar-piloten viser willingness-to-pay + kliniske outcomes berettiger MDR-investering
- **Audit-flag:** B16 — audit-rapporten flagger dette som "burns predicate-device window". Beslutning bevidst; genoptag når signal fra Patient-Zero-kohorten (§3) foreligger.

### 2. Ring/email Ortos for mill LOI (B18)
- **Kontakt:** Ortos ApS · info@ortos.dk · +45 43 96 66 66
- **Formål:** exclusive/preferential-partner-LOI for 90-dages STL→milled orthotic pilot
- **Talking points:** 48-timer turnaround · integration med vores FHIR `DeviceRequest` + Vorum RECT-format · start med 20 pilot-patienter fra by Pilar
- **Tid:** 1 time (samtale) + 1 uges opfølgning
- **Blokerer:** physical moat (Thiel/Petersen contrarian-anbefaling)
- **Cutover:** 14-dages fallback til Sahva eller Jutland regional lab hvis ingen response
- **Audit-flag:** B18 (audit §2 — "0 signed LOI, no physical moat")

### 3. Identificer 3 Patient-Zero klinikker (B17)
- **Kriterium:** non-affilierede fodterapeut-klinikker (IKKE by Pilar) villige til 30-dages betalt pilot til 1.295 kr/md
- **Tid:** 3-5 telefonopkald · Michael's netværk
- **Blokerer:** Patient-Zero-eksperiment (Ries lean-startup validation)
- **Pre-committed pivot-trigger:** <2/20 signed efter 28 dage → pivot channel eller kill thesis. Notér beslutningen på papir *før* outreach starter, så vanity-metrics-fælden lukkes.
- **Audit-flag:** B17 (audit §2 — "0 signed BS-mandates from non-affiliated Danish clinics after 5 sprints; UNCATEGORIZED-PLAY §1 vanity-metrics failure mode")

---

## 🟡 Denne måned

### 4. Engagér PRRC (Person Responsible for Regulatory Compliance)
- **Krav:** MDR Art. 15 obligatorisk for Class IIa-fabrikant
- **Kandidater:** Presafe DK · Intertek Nordic · QAdvis · Nordisk QA
- **Budget:** €40-80k årligt (deltid)
- **Deadline:** før teknisk fil-review kan starte

### 5. Engagér klinisk konsulent
- **Formål:** MEDDEV 2.7/1 rev.4 clinical evaluation writing + literature review
- **Kandidater:** dansk klinisk-forsker med fod-erfaring (evt. via Bispebjerg-netværk)
- **Budget:** €30-60k for retrospektiv + prospektiv-plan
- **Deadline:** før VEK-submission (Sprint 6, Q3 2026)

### 6. Datatilsynet DPIA-samtale
- **Formål:** Data Protection Impact Assessment for scan/audio/CPR-håndtering
- **Kontakt:** dt@datatilsynet.dk · via egen jurist eller CIVITAS/Bech-Bruun
- **Deadline:** før første prospektive patient enrolles

### 7. Set env-vars i Vercel prod-projekt
- **Filer:** `praxisos-scanner/` prod deployment
- **Krav:** følgende SKAL være sat før live-mode adaptere skifter fra stub:
  - `ANTHROPIC_API_KEY` (Bedrock EU via AWS)
  - `DEEPGRAM_API_KEY` (Nova-3 Medical da-DK)
  - `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` (self-hosted eu-north-1)
  - `MILL_API_KEY` (efter Ortos LOI)
  - `SYGESIKRINGEN_API_KEY` (efter MedCom-onboarding)
  - `FACTORING_API_KEY` (efter Aros Finans-aftale)
  - `MEDIAPIPE_ENABLED=1` (opt-in for gait-analyse)
  - `PRAXIS_SPRG_ALLOW_MOCK=0` (produktion afviser mock SPRG-grounding)
  - `PRAXIS_SESSION_SECRET` (32-byte hex · nyt krav efter B3 signed-session-migration · thrower i prod hvis mangler)
  - `FOOT_SCANNER_TOKEN` (thrower nu ved manglende værdi i prod · B8)
  - `PRAXIS_MCP_ORIGINS` (comma-separated allowlist for CORS · nyt krav efter C2 · wildcard kun i dev)
  - `PRAXIS_EVENTS_SECRET` (HMAC-secret for `/api/events` · thrower i prod · nyt krav efter C3)
  - `PRAXIS_EMBEDDINGS_ALLOW_STUB=0` (produktion afviser stub-fallback fra embeddings-adapter · B7)
- **Tid:** 30 min pr. batch efter hver ekstern kontrakt lander

---

## 🟢 Q3-Q4 2026 (kvartal-scope)

### 8. Bispebjerg VEK-submission
- **Fil:** [`docs/CLINICAL-EVALUATION-PROTOCOL-BISPEBJERG.md`](docs/CLINICAL-EVALUATION-PROTOCOL-BISPEBJERG.md)
- **Handling:** udpeg Principal Investigator på Bispebjerg Motion & Gait Lab → underskriv protokol → send til Region Hovedstadens VEK
- **Deadline:** 2026-08-15 (per protokol timeline)
- **Depend:** klinisk konsulent + PRRC skal være engaget først

### 9. Aros Finans / Danske Bank Erhverv factoring-aftale
- **Formål:** discount claim → 48h payout til klinikker
- **Model:** 2.5 % discount (250 bps) · non-recourse factoring
- **Kontakt:** aros-finans.dk · rådgivere ved Danske Bank Erhverv Vertikal Sundhed

### 10. Bird.com SMS-integration
- **Formål:** erstatte NemSMS (droppet i EPIC 1) med moderne channel
- **Kontakt:** bird.com/dk enterprise sales
- **Budget:** pay-as-you-go ~0,18-0,30 kr/SMS
- **Prioritet:** kun hvis Patient-Zero-klinikker beder om det

---

## 🔵 Løbende (månedlig cadence)

### 11. Månedlig PSUR-review
- **Fil:** genereret via `lib/surveillance/drift-monitor.ts` → `generateMonthlyReport()`
- **Handling:** review recommended-action (continue/review/freeze-clinical/rollback)
- **Ved rollback:** flip `tenants.mdr_status = 'pre_market'` for berørte tenants → freezer Class IIa-agenter
- **Tid:** 30 min/måned
- **Audit-flag:** audit §C10 — cron endnu ikke wired i `vercel.json`; planlagt til Sprint 7 (C10 residual audit-critical).

### 12. Notified Body audit-forberedelse
- **Cyklus:** hver 12 måneder efter CE-mark issued
- **Materiale:** technical file · post-market data · clinical evaluation update
- **Ejer:** PRRC + Michael

### 13. Årlig Model Card v.next publikation
- **Fil:** [`docs/MODEL-CARD-v1.md`](docs/MODEL-CARD-v1.md) → v2, v3...
- **Trigger:** hvert år eller ved model-drift der udløser retraining
- **Publikations-krav:** MDR Art. 83 + AI Act Art. 13 (transparency requirements)

---

## ⚫ EPIC-specifikke opfølgninger

### EPIC 1 · Orchestration
- [ ] Sæt `AGENT_ORCHESTRATION_ENABLED=true` i Vercel prod når du er klar til at aktivere Aria/Sigrid/Frej
- [ ] Migration 0003 apply til prod-branch (via `supabase db push` eller MCP-tool efter DBA-review)

### EPIC 2 · Clinical Scanner
- [ ] Efter CE-mark: sæt `feature_clinical_scanner_v2=true` pr. tenant der har underskrevet DPA
- [ ] Apply migrations 0004 + 0007 til prod
- [ ] **Nyt (Batch 1):** Apply migration `0008_hotfix.sql` (RLS-key + audit-trigger fix for `foot_scan_*`) — allerede shipped i repo, mangler prod-apply
- [ ] **Sprint 7 (planlagt):** Apply migration `0009` (fuld B10/B11 re-verify + CI grep-guard) — planlagt efter Sprint 7 data-model-fixer

### EPIC 3 · Neural Configurator
- [ ] Vorum Canfit login-credentials (efter LOI)
- [ ] STL post-verify library (Manifold3D-integration)
- [ ] Godkend eller ændr min konsolidering af 9→3 agenter (Aria/Sigrid/Frej aktive)

### EPIC 4 · E-Learning
- [ ] Godkend content-corpus (5 danske + 1 engelsk artikel · alle med reelle DOI/URL)
- [ ] Beslut om vi skal bygge klient-vendt E-Learning (Class 0 non-medical) i Sprint 5

---

## 🧪 EPIC 2-REVISION-01 · fabrikerede citater

Innovation-swarm producerede en fabrikeret EPIC-2-REVISION-01.md (arxiv-IDs `2607.xxxxx` som ikke eksisterer). Erstattet af `EPIC-2-REVISION-02.md` med ægte citater. **Action:** verificer at ingen andre steder i vores dokumentation refererer til de fabrikerede IDs.

---

## ✅ ALLEREDE GJORT (ingen action behøvet)

- ✓ 4 EPICs kontrakter skrevet + reviewet (Meta-Contrarian + Medical + Guru + Humanized + Frontier + Innovation)
- ✓ Sprint 1-4 kode + tests + migrationer (122/122 tests grønne · build ✓)
- ✓ 6 tunge rapporter · 5.6M+ tokens fra 58 verdensklasse ekspert-agenter
- ✓ Presafe letter · Bispebjerg protokol · Model Card v1 draft
- ✓ Persona-hub integration med licens-håndtering
- ✓ MDR classification split (Class 0 aria/sigrid/frej aktive · Class IIa frozen)
- ✓ Klinisk data-model expansion (neurology + vascular + IWGDF + temperature + consent)
- ✓ FHIR R5 façade · Voice-plane skeleton · Vorum mill adapter · Oklab + IES lighting
- ✓ **Sprint 6 Batch 1 (2026-07-16 · commit `9f56ffd`):** B1 `lib/audit.ts` reelt writer · B2 `canDispatchAgent` gate wired i supervisor+worker · B4 orchestrator-route deriver `actorRole` fra authentic session. 150/150 tests grønne, build clean.
- ✓ **Sprint 6 Batch 2 (2026-07-16):** B3 HMAC-signed sessions + scrypt-passwords + strict cookies · B8 `FOOT_SCANNER_TOKEN` throws i prod · B9 SharedStore-interface for GPU-budget + rate-limit · B7-partial embeddings + LiveKit fail-closed · C2 CORS-allowlist på `/api/mcp/v1` · C3 HMAC på `/api/events` i alle miljøer · 4 EPIC-kontrakter fik §DoD-Actual-appendix. 220/220 tests grønne. Fuld manifest: `SPRINT-6-BATCH-2-STATUS.md`.
- ✓ **Sprint 6 Batch 3 (2026-07-17):** B12-progress INV-integration-coverage · B15-progress SPRG-tests · UX-a11y focus-ring + focus-trap tests (WCAG 2.4.7) · CSP-headers tests (`frame-ancestors 'none'` + `object-src 'none'` + HSTS) · session-integration end-to-end tests · consolidated `SPRINT-6-STATUS.md` docs. **334/334 tests grønne**, build clean.

---

*Denne fil regenereres/opdateres efter hver sprint. Se `STATE-OF-THE-ART-MASTER-REPORT.md` for strategisk kontekst, `SPRINT-6-STATUS.md` for consolidated Sprint 6 status, og `docs/harness/SPRINT-6-BLOCKER-PLAN.md` for parallel impl-agent-track.*
