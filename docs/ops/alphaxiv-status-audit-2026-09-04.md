# Alphaxiv status + audit — 2026-09-04 (regen)

**Repo:** Broser-ai/PraxisOS  
**Branch:** `cursor/status-audit-regen-a8bf`  
**`main` tip audited:** `623b0f9` (`docs(ops): align triage tip SHA to main HEAD`)  
**Evidence window:** 2026-09-04T13:51:08Z → 13:52:35Z  
**Agent:** `bc-a567e1be-e4bf-5ee4-b878-e86aeeb4a8bf`  
**Evidence:** kodegennemgang `lib/alphaxiv/*` · API-routes · swarm-wiring · live HTTP (Alphaxiv + byPilar)  

**Index:** [`docs/ops/STATUS-AUDIT-LATEST.md`](./STATUS-AUDIT-LATEST.md)  
**Søskende-doc (VS Code / Planway / PRs):** [`docs/ops/status-audit-vscode-alphaxiv-2026-09-04.md`](./status-audit-vscode-alphaxiv-2026-09-04.md)  

Søskende dækker VS Code→Planway cutover + open PRs; **denne fil er Alphaxiv-dybden**  
(`lib/alphaxiv`, API, tests, env, safety). De to docs overlapper kun på live byPilar-fakta.

**Hard locks (uændret):** `NO_AUTO_MERGE` / `NO_AUTO_DEPLOY` · research = citations only ·  
ingen patient-triage fra Alphaxiv · ingen Hetzner-deploy / SSH fra agent-env (SSH-nøgle mangler stadig).

**Supersedes:** ældre draft på PR [#46](https://github.com/Broser-ai/PraxisOS/pull/46) (`cursor/alphaxiv-status-audit-2c11`).

---

## Klar dansk (dom)

**Alphaxiv-connectoren er research-ops klar (stub + offentlig search/metadata) — Assistant mangler nøgle; den er ikke clinical KB.**

- **Stub / catalog:** virker (tracks, seed-papers, journal-format, safety-bannere). Kode + tests på `main`.
- **Live search/metadata:** offentlig Alphaxiv API (`api.alphaxiv.org`) svarer **200** med `includePrivate=false` — harvest kan blive `live=true` uden API-nøgle.
- **Assistant (SSE):** kræver `ALPHAXIV_API_KEY` — **ikke** i `.env.example` / `.env.production.example`; nøgle **MISSING** i denne session.
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
| Tests | `tests/alphaxiv.test.ts` | stub/catalog/safety (CI; denne regen kørte ikke vitest — `node_modules` manglede) |
| Vision | `docs/vision/alphaxiv-*.md`, `docs/alphaxiv-del-pilar-nexus-sota-prompt.md` | ranking / anti-recs |

**Ikke Alphaxiv (men navneforvirring):**  
`agents/specialists/LUNA-harvester.ts` henter **arXiv Atom** (`export.arxiv.org`) til swarm-memory — separat fra `lib/alphaxiv`.

---

## 2. Env-vars (faktisk adfærd)

Fra `lib/alphaxiv/client.ts`:

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

**Denne session:** `ALPHAXIV_API_KEY` = **MISSING**.

---

## 3. Stub vs live — hvad virker

### 3.1 Stub / catalog (altid)

Med `ALPHAXIV_ENABLED=0` (tests):

1. `runResearchHarvest({ trackId })` → seed-papers fra catalog (`source: "catalog"`).
2. `live: false`; `extractedActions` indeholder track-specifikke MDR/ops-råd.
3. `agent_swarm`-actions kræver `NO_AUTO_MERGE` (test-assert).
4. `runDeepResearchAsk` returnerer safety-banner; Assistant `ok: false` uden nøgle.

### 3.2 Live HTTP (offentlig API — verificeret 2026-09-04T13:51:53Z–13:52:06Z)

| Endpoint | Probe | Resultat |
|----------|-------|----------|
| `GET /search/v2/paper/fast?q=…` **uden** `includePrivate` | curl 13:51:53Z | **400** schema: `includePrivate` expected `"true"|"false"` |
| `GET /search/v2/paper/fast?q=reinforcement%20learning&includePrivate=false` | curl 13:52:06Z | **200** · paper-liste (CIRL, Experiential RL, HACRL, …) |
| `GET /papers/v3/legacy/2505.24864` | curl 13:51:53Z | **200** · ProRL metadata + `paper_version.id` |
| Assistant `POST /assistant/v2/chat` | — | **Ikke** testet (kræver nøgle; nøgle MISSING) |

Klient (`lib/alphaxiv/client.ts`) sender allerede `includePrivate=false` på fast-search — korrekt ift. live schema.

Klient-fallback-ruter:

- Search: `/search/v2/paper/fast?q=…&includePrivate=false` → `/v1/search/paper?q=…`
- Paper: `/papers/v3/legacy/{id}` → `/papers/v3/{id}` → `…/preview`
- Similar / overview: kræver versionId fra legacy meta
- Timeout: 12s (GET) / 45s (Assistant); fejl → tom liste / `null` (fail-soft)

**Raw search evidence (truncated, 13:52:06Z):**

```json
[
  {"paperId":"1606.03137","title":"[1606.03137] Cooperative Inverse Reinforcement Learning - arXiv",...},
  {"paperId":"2602.13949","title":"Experiential Reinforcement Learning",...},
  {"paperId":"2603.02604","title":"Heterogeneous Agent Collaborative Reinforcement Learning",...}
]
```

**Raw paper evidence (truncated, 13:51:53Z):**

```json
{"paper":{"paper_version":{"id":"01972258-e688-7432-9766-045c86f2bc9f","version_label":"v1",
  "title":"ProRL: Prolonged Reinforcement Learning Expands Reasoning Boundaries in  Large Language Models",
  "universal_paper_id":"2505.24864"},...}}
```

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
| P1 | Verificér / injicér `ALPHAXIV_API_KEY` i deploy-secret store | Assistant ellers permanent soft-fail; **MISSING** her |
| P1 | Opdatér `FANTASY_PATHS` / claims vs eksisterende stubs | Undgå falske «findes ikke»-påstande |
| P2 | Ensret LUNA-harvester (arXiv) vs Alphaxiv klient | To harvest-stier = dobbelt vedligehold |
| P2 | Rate-limit / cache på research GET | Fail-soft men kan hammer'e Alphaxiv |
| P3 | Live integrationstest bag `ALPHAXIV_LIVE=1` | Kun stub dækket i CI i dag |
| P3 | Product-RAG / curated fodpleje-KB | Alphaxiv er **ikke** den KB |

---

## 8. Live snapshot — byPilar / Planway / PraxisOS (kontekst)

Verificeret 2026-09-04T13:51:08Z → 13:52:35Z:

| Check | Resultat |
|-------|----------|
| `GET https://app.bypilar.dk/api/health` | **503** · `ok:false` · `db_config_invalid` · `PRAXIS_DB=mock forbidden` · `backend=memory` |
| Tolkning | Fail-fast **live** — **Prod DB NOT solved** |
| `GET /api/scan/config` | **200** · `liveReady:true` · providers replicate/roboflow/openai |
| `HEAD /t/bypilar/book` | **200** · CSP `frame-ancestors` inkl. `https://bypilar.dk` |
| `bypilar.dk` `planway.com` | **0** på `/`, `/booking/`, `/behandlinger/`, `/udekoerende/` |
| `planway` substring | ~2/side — kun `ver=1.3.0-planway-total-kill` |
| `http://app.bypilar` | **0** |
| `/booking/` iframe | `https://app.bypilar.dk/t/bypilar/book?embed=1` |
| Theme | `pilar-theme` **`1.3.0-planway-total-kill`** |
| Booking JSON | `/api/v1/bypilar/services` + `availability` → **200 JSON** (memory); naive `/api/booking*` → **HTML 404** |
| Agent SSH | **MISSING** |

**Planway customer booking:** **SOLVED** (0 planway.com, HTTPS PraxisOS, kill theme).  
**DB-cutover:** blokerende prod-smerte — ikke Alphaxiv.

---

## 9. Cross-link: VS Code-arbejde + søskende-audit

| Emne | Status (ærlig) | Hvor |
|------|----------------|------|
| VS Code / Planway cutover audit (regen) | denne branch | `docs/ops/status-audit-vscode-alphaxiv-2026-09-04.md` |
| Latest pointer | denne branch | `docs/ops/STATUS-AUDIT-LATEST.md` |
| Ældre draft PRs | **superseded** | [#45](https://github.com/Broser-ai/PraxisOS/pull/45) · [#46](https://github.com/Broser-ai/PraxisOS/pull/46) |
| VS Code «har de løst alt?» | **Nej** — WP booking SOLVED; health/DB NOT; drafts; SSH mangler | søskende §1 |
| Foundation / PEC | Kontrolplan på `main`; mock persistence | `docs/ops/foundation-status-audit-2026-09-04.md` |
| P0 cutover runbook | `PRAXIS_DB=mock` forbudt i prod (nu synligt live) | `docs/ops/p0-db-cutover-runbook.md` |
| Alphaxiv vision spikes | CaptureGate / TriView / MetricAnchor — shadow only | `docs/vision/alphaxiv-top3-spikes.md` |

---

## 10. Tests

```bash
npx vitest run tests/alphaxiv.test.ts
```

**Denne regen-session:** `node_modules` / vitest **ikke** installeret i cloud-env — tests **ikke genkørt**.  
Tidligere audit (samme dag, på `main` tip-familie): 6/6 passed (~213ms).  
Dækker: catalog tracks · abs URL · stub harvest · NO_AUTO_MERGE i swarm-actions · fantasy claim registry · deep-ask safety uden nøgle.  
**Dækker ikke:** live HTTP, Assistant SSE, API-route auth, admin UI.

---

# English brief — Alphaxiv readiness

**Verdict: research-ops ready (stub + public search/metadata); Assistant needs key; not clinical KB.**

### What works
- Curated 6-track catalog with MDR notes and seed arXiv IDs.
- Fail-soft HTTP client against `https://api.alphaxiv.org` (search/paper/overview/similar/topics).
- Public search (**200** with `includePrivate=false`) + legacy paper metadata (**200**) verified live 2026-09-04T13:51–13:52Z without an API key.
- Tenant-auth’d research API + admin UI + LUNA_RESEARCH swarm harvest → journal citations only.
- Stub mode + vitest suite enforce `NO_AUTO_MERGE` messaging and catalog fallback (prior run same day).

### What does not / gaps
- `ALPHAXIV_API_KEY` / `ALPHAXIV_ENABLED` missing from env examples; key **MISSING** this session; Assistant untested.
- Default non-test behavior is “try live” — production policy should be explicit.
- Parallel arXiv Atom harvester (`agents/specialists/LUNA-harvester.ts`) is not the Alphaxiv client.
- `FANTASY_PATHS` partially stale vs existing stubs.
- Must never feed patient triage / SOAP / booking copy without human edit.

### Relation to byPilar live
- Planway **customer booking SOLVED** (theme `1.3.0-planway-total-kill`, 0 `planway.com`, HTTPS PraxisOS iframe).
- Health fail-fast (**503** `db_config_invalid` / mock forbidden) — **prod DB NOT solved**.
- SSH still absent in agent env — no remote cutover from this run.

---

## 11. Anbefalet næste skridt (kun Alphaxiv)

1. Tilføj `ALPHAXIV_ENABLED` / `ALPHAXIV_API_KEY` / `ALPHAXIV_LIVE` til `.env.example` (+ production note).  
2. Sæt prod-policy: `ALPHAXIV_ENABLED=1` kun hvis outbound ønskes; ellers `0` indtil nøgle/secret er sat.  
3. Injicér `ALPHAXIV_API_KEY` → smoke staff `/admin/research` → harvest `live=true` + DeepAsk med nøgle.  
4. Opdatér `chat-claims.ts` så stubs vs fantasy ikke modsiger fil-træet.  
5. Hold Alphaxiv ude af patient-facing paths indtil curated fodpleje-KB findes.

---

*Audit regen: cloud agent «Regenerate full status audit» · bc-a567e1be… · evidence 2026-09-04T13:51–13:52Z*
