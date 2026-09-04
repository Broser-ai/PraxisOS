# Foundation-status audit — 2026-09-04

**Repo:** Broser-ai/PraxisOS  
**Evidence base:** `git log` / `git show` / file existence / vitest  
**`main` tip audited:** `3e677cea569d8ad56b7a52d3de2cc98449eed0a9`  
**PR #34 tip compared:** `3d6eb30e2ab604abee485cb82df24e66b5756193` (`cursor/continue-dev-slices-2c11`)  
**PR #33 tip compared:** `6217c52cc864a5d5f5d0c0f534889b9cee0d2c5b` (`cursor/p0-execution-slices-2c11`)  

**Hard locks (unchanged by this audit):** `NO_AUTO_MERGE` / `NO_AUTO_DEPLOY` · `suggestion_only` · `NO_MODEL_TRAINING` · ingen patient-AI · ingen Hetzner-deploy fra vores arbejde.

---

## Klar dansk (før detaljerne)

**Foundation på `main` ≠ fuld multi-agent live.**  
Det der er landet, er kontrolplanet (Mission/Workstream/Budget/DoD/dispatcher) + første yellow journal-auth slice. Det er *ikke* “hele P0” og *ikke* automatisk parallel produktion af kliniske agents.

**`dbMode=mock` betyder hukommelse.**  
Live health (dokumenteret i arkitekt-briefing) rapporterer `dbMode: "mock"` / `backend: "memory"`. Mission-store kører memory + valgfri `PRAXIS_DATA_DIR/mission-store.json`. SQL-migrationer `0005`/`0006` ligger i repo — **ikke** wired som runtime store, **ikke** applied på Hetzner af os.

**P0 / patient-AI / Hetzner er pauset** (Broser OOO-acceptance `docs/ops/broser-acceptance-ooo-2026-09-03.md`). Drafts #33/#34 indeholder yderligere P0-slices; de er **ikke** merged til `main`.

---

## 1. Commit hashes + beskeder + filer der udgør “foundation” på `main`

Foundation-batchen er Broser OOO-acceptance: **#29 → #30 → #32** (PEC #31 subsumeret af #32) + acceptance-note.

### Merge-commits på `main`

| Hash | Message | PR |
|------|---------|-----|
| `29b9089748a8f0c096a544f4fc02809b2669a864` | merge: AI fodpleje arkitekt-briefing (PR #29) | #29 |
| `e224c6970557185618e1deaae0d4019134bd4d97` | merge: P0 Secure Clinical Core plan (PR #30) | #30 |
| `785b9da6eac8255edff89642a1fd5181a34b6e97` | merge: Prime Execution Control + secure journal auth (PR #32) | #32 (inkl. #31) |
| `3e677cea569d8ad56b7a52d3de2cc98449eed0a9` | merge: Broser OOO acceptance note 2026-09-03 | acceptance |

### PEC + journal commits inde i #32 (på `main`)

| Hash | Message | Primære filer |
|------|---------|---------------|
| `9a0c159a22aba5d987b053bf99a05b7129ded619` | docs(ops): Prime Execution Control plan | `docs/ops/prime-execution-control-plan.md` |
| `93990b8ae4d67373bca510bb57bc95f84058fd19` | feat(prime): Mission/Workstream domain store (B) | `lib/prime/mission-types.ts`, `mission-store.ts`, `mock-repo.ts`, `index.ts` |
| `e5849f4d7f28f61e4f03aee4e1adcb06fa5894f0` | feat(prime): BudgetGuard + LLM hook (C) | `lib/prime/budget-guard.ts`, `lib/agents/llm.ts`, `runtime.ts`, `agent-store.ts` |
| `88b6766f44a829e1f937db2f644094b648b01d34` | feat(prime): MissionPolicyGuard + DoD + evidence (D/E) | `mission-policy.ts`, `definition-of-done.ts`, `evidence.ts` |
| `1936cc8c493dfea3e6d2ee4ce1e6d4f7e0e1974d` | feat(prime): roles + mission orchestrator (F) | `roles.ts`, `orchestrator.ts`, `seed.ts` |
| `621b13280c972a25a46d72726fffe9eba2a19aa7` | feat(prime): missions API + admin swarm panel (G) | `app/api/v1/[tenant]/prime/missions/route.ts`, `app/(internal)/admin/swarm/page.tsx` |
| `d7433d3a1a91507547052cd3263a76e674f6efb8` | test(prime): Execution Control vitest suite (H) | `tests/prime/execution-control.test.ts` |
| `ba56879fe3cc80b946bfa8a887dfd33aaef423fc` | docs(ops): concurrency audit | `docs/ops/prime-execution-concurrency-audit.md` |
| `3a84345a8a8a926b745ae7b6faabc9ad05fabc9d` | feat(prime): dispatcher lease + tick wiring | `lib/prime/dispatcher.ts`, `lib/agents/workflows.ts`, migrations `0005`/`0006`, fixtures |
| `eea00b045d0c251e7946e653dcc082f23b5249d8` | test+docs(prime): dispatcher cases, ops docs | runbook + ekstra tests |
| `12e7de2690f630736fb69ea67eec9a656448fc14` | feat(auth): secure journal routes + GET /api/auth/me | journal routes, `lib/request-auth.ts`, `app/api/auth/me` |
| `460ac9f217dbc31f1a18f0db0eb21156b20227c3` | chore(prime): yellow journal-auth mission runner | `scripts/run-yellow-journal-auth-mission.ts` |

### Docs-only foundation (#29/#30 + note)

| Hash | Files |
|------|-------|
| `797bb58` / `f2f839d` → merge `29b9089` | `docs/ops/ai-fodpleje-arkitekt-briefing.md` |
| `cff500b` / `aab99cb` → merge `e224c69` | `docs/ops/p0-secure-clinical-core-plan.md` |
| `6cc3ec0` → merge `3e677ce` | `docs/ops/broser-acceptance-ooo-2026-09-03.md` |

`git show --stat 785b9da`: **38 files, +6295 / −65** (PEC + journal auth + tests + migrations + fixtures + ops docs).

---

## 2. Status pr. komponent — `main` tip vs kun PR #33/#34

Legende: **implemented** = kode + tests/wiring findes på tippen · **partial** = findes men begrænset/ikke wired til live persistence · **not implemented** = mangler.

| Komponent | På CURRENT `main` tip | Kun på PR #33 / #34 |
|-----------|----------------------|---------------------|
| **Mission, Workstream, AgentRun** | **implemented** — `lib/prime/mission-types.ts`, `mission-store.ts`; `AgentRun.missionId`/`workstreamId`/`tokenUsage` i `lib/agent-store.ts` | #34: flere P0 mission-*fixtures* + `tests/prime/p0-slice-missions.test.ts` (P0-slices, ikke ny PEC-domain) |
| **repository/persistence, mock storage** | **partial** — memory + optional `PRAXIS_DATA_DIR/mission-store.json`; `lib/prime/mock-repo.ts` til tests | #33/#34: cutover-scripts (`migrate-memory-to-pg.ts`, docker-compose.db) — **ikke** merged; mission runtime stadig mock på main |
| **Postgres/Supabase migration** | **partial** — filer `supabase/migrations/0005_mission_snapshots.sql`, `0006_prime_missions_relational.sql` i repo; **ikke** brugt af `mission-store.ts` (ingen supabase client i prime-lib) | #33/#34: `0007_consent_events.sql`, `0008_audit_log_align.sql` + apply-scripts — **ikke** applied på Hetzner af os |
| **BudgetGuard + token accounting (wired LLM?)** | **implemented** — `lib/prime/budget-guard.ts`; `lib/agents/llm.ts` kalder `reserveBudget`/`recordBudget` når `opts.budget.missionId` sat; dispatcher/runtime sender mission-budget | Uændret domain på #34 (kun auth/audit omkring missions-route) |
| **MissionPolicyGuard** | **implemented** — `lib/prime/mission-policy.ts` + tests 7–8, 15 | — |
| **DefinitionOfDoneValidator** | **implemented** — `lib/prime/definition-of-done.ts` + tests 9, 11 | — |
| **dispatcher / parallel agent execution** | **implemented (controlled)** — `lib/prime/dispatcher.ts`: lease + `runPool` med `maxParallel` default **4**; `tickInFlight` mutex. Clinic workflows i samme tick forbliver **sekventielle** `await`-loops | — |
| **worker integration (`agent-worker` / `/api/agents/tick`)** | **implemented** — `scripts/agent-worker.mjs` → `POST /api/agents/tick` → `tickAutomation` → `tickMissions({ maxParallel: 4 })` i `lib/agents/workflows.ts` | #34: `lib/agent-worker-auth.ts` + F12 fail-closed i production (strengere auth) |
| **API-routes** | **implemented** under `/api/v1/[tenant]/prime/missions` (GET views + POST actions). **Mangler** parallel `/api/agents/missions*` tree (dokumenteret bevidst valg i `prime-execution-control.md`) | #33/#34: mange P0 API-guards; missions-route får `requireTenantAccess` + audit-context på #34 — **ikke** `/api/agents/missions*` |
| **admin UI** | **implemented** — Execution Control-panel på `/admin/swarm` (seed/approve/start/pause/cancel/tick/budget) | — |
| **tests** | **implemented** — `tests/prime/execution-control.test.ts` **23** cases; `tests/journal-route-auth.test.ts` **23** cases (begge grønne på main) | #33: F4–F10 tests; #34: udvider til F11–F84 + `p0-slice-missions.test.ts` (~30 its) |
| **runbook (`docs/ops/prime-execution-control*.md`)** | **implemented** — `prime-execution-control.md`, `-plan.md`, `-runbook.md`, `-concurrency-audit.md` | — |

---

## 3. Hvilke endpoints / worker-paths / UI bruger den nye kode i dag?

### På `main` (live kodepath)

| Flade | Bruger foundation-kode? | Evidens |
|-------|-------------------------|---------|
| `POST/GET /api/agents/tick` | Ja → `tickAutomation` → `tickMissions` | `app/api/agents/tick/route.ts`, `lib/agents/workflows.ts` L364–365 |
| `scripts/agent-worker.mjs` | Ja → kalder tick hvert `AGENT_TICK_MS` | worker fil |
| `/api/v1/[tenant]/prime/missions` | Ja — fuld mission API | route + admin fetch |
| `/admin/swarm` | Ja — PEC-panel | `app/(internal)/admin/swarm/page.tsx` |
| Journal routes + `GET /api/auth/me` | Ja — yellow slice auth | `12e7de2` |
| Clinic agent workflows (`runWorkflow` loop) | Delvist — stadig sekventiel; mission-dispatcher kører *efter* workflows i samme tick | `workflows.ts` |
| Postgres `prime_missions` tabeller | **Nej** som runtime | migrationer findes; store er memory/JSON |

### Kun på branch (#33/#34) — ikke på `main`

- P0 F4–F84 guards, consent, audit-align, health fail-fast, CI workflow, cutover-runbook, docker-compose.db, migrate script, MCP/rate-limit hardenings, m.m.
- Ekstra fixtures `fixtures/missions/p0-f*.json`
- `tests/prime/p0-slice-missions.test.ts`

---

## 4. Tests — rigtige kommandoer + resultater

### På `main` tip (`3e677ce`) via worktree `/tmp/praxis-main`

```bash
cd /tmp/praxis-main
npx vitest run tests/prime/execution-control.test.ts tests/journal-route-auth.test.ts
```

**Resultat (2026-09-04):**  
`Test Files  2 passed (2)` · `Tests  46 passed (46)` · Duration ~884ms

### På `cursor/continue-dev-slices-2c11` (`3d6eb30`)

```bash
cd /workspace   # checked out continue-dev tip under audit session
npx vitest run tests/prime/execution-control.test.ts tests/journal-route-auth.test.ts
```

**Resultat (2026-09-04):**  
`Test Files  2 passed (2)` · `Tests  46 passed (46)` · Duration ~915ms

*(P0-suite på #34 er separat og større; ikke del af foundation-acceptance på main.)*

---

## 5. Kan live agent-worker starte flere parallelle agent-runs?

**Mission workstreams: ja, kontrolleret parallel (default max 4).**  
**Clinic workflows i samme tick: nej — stadig sekventielle.**

Evidens:

1. `tickAutomation` looper `for (const wf of WORKFLOWS) { await runWorkflow(...) }` — **sekventielt**.
2. Derefter `tickMissions({ tenantSlug, maxParallel: 4 })`.
3. `tickMissions` leaser op til `maxParallel` workstreams og kører dem via `runPool` → `Promise.all` over worker-slots (ikke unbounded).
4. `tickInFlight` mutex: to samtidige dispatcher-ticks i samme process → anden skippes (`dispatcher_tick_in_flight`).
5. Lease: anden claim på samme workstream mens lease holdes → blocked.
6. `agent-worker.mjs` laver **ét** HTTP-tick ad gangen per interval — paralleliteten sker *inde* i appens `tickMissions`, ikke som flere worker-processer.

Konklusion: live worker kan køre **op til 4 parallelle mission-workstream AgentRuns pr. tick**, men clinic automation forbliver sequential. Det er *ikke* “ubegrænset multi-agent live”.

---

## 6. Bekræftelse — ingen deploy / prod / Hetzner / clinical policy-ændring

| Påstand | Status | Evidens |
|---------|--------|---------|
| Ingen deploy fra dette audit-arbejde | **Bekræftet** | Kun docs (+ senere alias-PR); `NO_AUTO_DEPLOY` invariant låst i tests |
| Ingen production env-ændring | **Bekræftet** | Ingen `.env` / server-config commits i foundation-merge ud over `.env.example`-mønstre på branches; audit rører ikke prod |
| Ingen DB-migrationer applied på Hetzner | **Bekræftet (fra vores arbejde)** | Migration-filer i git; runtime store = memory/JSON; Broser note forbyder Hetzner cutover uden Broser; ingen SSH/apply udført her |
| Ingen clinical policy-ændring | **Bekræftet** | `CLINICAL_POLICY.suggestion_only` + `NO_AUTO_JOURNAL_SIGN` asserted i test 12; journal-slice er auth, ikke clinical routing |

---

## 7. Næste sikre handlinger

### A. Kan gøres in-repo nu (uden Broser / uden server)

- Holde drafts #33/#34 opdaterede; merge kun efter eksplicit Broser-godkendelse.
- Tilføje tynde `/api/agents/missions*` **aliases** der delegerer til eksisterende prime-missions (ren API-overflade; ingen invariant-svækkelse).
- Flere vitest-cases / docs-præcisering; yellow fixture allerede på main.
- Lokal mock-kørsel af yellow journal-auth mission runner (draft→approve→tick i worktree).

### B. Kræver eksplicit Broser-godkendelse

- Merge af #33 / #34 (eller udvalgte P0-slices) til `main`.
- Aktivering af Postgres runtime for missions (cutover fra mock).
- Red-tier missions, patient-AI, clinical_status-ændringer, LoRA/træning.
- Ændring af production secrets / env flip væk fra mock.

### C. Kræver Hetzner/server-adgang

- Anvende migrationer `0005`/`0006` (+ evt. `0007`/`0008`) på self-host Postgres.
- Starte/omkonfigurere live `agent-worker` mod non-mock DB.
- Production deploy / Traefik / compose cutover.
- Verificere live `GET /api/health` efter cutover (`dbMode != mock`).

---

## Yellow fixture status

`fixtures/missions/secure-journal-route-authorization.json` + `.yaml` **findes på `main`**.  
`lib/prime/fixtures.ts` id `secure-journal-route-authorization`.  
Admin “Seed yellow journal-auth (draft only)” + `scripts/run-yellow-journal-auth-mission.ts` på main.  
Test 20–21 dækker seed-as-draft + spawn flow.

---

## JOB B note (PEC komplet vs BUILD)

PEC DEL B–H fra `docs/ops/prime-execution-control-plan.md` er **landet på main via #32**.  
Eneste dokumenterede API-gap vs nogle BUILD-prompts der nævner `/api/agents/missions*`: den overflade findes **ikke** endnu (bevidst; missions lever under `/api/v1/.../prime/missions`). Gap-fill = tynde aliases — ikke rewrite.

---

*Audit udført 2026-09-04. Ingen gætterier: alle statusser baseret på `git` + filer + vitest ovenfor.*
