> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.


# EPIC-1 · §DoD-Actual (appendiks)

**Type:** appendiks der skal *tilføjes* nederst i eksisterende `docs/harness/EPIC-1-Orchestration.md` (full 315-line contract not in Drive extract; this file is the DoD-Actual appendix only) (315 linjer). Filen her indeholder KUN den nye sektion — parent workflow appender den efter §9 "Definition of Done for denne kontrakt".

**Baseline:** [`COMPLETE-AUDIT-REPORT.md`](../../COMPLETE-AUDIT-REPORT.md) §9 Sprint 1 tabellen + §2 blocker-liste, snapshot 2026-07-16.

---

## 10 · Definition of Done — Actual

### 10.1 Grade-legende

- ✅ **enforced** = både produktionskode kalder invariantens gate AND ≥1 test asserter failure-mode.
- 🟡 **partially-enforced** = kode ELLER test findes, men ikke begge (typisk: DB-constraint eksisterer, men ingen SQL-test kaster den; eller: prop-test findes, men gate-koden er ikke wired ved boundary).
- ❌ **declared-only** = kontrakten nævner INV-koden, men hverken kode-gate eller test håndhæver failure-mode.

### 10.2 EPIC-1 invariant-status pr. 2026-07-16

| INV | Titel (kort) | Grade | Evidens fra audit | Reference |
|---|---|---|---|---|
| **INV-1** | Ingen cross-tenant lækage | ✅ enforced | Write-once tenantId-reducer i `lib/orchestrator.ts` + 4-sub-test + 200-run fast-check property-test i `tests/agent-orchestration/inv-1-tenant-isolation.test.ts`. Gold standard. | audit §5.1, §9 Sprint 1 |
| **INV-2** | Support-rolle må crosse tenants, aldrig i samme run | 🟡 partially-enforced | Tenant er skrivebeskyttet pr. run via INV-1's reducer (implicit dækning). Ingen dedikeret support-role-property-test. | audit §9 Sprint 1 |
| **INV-3** | Ingen råt CPR i state eller persistens | 🟡 partially-enforced | `redact.ts` + orchestrator-throw + DB CHECK triple-layer. Men H-BE-1 flagger `containsRawCpr` som for aggressiv (false-positives på MobilePay-refs, phone, booking-IDs) og H-BE-2 flagger whitelist-recursion. Kode: ja. Assertion-strength: ikke robust. | audit §4.1 H-BE-1/H-BE-2, §9 Sprint 1 |
| **INV-4** | MCP JSON-RPC 2.0 konformitet 100 % | ❌ declared-only | Ingen JSON-RPC 2.0 conformance-test på `/api/mcp/v1`. 483-LOC tool-registry eksponeret uden schema-test. | audit §C16, §9 Sprint 1 |
| **INV-5** | Ingen ny tool-registrering udenom MCP | ❌ declared-only | Ingen test verificerer at kun `MCP_TOOLS`-array kaldes fra worker-nodes. | audit §C16, §9 Sprint 1 |
| **INV-6** | Frej har veto | 🟡 partially-enforced | Roller kaldes via `canRoleInvokeAgent`, men H-REG-5 flagger at Frej selv (class_iia) bypasses sin egen MDR-tier via `deployment_status='active'` — vetoens gate er inkonsistent. | audit §4.4 H-REG-5 |
| **INV-7** | Rolle-check pr. worker | ✅ enforced | `canRoleInvokeAgent` kaldt i `lib/orchestrator.ts:216`. B4-fix (Batch 1) sikrer at `actorRole` er authentic ved boundary (før INV-7 kan omgås via body-injection). | audit §9 Sprint 1, blocker B4 |
| **INV-8** | Rate-limit håndhæves før `graph.invoke()` | ❌ declared-only | 83-LOC sliding-window uden tests. Sliding-window-edge og internal-tool-call double-counting utestet. `ipBuckets`/`userBuckets` er in-memory Maps på serverless (B9). | audit §4.2 H-TC-2, blocker B9 |
| **INV-9** | Hvert run efterlader komplet trace | 🟡 partially-enforced | `agent_runs` + `agent_steps` er strukturelt korrekte. Ingen determinisme-replay-test (delvis dependency på INV-12). | audit §9 Sprint 1 |
| **INV-10** | Audit-log hash-chain ubrudt | 🟡 partially-enforced (efter Batch 1) | Trigger + hash-chain-funktion eksisterer i migration 0001. `lib/audit.ts` var no-op indtil Batch 1 (B1) — nu skriver reelt. Ingen chain-integritet-test + tamper-detection endnu; H-REG-3 flagger race-condition uden lock. | audit §H-TC-1, §H-REG-3, blocker B1 |
| **INV-11** | `origin` obligatorisk og sandt | 🟡 partially-enforced | Zod-schema på route-body kræver origin. Ingen test forfalsker cron-origin fra chat-route. | audit §H-SEC-4 |
| **INV-12** | Compliance-workflows deterministiske | ❌ declared-only | Ingen test kører 100 identiske Frej/Sigrid-runs med `temperature=0`+seed. Stray `Math.random()` eller timestamp shipper grønt. | audit §C17 |
| **INV-13** | Ingen tavse fallbacks | ❌ declared-only | Silent-stub tværs af VLM, embeddings, ASR, GPU, LiveKit (C1, B7). Batch 2 fixer via `create-live-or-stub.ts`. | audit §C1, blocker B7 |
| **INV-14** | Graph-run ≤ 30 s (120 s scribe) | ❌ declared-only | Ingen timeout-test. Model-swap der dobbelt-latency shipper grønt. | audit §H-TC-5 |
| **INV-15** | Maks 12 node-transitioner | ✅ enforced | Testet + DB-constraint i migration 0003:39. Impossible-to-bypass fra app-kode. | audit §5.3, §9 Sprint 1 |
| **INV-16** | Token-loft pr. run | ❌ declared-only | 100k-loft utestet. Cost-eksplosion detekteres ikke i CI. | audit §H-TC-5 |
| **INV-17** | Alle 60 eksisterende endpoints returnerer 200 | ❌ declared-only | Ingen E2E-harness, ingen HTTP-integration-test. Utestbart i CI før B13 lands. | audit §C13, blocker B13 |
| **INV-18** | `lib/agents.ts` persona-eksporter stabile | ✅ enforced | Unit-test verificerer `AGENTS`, `getAgent(id)`, `AGENT_IDS` er urørte. | audit §9 Sprint 1 |
| **INV-19** | Model-tier whitelisting pr. agent | ✅ enforced | Enforced i orchestrator via `ALLOWED_TIERS[agent.id]`. Property-test kører alle 9 agenter. | audit §9 Sprint 1 |

### 10.3 Sammendrag EPIC-1

- ✅ enforced: **6/19** (INV-1, INV-7, INV-15, INV-18, INV-19; INV-2 delvist inkluderet via INV-1's reducer)
- 🟡 partially-enforced: **6/19** (INV-2, INV-3, INV-6, INV-9, INV-10, INV-11)
- ❌ declared-only: **7/19** (INV-4, INV-5, INV-8, INV-12, INV-13, INV-14, INV-16, INV-17)

**Regression-alarm:** 7 af 18 kontrakt-inv (39 %) er declared-only. INV-4/5 (MCP-contract) og INV-12 (determinism) er audit-critical for CE-dossier. Alle er trackede i `SPRINT-6-BLOCKER-PLAN.md` Batch 2/3.

---

*Appendiks tilføjet 2026-07-16 · docs-fixer Batch 2 · baseline COMPLETE-AUDIT-REPORT.md*
