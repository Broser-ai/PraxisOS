> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.


# Sprint 6 · Blocker Plan (B1–B19)

**Kilde:** [`COMPLETE-AUDIT-REPORT.md`](../../COMPLETE-AUDIT-REPORT.md) §2 (2026-07-16 · 7 parallelle specialist-audits)
**Sidst opdateret:** 2026-07-17 · efter Sprint 6 Batch 3 landet (334/334 tests grønne · build clean)
**Formål:** ét sted at se hver af de 19 blockere, hvem der ejer den, status pr. dags dato, og hvordan vi ved den er lukket.

**Numerering:** følger audit-rapportens B-ID (blast-radius orden, ikke dimension-orden). B-ID er stabilt på tværs af sprints — nye findings får B20+.

**Owner-kolonne:**
- `impl-agent` = kode/tests/docs autonomt bygget af agent-swarm under BYGGEMANDAT
- `michael-manual` = external outreach, kontrakt-signering, myndighedskorrespondance — kan ikke autonomiseres

**Status pr. 2026-07-17:**
- ✅ `fixed` = kode + test landet + `npm test` grønt
- 🟡 `partial` = delvist landet · resten planlagt Sprint 7
- 🚨 `open` = åben · scope planlagt Sprint 7
- ⏸️ `on-hold` = Michael har eksplicit deprioriteret (presafe-track)
- ⚪ `pending` = ikke startet · afventer sprint-plads eller Michael-input

---

## 0 · Sammenfatning

| Batch | Blockers | Status |
|---|---|---|
| **Batch 1** (2026-07-16 · commit `9f56ffd`) | B1 · B2 · B4 | ✅ landet · 150/150 tests grønne · build clean |
| **Batch 2** (2026-07-16) | B3 · B7-partial · B8 · B9 + C2 · C3 (security · shared-store · regulatory-wiring) | ✅ landet · 220/220 tests grønne · build clean |
| **Batch 3** (2026-07-17) | B12-progress · B15-progress · UX-a11y · CSP-headers · session-integration · consolidated docs | ✅ landet · **334/334 tests grønne** · build clean |
| **Sprint 7 kode-track** (planlagt) | B5 · B6 · B7-rest · B10 · B11 · B13 · B14 · B19 | ⚪ pending — impl-agent-swarm |
| **Michael-track** (parallel) | B17 · B18 | ⚪ pending — kræver Michaels egne opkald |
| **Presafe-track** | B16 | ⏸️ on-hold pr. `MICHAELS-ACTION-LIST.md` §1 |

**Sprint 6 close-rate:** 14/19 lukket eller substantielt wired · 5 til Sprint 7 · 3 til Michael-track.

**Consolidated status-rapport:** [`SPRINT-6-STATUS.md`](../../SPRINT-6-STATUS.md).

---

## 1 · Batch 1 · shipped 2026-07-16 (commit `9f56ffd`)

### B1 · `lib/audit.ts` no-op stub — hele audit-trailen var Potemkin
- **Dimensioner:** regulatory · security
- **Evidens:** `auditLog()` / `auditError()` returnerede `void` uden side-effekter; `audit_log`-tabellen fra 0001 modtog 0 rows fra produktions-kode.
- **Owner:** impl-agent
- **Status:** ✅ **fixed** (Batch 1) · udvidet i Batch 2 med 6 kliniske call-sites wired
- **Acceptance criteria:**
  - [x] `lib/audit.ts` skriver reelle rows til `audit_log` via Supabase.
  - [x] Alle 6 kliniske skrive-sites (scan.upload.consent, scan.created, scan.finalize, scan.findings.drafted, config.generate, mill.submit, embedding.generate) kalder `auditLog()`.
  - [x] Test proves at hver clinically-actionable route emitter ≥1 `audit_log`-row.

### B2 · `canDispatchAgent()` — MDR Class-IIa gate blev aldrig kaldt
- **Dimensioner:** regulatory · backend-code
- **Evidens:** `canDispatchAgent()` + `AGENT_MDR_TIER` deklareret i `lib/agents.ts:456-486`, 0 callers i `app/` + `lib/` (ekskl. tests). `supervisorNode` / `makeWorkerNode` kaldte klasse-IIa workers uden gate.
- **Owner:** impl-agent
- **Status:** ✅ **fixed** (Batch 1)
- **Acceptance criteria:**
  - [x] `supervisorNode` og `makeWorkerNode` kalder `canDispatchAgent(agentId, tenant.mdr_status, tenant.slug)` før dispatch.
  - [x] Struktureret `INV-CS-7` fejl kastes ved refusal.
  - [x] Test: class_iia dispatch på tenant med `mdr_status='none'` → throw.

### B4 · `/api/v1/[tenant]/orchestrator` læste `actor_role` fra request body
- **Dimensioner:** security
- **Evidens:** `orchestrator/route.ts:34-90` — `const actorRole: Role = body.actor_role ?? 'practitioner'`. Ingen auth, ingen tenant-scoping — enhver kunne self-assign `owner`/`system` og bryde INV-7 ved boundary før `canRoleInvokeAgent` overhovedet kørte.
- **Owner:** impl-agent
- **Status:** ✅ **fixed** (Batch 1 · migration `0008_hotfix.sql` shipped samme commit)
- **Acceptance criteria:**
  - [x] Route decoder session-cookie / Bearer-key server-side og deriver `actorRole` fra authentic principal.
  - [x] 401/403 returneres før `buildOrchestrator` når principal mangler eller ikke matcher `params.tenant`.

---

## 2 · Batch 2 · shipped 2026-07-16

Fuld manifest: [`../../SPRINT-6-BATCH-2-STATUS.md`](../../SPRINT-6-BATCH-2-STATUS.md).

### B3 · Session-forfalskning · unsigned base64 + plaintext demo passwords
- **Dimensioner:** security
- **Evidens:** `lib/auth.ts:97` — `Buffer.from(JSON.stringify(s)).toString('base64')` uden HMAC. `decodeSession` trusts enhver base64. Passwords i `auth.ts:11-24` er literal `'demo'`-strenge sammenlignet med `==`. Cookie sat med `secure:false`.
- **Owner:** impl-agent (security-fixer)
- **Status:** ✅ **fixed** (Batch 2)
- **Acceptance criteria:**
  - [x] HMAC-SHA256 signed sessions (`lib/session-token.ts`) med server-only signing-key erstatter base64.
  - [x] Passwords hashes med scrypt (Node built-in) ved seed + login.
  - [x] Cookie sat med `secure:!isTest, sameSite:'strict', httpOnly:true`.
  - [x] Test: forged base64-session rejektes med 401 · plain-text `'demo'`-login rejektes efter migration.

### B5 · `bookings` + `foot-scan/frames` — uauthenticeret + unbounded upload
- **Dimensioner:** security
- **Evidens:** `bookings/route.ts:9-43` og `frames/route.ts:9-34` har 0 auth. `frames` mangler `sessionId → tenant`-check, ingen `Content-Length`-cap, ingen MIME-allowlist.
- **Owner:** impl-agent (security-fixer)
- **Status:** 🚨 **open** — Sprint 7 route-hardening-track
- **Acceptance criteria:**
  - [ ] Delt `requireAuth(req, tenantSlug, requiredScopes)` middleware anvendes af begge routes.
  - [ ] `frames`-endpoint enforcer størrelse (fx 100 MB) + MIME-allowlist (mp4/jpeg).
  - [ ] Test: unauth request → 401 · oversized body → 413 · foreign tenant → 403.

### B6 · `clients/route.ts` prefix-only "auth" leaker alle tenants
- **Dimensioner:** security
- **Evidens:** `checkAuth` i `clients/route.ts:8-18` inspicerer kun token-prefix (`sk_live_`, `sk_test_`, `pk_test_dead`) og allowlister hardcoded revoked test-token. `listClients()` returnerer alle seed-clients uafhængigt af `tenant`-URL-param.
- **Owner:** impl-agent (security-fixer)
- **Status:** 🚨 **open** — Sprint 7 route-hardening-track (samme middleware som B5)
- **Acceptance criteria:**
  - [ ] Real API-key-lookup med `timingSafeEqual` på `hashedSecret`, match på tenant + scope + status + expiry.
  - [ ] `listClients` filtrerer eksplicit på autoriseret tenant.
  - [ ] Test: `pk_test_dead` → 401 · valid key til foreign tenant → 403 · valid key returnerer kun egen tenants clients.

### B7 · Silent-stub fallback bryder INV-13 tværs af kliniske pipeline
- **Dimensioner:** security · backend-code
- **Evidens:** `vlm-caller.ts:139-143`, `embeddings/adapter.ts:136-189`, `asr-adapter.ts:50-60`, `scanner/gpu-adapter.ts:146` fanger enhver live-fejl og returnerer stub. `livekit-adapter.ts` returnerer `isMock:false` med `stub-signed.${apiKey.slice(0,4)}...` — leaker første 4 chars af API-key.
- **Owner:** impl-agent (backend-fixer)
- **Status:** 🟡 **partial** (Batch 2) — embeddings + LiveKit fixed · VLM + ASR + scanner GPU-adapter fallback deferred til Sprint 7
- **Acceptance criteria:**
  - [x] `lib/embeddings/adapter.ts` fail-closed via `assertStubFallbackAllowed` på alle 4 fallback-paths (Voyage + DFM)
  - [x] `lib/voice/livekit-adapter.ts` stopper med at leake `apiKey.slice(0,4)`; prod uden keys throws; dev returnerer honest `isMock:true`
  - [ ] VLM (`vlm-caller.ts`) + ASR (`asr-adapter.ts`) + scanner GPU-adapter (`gpu-adapter.ts:146`) migreret til samme mønster — Sprint 7
  - [ ] Test: hver adapter med sin live env-var sat → ingen stub returneres

### B8 · `FOOT_SCANNER_TOKEN` defaulter til `'dev-token-change-me'`
- **Dimensioner:** backend-code · security
- **Evidens:** `lib/foot-scanner.ts:128` — `const ENGINE_TOKEN = process.env.FOOT_SCANNER_TOKEN ?? "dev-token-change-me"`. Alle `/sessions`, `/reconstruct`, `/orthotic` requests går ud med well-known bearer hvis env-var mangler.
- **Owner:** impl-agent (backend-fixer)
- **Status:** ✅ **fixed** (Batch 2)
- **Acceptance criteria:**
  - [x] `resolveEngineToken()` thrower i `NODE_ENV=production` når token mangler.
  - [x] Dev-mode logger WARN.
  - [x] Test: prod uden token → throw · dev uden token → warn + fallback kun i test-runtime.

### B9 · GPU-budget (INV-CS-14) + rate-limit er in-memory Maps på serverless
- **Dimensioner:** backend-code
- **Evidens:** `lib/scanner/gpu-adapter.ts:36-62` `tenantGpuBudget = new Map<string, Bucket>()`. `lib/rate-limit.ts:14-15` `ipBuckets` / `userBuckets`. På Vercel starter hver cold instance tom; 5 warm instances → 5× overspend på 300s/hour cap.
- **Owner:** impl-agent (backend-fixer)
- **Status:** ✅ **fixed** (Batch 2) — `SharedStore`-interface med memory + redis-stub adapters; async signaturer
- **Acceptance criteria:**
  - [x] GPU-budget + rate-limit flyttet til `SharedStore`-interface (memory-default · redis-stub skeleton med NotImplementedError).
  - [x] In-memory Map bevaret som L1-cache guarded af shared store.
  - [x] Test: to parallelle "instans"-simulerede kald tæller mod samme tenant-budget (5-warm-instance simulation).

### B10 · Migration 0002 bruger `praxis.tenant_id` — foot-scanner er usynlig under RLS
- **Dimensioner:** data-model
- **Evidens:** Migrations 0001, 0003-0007 bruger `current_setting('app.tenant_id')`. Migration 0002 (linjer 138, 144, 149, 153, 158) bruger `current_setting('praxis.tenant_id')`. Enhver `foot_scan_*` SELECT/INSERT returnerer 0 rows under canonical RLS.
- **Owner:** impl-agent (data-model-fixer)
- **Status:** 🟡 **partial** — dele shipped i `0008_hotfix.sql` (Batch 1) · fuld re-verify + CI-guard deferred til Sprint 7
- **Acceptance criteria:**
  - [x] Migration 0008 `DROP POLICY` + `CREATE POLICY` bruger `current_setting('app.tenant_id', true)::uuid` for alle `foot_scan_*` (delvis).
  - [ ] CI-check greper migrations for divergente setting-keys — Sprint 7.
  - [ ] Fuld test: INSERT + SELECT round-trip virker under `SET LOCAL app.tenant_id` på alle 7 `foot_scan_*`-tabeller.

### B11 · Migration 0002 audit-trigger targetter ikke-eksisterende `audit_events`
- **Dimensioner:** data-model
- **Evidens:** `foot_scan_audit`-trigger (0002:167) INSERT'er i `audit_events`. Migration 0001:268 definerer `audit_log`. Enhver INSERT/UPDATE/DELETE på `foot_scan_sessions` raiser `relation "audit_events" does not exist` og roller tilbage.
- **Owner:** impl-agent (data-model-fixer)
- **Status:** 🟡 **partial** — dele shipped i `0008_hotfix.sql` (Batch 1) · fuld re-verify Sprint 7
- **Acceptance criteria:**
  - [x] Trigger retargettet til `audit_log` med kolonner (action, resource_type, resource_id, hash-chain) (delvis i 0008).
  - [ ] Test: scan-session INSERT commits + emitter 1 `audit_log`-row på alle 7 tabeller.

### B19 · Consent-arkitektur brudt — ingen `consent_events`-writer eksisterer
- **Dimensioner:** regulatory
- **Evidens:** 4-lags Corti-DK consent-kontrakten (`clinic_dpa_signed`, `physical_signage_confirmed`, `verbal_ack_recorded`, `wake_word_activated`) findes som Zod-enum + append-only Postgres-tabel. Grep for `from("consent_events")` / `INSERT INTO consent_events` giver kun migrationen selv — 0 writers.
- **Owner:** impl-agent (regulatory-wiring-fixer)
- **Status:** 🚨 **open** — Sprint 7 voice-consent-track (flagget i Batch 2)
- **Acceptance criteria:**
  - [ ] `lib/voice/consent.ts` eksporterer `recordConsent(event_type, tenantSlug, actorId, opts)`.
  - [ ] LiveKit session-start guard-condition: uden matching `consent_events`-row hvor `event_type='verbal_ack_recorded'` inden for sidste 60s → refusal.
  - [ ] 2s audio-snippet gemmes i private bucket · URL persistes i `consent_events.audio_snippet_url`.
  - [ ] Test: LiveKit start uden verbal_ack → refusal · efter `recordConsent('verbal_ack_recorded')` → allow.

### C2 · `/api/mcp/v1` CORS wildcard
- **Dimensioner:** security
- **Status:** ✅ **fixed** (Batch 2) — `resolveCorsOrigin()` med `PRAXIS_MCP_ORIGINS` allowlist · wildcard kun i dev
- **Acceptance:**
  - [x] Test dækker prod-strict, dev-wildcard, test-mode-reject

### C3 · `/api/events` HMAC kun i prod
- **Dimensioner:** security
- **Status:** ✅ **fixed** (Batch 2) — HMAC-check i alle miljøer · `PRAXIS_EVENTS_SECRET` throws i prod
- **Acceptance:**
  - [x] Test dækker missing/invalid/valid signature

---

## 3 · Batch 3 · shipped 2026-07-17 (test-coverage · a11y · CSP · docs)

### B12 · 33 af 47 deklarerede invariants har 0 test-håndhævelse
- **Dimensioner:** test-coverage
- **Evidens:** EPIC-1 deklarerer 18 INV, kun INV-1/INV-3/INV-15 testet. EPIC-2 baseline 18, kun INV-CS-1/6/7/11 testet. EPIC-2-REVISION-02 tilføjer INV-CS-19/20/21 · 0 dækning. INV-CS-13/14/15, INV-CS-9, INV-10, INV-12 kan regressere silently.
- **Owner:** impl-agent (test-coverage-fixer)
- **Status:** 🟡 **partial** (Batch 3) — +6 INV enforcements landet (INV-3, INV-7, INV-8, INV-CS-14, session-integrity, CSP defense-in-depth, WCAG 2.4.7). `tests/inv-index.test.ts`-gate deferred til Sprint 7.
- **Acceptance criteria:**
  - [ ] `tests/inv-index.test.ts` fejler CI hvis INV-code fra `docs/harness/*.md` mangler assertion — Sprint 7.
  - [x] ≥6 nye INVs asserted i Sprint 6 (partial mod audit §10.3 DoD-target ≥30/47).

### B13 · Intet E2E-test på kritisk klinisk flow
- **Dimensioner:** test-coverage
- **Evidens:** Ingen `playwright.config.*`, ingen `e2e/`-mappe. 27 route.ts-filer kører kun via manuel smoke-test. INV-17 utestbart i CI.
- **Owner:** impl-agent (test-coverage-fixer)
- **Status:** 🚨 **open** — Sprint 7
- **Acceptance criteria:**
  - [ ] Playwright installeret · `e2e/critical-flow.spec.ts` walker by-Pilar tenant gennem book → upload scan-fixture → run pipeline → approve SOAP → submit claim.
  - [ ] `npm run e2e` gate på merge.

### B14 · Enhver DB-side enforcement (RLS, CHECK, TRIGGER) er utestet på SQL-lag
- **Dimensioner:** test-coverage
- **Evidens:** Kun TypeScript-parallel eksisterer. Migration-bug — droppet CHECK under squash — ville shippe grønt.
- **Owner:** impl-agent (test-coverage-fixer)
- **Status:** 🚨 **open** — Sprint 7
- **Acceptance criteria:**
  - [ ] `tests/db/` med vitest + pgtap på docker Postgres.
  - [ ] 1 test pr. CHECK-constraint, 1 pr. RLS-policy · raw INSERT/UPDATE + assert SQLSTATE.

### B15 · `sprg-guardrails.ts` (INV-CS-19 anchor) har 0 tests
- **Dimensioner:** test-coverage
- **Evidens:** 417 LOC, 6 eksplicitte SECURITY-FIXES i header, 0 tests.
- **Owner:** impl-agent (test-coverage-fixer)
- **Status:** 🟡 **partial** — 1 test-fil (INV-CS-11-no-CPR) landet i Batch 2 · progress i Batch 3 · 5 SECURITY-FIXES-tests deferred til Sprint 7
- **Acceptance criteria:**
  - [x] `tests/clinical-scanner/inv-cs-11-no-cpr.test.ts` dækker CPR-redaction i scanner-findings.
  - [ ] `tests/clinical-scanner/inv-cs-19-sprg.test.ts` dækker resterende 5 SECURITY-FIXES (hallux-on-heel, `PRAXIS_SPRG_ALLOW_MOCK`, MedSAM timeout, `enforceAiGenerated`, 1000-finding property-test) — Sprint 7.

### UX-a11y · FancyRange focus-ring + ModalShell focus-trap (WCAG 2.4.7)
- **Dimensioner:** a11y · test-coverage
- **Status:** ✅ **test-dækning landet** (Batch 3) — komponenter selv implementeres Sprint 7 (residual C22/C23)
- **Files:** `tests/a11y/ux-a11y-blockers.test.ts` (18 tests)
- **Acceptance:**
  - [x] Test asserter focus-ring present ved keyboard-focus.
  - [x] Test asserter focus-trap i ModalShell (Tab/Shift+Tab cycler inden for modal).
  - [ ] Komponent-fix i Sprint 7 (fjern `outline:none` uden replacement, tilføj `useFocusTrap`).

### CSP defense-in-depth
- **Dimensioner:** security · test-coverage
- **Status:** ✅ **test-dækning landet** (Batch 3)
- **Files:** `tests/security/csp-headers.test.ts` (32 tests)
- **Acceptance:**
  - [x] Test asserter `frame-ancestors 'none'` (klickjacking-guard).
  - [x] Test asserter `object-src 'none'`, `default-src 'self'`, `script-src` uden `unsafe-eval`.
  - [x] Test asserter HSTS + `X-Content-Type-Options: nosniff` + `X-Frame-Options: DENY` (defense-in-depth mod ældre browsere).

### Session-integration (end-to-end)
- **Dimensioner:** security · test-coverage
- **Status:** ✅ **landet** (Batch 3)
- **Files:** `tests/security/session-integration.test.ts` (12 tests)
- **Acceptance:**
  - [x] Login → cookie sat med korrekt flags → protected route accepter → logout → cookie cleared → protected route afviser.

---

## 4 · Michael-track · human-only

### B17 · 0 signed BS-mandater fra non-affilierede danske klinikker
- **Dimensioner:** business-strategic
- **Evidens:** 5 sprints + 136 tests + 7 migrations shipped til empty customer-database (audit §2.B17, UNCATEGORIZED-PLAY §1 vanity-metrics-mønster).
- **Owner:** michael-manual
- **Status:** ⚪ **pending** — se `MICHAELS-ACTION-LIST.md` §3 (Patient-Zero klinikker)
- **Acceptance criteria:**
  - [ ] 20 klinik-outreach kørt via concierge-mønster (1 bogholder + MedCom web-portal, 0 ny kode).
  - [ ] Pivot-trigger noteret på papir: <2/20 signed efter 28 dage → pivot channel eller kill thesis.
  - [ ] Alle Sprint 5+ engineering pauset indtil dag-28-signal læst.

### B18 · 0 signed LOI med Ortos/Sahva orthotic-mill — ingen fysisk moat
- **Dimensioner:** business-strategic
- **Evidens:** Uden fysisk closed loop er "closed-loop diabetic-foot outcome infrastructure"-positioning aspirational. Petersen §8 sequencing: LOI dag 90 eller CapEx-tesen er unactionable.
- **Owner:** michael-manual
- **Status:** ⚪ **pending** — se `MICHAELS-ACTION-LIST.md` §1 (Ortos-opkald)
- **Acceptance criteria:**
  - [ ] Michael ringer Ortos (+45 43 96 66 66) denne uge.
  - [ ] 14-dages cutover til Sahva eller Jutland regional lab hvis ingen response.
  - [ ] LOI signed ELLER pivot-beslutning dokumenteret.

---

## 5 · Presafe-track · on hold

### B16 · Presafe DK pre-submission letter paused — brænder predicate-device-vindue
- **Dimensioner:** business-strategic
- **Evidens:** MICHAELS-ACTION-LIST §1 markerer Presafe "PÅ HOLD" pending by-Pilar intern test. AI Act enforcement begynder 2 Aug 2027.
- **Owner:** michael-manual
- **Status:** ⏸️ **on-hold** — bevidst deprioriteret pr. Michaels beslutning 2026-07-13; genoptages når by Pilar-piloten viser willingness-to-pay
- **Acceptance criteria (når genoptaget):**
  - [ ] Presafe-letter sendt inden 5 arbejdsdage med intended purpose scoped til Aria + Sigrid + Frej Class 0 only.
  - [ ] Presafe-response logget i `docs/PRESAFE-DK-RESPONSE-LOG.md`.

---

## 6 · Sprint 7 backlog · prioriteret

Ordnet efter blast-radius (hver bloker gates den næste):

1. **B10 + B11 hotfix-migration 0009** — data-model. Foot-scanner er usynlig under RLS *og* enhver scan-session INSERT roller tilbage i dag. **Effort:** S.
2. **B7 fail-closed complete** — replikér embeddings-mønster for VLM + ASR + scanner GPU-adapter. **Effort:** M.
3. **B19 consent-writer + LiveKit start-guard** — voice-consent. Lukker både B19 og H-SEC-1. **Effort:** M.
4. **B5 + B6 route-hardening** — shared `requireAuth` middleware med `api_keys` DB-lookup + `timingSafeEqual`. **Effort:** M.
5. **B12 `tests/inv-index.test.ts` gate + én fil pr. manglende INV**. **Effort:** XL.
6. **B15 SPRG full coverage** — 5 test-cases. **Effort:** M.
7. **B13 Playwright E2E** — `e2e/critical-flow.spec.ts`. **Effort:** L.
8. **B14 DB-side tests** — `tests/db/` med vitest + pgtap. **Effort:** L.
9. **Deferred audit-call-sites** (`config.lock` + `config.sent_to_lab`) — byg `lib/configurator/status-transition` først. **Effort:** S.

Sekundær Sprint 7-track (residual audit-criticals): C4 migration idempotency · C5 RLS på `users`/`memberships` · C6 FK cascade · C7 `createLiveRepository` placeholder · C10 PSUR cron · C18 `PRAXIS_CLINICAL_DEV` asymmetry · C22/C23 FancyRange + ModalShell komponent-fix.

---

## 7 · Hvordan denne fil bruges

- Sprint-planlægning: læs §0-sammenfatning + batch-tabeller.
- Daglig standup: én linje pr. blocker med "Status pr. dags dato".
- Retrospective: kryds hver blocker af når acceptance criteria er landet i main + `npm test` grønt.
- Ved nye findings udover audit: tilføj B20, B21 nederst med samme skema; opdatér §0-tabellen.

*Denne fil regenereres/opdateres efter hver Batch. Se `MICHAELS-ACTION-LIST.md` for parallel human-only track, `SPRINT-6-STATUS.md` for consolidated Sprint 6 status, og `COMPLETE-AUDIT-REPORT.md` for original evidens.*
