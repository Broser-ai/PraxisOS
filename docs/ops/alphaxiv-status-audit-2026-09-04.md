# Alphaxiv status + audit — 2026-09-04

**Repo:** Broser-ai/PraxisOS  
**Branch:** `cursor/alphaxiv-status-audit-2c11`  
**`main` tip audited:** `623b0f9` (`docs(ops): align triage tip SHA to main HEAD`)  
**Evidence:** kodegennemgang `lib/alphaxiv/*` · API-routes · swarm-wiring · `npx vitest run tests/alphaxiv.test.ts` · live HTTP ~13:39–13:42 UTC  

**Søskende-doc (findes på branch):** `cursor/status-audit-vscode-alphaxiv-2c11` →  
`docs/ops/status-audit-vscode-alphaxiv-2026-09-04.md` (VS Code/Planway cutover + kort Alphaxiv-handoff,  
agent bc-2ac9c62b…). Søskende §5 er en *handoff-checklist*; **denne fil er Alphaxiv-dybden**  
(`lib/alphaxiv`, API, tests, env, safety). De to docs overlapper kun på live byPilar-fakta.

**Hard locks (uændret):** `NO_AUTO_MERGE` / `NO_AUTO_DEPLOY` · research = citations only ·  
ingen patient-triage fra Alphaxiv · ingen Hetzner-deploy / SSH fra agent-env (SSH-nøgle mangler stadig).

---

## Klar dansk (dom)

**Alphaxiv-connectoren er kodeklar i stub-mode og live-søgning virker offentligt — men er ikke «prod research-ready».**

- **Stub / catalog:** virker (tracks, seed-papers, journal-format, safety-bannere). Tests grønne (6/6).
- **Live search/metadata:** offentlig Alphaxiv API (`api.alphaxiv.org`) svarer 200 — harvest kan blive `live=true` uden API-nøgle.
- **Assistant (SSE):** kræver `ALPHAXIV_API_KEY` — **ikke** dokumenteret i `.env.example` / `.env.production.example`; nøgle ikke verificeret i denne session.
- **Klinisk sikkerhed:** research ≠ patient-triage er **kodet ind** (safety-strenge, MDR-noter, NO_AUTO_MERGE) — men der er **ingen** hard gate der forhindrer en fremtidig agent i at citere papers ind i patient-facing copy.
- **LUNA:** to parallelle stier — S-agent `LUNA_RESEARCH` → Alphaxiv; specialist `agents/specialists/LUNA-harvester.ts` → rå arXiv Atom. De deler ikke klient.

**Verdict:** **Research-ops ready (dev/admin)** · **ikke** clinical/knowledge-base ready · **ikke** «Assistant live» uden nøgle + env-dokumentation.

---

## 1. Hvad findes i repo (inventar)

| Lag | Path | Rolle |
|-----|------|--------|
| Types | `lib/alphaxiv/types.ts` | `ResearchTrackId`, `AlphaxivPaper`, `ResearchFinding` |
| Catalog | `lib/alphaxiv/catalog.ts` | 6 curated tracks + seed arXiv-IDs + abs-URL helper |
| HTTP client | `lib/alphaxiv/client.ts` | search / paper / overview / similar / topics / assistant |
| Bridge | `lib/alphaxiv/bridge.ts` | harvest + deep-ask + journal-line + track actions |
| Anti-fantasy | `lib/alphaxiv/chat-claims.ts` | `CHAT_CLAIMS` + `FANTASY_PATHS` registry |
| Barrel | `lib/alphaxiv/index.ts` | public exports |
| API | `app/api/v1/[tenant]/research/route.ts` | GET tracks/harvest · POST harvest+journal |
| API | `…/research/ask/route.ts` | POST deep-ask (+ optional Assistant) |
| API | `…/research/papers/[arxivId]/route.ts` | GET paper (+ optional overview) |
| Admin UI | `app/(internal)/admin/research/page.tsx` | staff harvest / deep-ask |
| Swarm | `lib/swarm/s-agents.ts` → `lunaResearch` | S-agent `LUNA_RESEARCH` |
| Swarm types | `lib/swarm/types.ts` | rolle: «Alphaxiv harvest (citations only)» |
| Router | `lib/swarm/meta-harness.ts` | `type: research` → `LUNA_RESEARCH` |
| Tests | `tests/alphaxiv.test.ts` | **6 passed** (2026-09-04) |
| Vision | `docs/vision/alphaxiv-*.md`, `docs/alphaxiv-del-pilar-nexus-sota-prompt.md` | ranking / anti-recs |

**Ikke Alphaxiv (men navneforvirring):**  
`agents/specialists/LUNA-harvester.ts` henter **arXiv Atom** (`export.arxiv.org`) til swarm-memory — separat fra `lib/alphaxiv`.

---

## 2. Env-vars (faktisk adfærd)

| Variabel | Effekt | I `.env*.example`? |
|----------|--------|---------------------|
| `ALPHAXIV_ENABLED=0` | Tving stub — ingen outbound | **Nej** |
| `ALPHAXIV_ENABLED=1` | Tving live | **Nej** |
| *(unset, non-test)* | Default **live** (prøv API) | — |
| `NODE_ENV=test` + unset | Stub medmindre `ALPHAXIV_LIVE=1` | — |
| `ALPHAXIV_LIVE=1` | Tillad live under test | **Nej** |
| `ALPHAXIV_API_KEY` | Bearer til Assistant (+ optional auth headers på GET) | **Nej** |

**Gap:** Alphaxiv er usynlig i env-eksempler (i modsætning til Bird/OpenAI/Roboflow).  
Admin-UI nævner nøglen i UI-tekst, men onboarding-docs gør det ikke.

Placeholder-keys (`[SENSITIVE]` / substring `SENSITIVE`) behandles som manglende.

---

## 3. Stub vs live — hvad virker

### 3.1 Stub / catalog (altid)

Med `ALPHAXIV_ENABLED=0` (tests):

1. `runResearchHarvest({ trackId })` → seed-papers fra catalog (`source: "catalog"`).
2. `live: false`; `extractedActions` indeholder track-specifikke MDR/ops-råd.
3. `agent_swarm`-actions kræver `NO_AUTO_MERGE` (test-assert).
4. `runDeepResearchAsk` returnerer safety-banner; Assistant `ok: false` uden nøgle.

### 3.2 Live HTTP (offentlig API — verificeret ~13:41 UTC)

| Endpoint i klient | Probe | Resultat |
|-------------------|-------|----------|
| `GET /search/v2/paper/fast?q=…` | curl | **200** · paper-liste (CIRL, Experiential RL, …) |
| `GET /papers/v3/legacy/2505.24864` | curl | **200** · ProRL metadata + `paper_version.id` |
| Assistant `POST /assistant/v2/chat` | — | **Ikke** testet (kræver nøgle) |

Klient-fallback-ruter:

- Search: `/search/v2/paper/fast` → `/v1/search/paper`
- Paper: `/papers/v3/legacy/{id}` → `/papers/v3/{id}` → `…/preview`
- Similar / overview: kræver versionId fra legacy meta
- Timeout: 12s (GET) / 45s (Assistant); fejl → tom liste / `null` (fail-soft)

### 3.3 Auth på PraxisOS-routes

Alle research-routes bruger `requireTenantAccess` (F41):

| Metode | Path | Roller |
|--------|------|--------|
| GET | `/api/v1/{tenant}/research` | tenant access |
| POST | samme (harvest+journal) | `owner` \| `support` |
| POST | `/research/ask` | `owner` \| `support` |
| GET | `/research/papers/{arxivId}` | tenant access |

Audit (uden query/prompt-tekst): `research.harvest` · `research.ask` · `research.paper_viewed`.

POST harvest journaler til `LUNA_RESEARCH` med `note: NO_AUTO_MERGE — papers are citations…`.

---

## 4. Research tracks (catalog)

| ID | Formål | MDR-note (catalog) |
|----|--------|---------------------|
| `rl_elearning` | Verifiable-reward quiz / tutoring | class_0 education only |
| `agent_swarm` | Multi-agent / long-horizon | ops agents; clinical H gated |
| `foot_scanner` | 3D mesh / biomechanics priors | Class IIa når diagnose — frozen uden CE |
| `nail_materials` | Photoreal nail/skin (Atelier) | **ikke** klinisk device |
| `vlm_detection` | VLM/segment kandidater | `ai_generated=true`; aldrig auto-diagnose |
| `mdr_safety` | Shadow kappa / drift | Presafe human-owned; **ingen** seed-IDs |

Track-inferens i `lunaResearch`: regex på brief/title (nail/scan/vlm/mdr/swarm/learn) → ellers `rl_elearning`.

---

## 5. Swarm S-agent wiring

```
meta-harness (type=research | "paper")
  → runSAgent("LUNA_RESEARCH")
    → runResearchHarvest(...)
      → searchAlphaxivPapersRich / search / seeds / similar
    → writeJournal (thought + result)
    → summary + artifact-URLs (alphaxiv.org/abs/…)
```

- `needsHuman: false` for LUNA research (citations only — ikke merge).
- ATLAS plan-tekst gentager: «Alphaxiv findings are citations, not auto-implemented code».
- FELIX foreslår: «Expand Alphaxiv harvest tracks when ALPHAXIV_API_KEY is set».
- Daemon overnight: `lib/swarm/daemon.ts` enqueued research-task «LUNA · overnight research sweep».

**Ikke wired:** automatisk PR/kodegenerering fra papers; Assistant-output → ATLAS; Alphaxiv → patient journal.

---

## 6. Klinisk sikkerhed — research ≠ patient-triage

### Hvad der er på plads

- Eksplicit safety-streng i deep-ask: `NO_AUTO_MERGE · research citations only · Class IIa…`
- Per-track `mdrNote` + actions (ingen auto-diagnose; human gates; Atelier ≠ MDR).
- API note + admin copy: aldrig auto-merge.
- Audit undgår at logge fulde spørgsmål (PII/prompt-dump).
- Arkitekt-briefing: «alphaxiv harvest … **ikke** patient-triage knowledge base».

### Gaps / risici

1. **Ingen runtime-forbud** mod at en clinic-agent citerer Alphaxiv-finding i patient-facing tekst.
2. `CHAT_CLAIMS` / `FANTASY_PATHS` er **delvist forældede**: flere «fantasy»-stier findes nu som stubs (`agents/specialists/DR-NINA.ts`, `LUNA-harvester.ts`, `lib/scanner/alpha-pipeline.ts`, `lib/physics/mono-msk-tensor.ts`). Registry er anti-fantasy-filter — ikke fil-eksistens-facit.
3. Live papers kan være **uden for fodpleje-domæne** (generel RL) — curation er track-queries + seeds, ikke medicinsk whitelist.
4. Assistant-tekst (hvis nøgle) er **ikke** CE-reviewet content.

**Regel til Broser:** Alphaxiv/LUNA output må kun lande i swarm journal / admin research / vision-spikes — aldrig direkte i patient-chat, journal SOAP, eller booking-copy uden menneskelig redaktion.

---

## 7. Gaps (prioriteret)

| Prio | Gap | Noter |
|------|-----|--------|
| P0 ops | Dokumentér `ALPHAXIV_*` i `.env.example` (+ production) | I dag kun kode + admin UI-tekst |
| P0 ops | Beslut: prod `ALPHAXIV_ENABLED` default | Nu: live outbound hvis unset |
| P1 | Verificér `ALPHAXIV_API_KEY` i deploy-secret store | Assistant ellers permanent soft-fail |
| P1 | Opdatér `FANTASY_PATHS` / claims vs eksisterende stubs | Undgå falske «findes ikke»-påstande |
| P2 | Ensret LUNA-harvester (arXiv) vs Alphaxiv klient | To harvest-stier = dobbelt vedligehold |
| P2 | Rate-limit / cache på research GET | Fail-soft men kan hammer'e Alphaxiv |
| P3 | Live integrationstest bag `ALPHAXIV_LIVE=1` | Kun stub dækket i CI i dag |
| P3 | Product-RAG / curated fodpleje-KB | Alphaxiv er **ikke** den KB (se arkitekt-briefing P1) |

---

## 8. Live snapshot — byPilar / Planway / PraxisOS (kontekst)

Verificeret ~13:39–13:42 UTC 2026-09-04 (agent + parent):

| Check | Resultat |
|-------|----------|
| `GET https://app.bypilar.dk/api/health` | `ok:false` · `error: db_config_invalid` · `PRAXIS_DB=mock forbidden in production` |
| Tolkning | **Fail-fast er live** (ny kode deployed) — cutover til Postgres/Supabase **ikke** færdig |
| `GET /t/bypilar/book` | **200** · CSP `frame-ancestors` inkl. `https://bypilar.dk` |
| `bypilar.dk` «planway»-count ~2 | **Falsk positiv** — kun theme version `1.3.0-planway-total-kill` (CSS/JS `?ver=`) |
| `http://app.bypilar.dk` iframes | **0** |
| `/book` + `/booking` | **1 iframe** → `https://app.bypilar.dk/t/bypilar/book?embed=1` |
| Agent SSH | **Mangler stadig** — ingen Hetzner-fix fra denne env |

**Planway cutover (ærlig):**  
WP-temaet er versioneret som «planway-total-kill» og booker via PraxisOS-iframe.  
Repo har flere draft-PR’er (#40–#44) om Planway-kill / content rewrite — live site ser allerede PraxisOS-embed på `/book`.  
**DB-cutover** er den blokerende prod-smerte (`db_config_invalid`), ikke Alphaxiv.

---

## 9. Cross-link: VS Code-arbejde + søskende-audit

| Emne | Status (ærlig) | Hvor |
|------|----------------|------|
| VS Code / Planway cutover audit | **Draft PR #45** | https://github.com/Broser-ai/PraxisOS/pull/45 · branch `cursor/status-audit-vscode-alphaxiv-2c11` · `docs/ops/status-audit-vscode-alphaxiv-2026-09-04.md` |
| VS Code «har de løst alt?» | **Nej** — WP/booking funktionelt PraxisOS; health 503 mock; kill-PRs #37–#44 drafts; SSH mangler | søskende §1 |
| Foundation / PEC | Kontrolplan på `main`; mock persistence | `docs/ops/foundation-status-audit-2026-09-04.md` |
| P0 cutover runbook | `PRAXIS_DB=mock` forbudt i prod (nu synligt live) | `docs/ops/p0-db-cutover-runbook.md` |
| Alphaxiv vision spikes | CaptureGate / TriView / MetricAnchor — shadow only | `docs/vision/alphaxiv-top3-spikes.md` |
| Anti-fantasy transcript | Aurelle chat impact | `docs/vision/alphaxiv-aurelle-transcript-impact.md` |

**Relation:** Søskende dækker VS Code→Planway; denne PR dækker Alphaxiv connector readiness.  
Merge gerne begge som docs-only; undgå at kopiere track-tabeller ind i den kombinerede doc — link hertil.

---

## 10. Tests

```bash
npx vitest run tests/alphaxiv.test.ts
```

**Resultat (2026-09-04, denne session):**  
`Test Files  1 passed (1)` · `Tests  6 passed (6)` · ~213ms  

Dækker: catalog tracks · abs URL · stub harvest · NO_AUTO_MERGE i swarm-actions · fantasy claim registry · deep-ask safety uden nøgle.  
**Dækker ikke:** live HTTP, Assistant SSE, API-route auth, admin UI.

---

# English brief — Alphaxiv readiness

**Verdict: research-ops ready (stub + public search); not Assistant-complete; not clinical KB.**

### What works
- Curated 6-track catalog with MDR notes and seed arXiv IDs.
- Fail-soft HTTP client against `https://api.alphaxiv.org` (search/paper/overview/similar/topics).
- Public search + legacy paper metadata verified live (HTTP 200) without an API key.
- Tenant-auth’d research API + admin UI + LUNA_RESEARCH swarm harvest → journal citations only.
- Stub mode + vitest (6/6) enforce `NO_AUTO_MERGE` messaging and catalog fallback.

### What does not / gaps
- `ALPHAXIV_API_KEY` / `ALPHAXIV_ENABLED` missing from env examples; Assistant untested here.
- Default non-test behavior is “try live” — production policy should be explicit.
- Parallel arXiv Atom harvester (`agents/specialists/LUNA-harvester.ts`) is not the Alphaxiv client.
- `FANTASY_PATHS` partially stale vs existing stubs.
- Must never feed patient triage / SOAP / booking copy without human edit.

### Relation to byPilar live
- Health fail-fast (`db_config_invalid` / mock forbidden) proves new prod code; DB cutover still open.
- WP booking iframe already points at HTTPS PraxisOS; “planway” string matches are theme version tags only.
- SSH still absent in agent env — no remote cutover from this run.

---

## 11. Anbefalet næste skridt (kun Alphaxiv)

1. Tilføj `ALPHAXIV_ENABLED` / `ALPHAXIV_API_KEY` / `ALPHAXIV_LIVE` til `.env.example` (+ production note).  
2. Sæt prod-policy: `ALPHAXIV_ENABLED=1` kun hvis outbound ønskes; ellers `0` indtil nøgle/secret er sat.  
3. Én smoke: staff `/admin/research` → harvest `live=true` + DeepAsk uden/med nøgle.  
4. Opdatér `chat-claims.ts` så stubs vs fantasy ikke modsiger fil-træet.  
5. Hold Alphaxiv ude af patient-facing paths indtil curated fodpleje-KB findes.

---

*Audit forfatter: cloud agent «Alphaxiv research status audit» · bc-cdd68728… · 2026-09-04*
