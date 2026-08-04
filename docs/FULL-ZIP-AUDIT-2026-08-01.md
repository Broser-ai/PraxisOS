# PraxisOS · Fuld zip-gennemgang (2026-08-01)

> **Scope:** Alle filtrable kilde-/doc-filer i `praxisos.zip` (364 filer · ~204 MB efter frasortering af `.next`/`node_modules`/ML-weights).  
> **Base for produktion:** nuværende branch `cursor/swarm-savage-execution-2c11` (= `/workspace`).  
> **Zip-kilde:** July 17 snapshot · identisk `lib/` med `origin/savage-sweep-2026-07-12`.

---

## 0 · Executive verdict

| Spørgsmål | Svar |
|---|---|
| Er alt fra zip med i nuværende branch? | **Nej.** 44 lib-filer, 16 API/sider, ~45 testsuites, 5+ migrations mangler. |
| Er zip “klar til færdig produktion”? | **Nej.** Score **~34/100** som production. Stærk prototype + stærke invariants. |
| Er nuværende branch klar til produktion? | **Delvist til clinic-ops (class_0).** Auth/bookings/clients/swarm er længere fremme end zip. Clinical scanner er ikke. |
| Er “light-years-ahead” reelt? | **Delvist.** Guardrails/schemas/pipelines er reelle. MitID/NemSMS/Pay/autonomous 9-agent/sub-mm scanner som live produkt er **ikke**. |
| Anbefalet vej | Behold `/workspace` som base. Port selektivt fra zip/savage-sweep i lag. Aldrig wholesale dump. |

---

## 1 · Dækningsrapport (hvad er læst)

| Bucket | Filer | Status |
|---|---:|---|
| `prototype/lib/*` | 68 | ✅ Gennemgået fil-for-fil (purpose + REAL/STUB/RISKY) |
| `prototype/app/api/*` + middleware | ~30 | ✅ Alle routes klassificeret |
| `prototype/app/(internal|t)/*` | ~55 pages | ✅ Klassificeret REAL / UI-ONLY |
| `prototype/components/*` | 20 | ✅ Klassificeret |
| `prototype/tests/*` | 45 suites (~345 `it/test`) | ✅ Mapped vs workspace |
| `prototype/supabase/migrations/*` | 9 | ✅ Konfliktplan skrevet |
| `modules/foot-scanner` (uden vendor weights) | ~24 | ✅ Arkitektur-vurderet |
| Root reports / epic docs | ~25 | ✅ Claim-vs-reality |
| `.next` / `node_modules` / `.pth` | ~37k | ❌ Bevidst ikke læst (build/cache/weights) |

**Konklusion på “har du læst alle filer?”:** Alle meningsfulde kilde-/doc-filer er gennemgået. Build-cache og ML-binaries er inventariseret, ikke line-læst.

---

## 2 · Hvad mangler i nuværende branch (fra zip)

### 2.1 Libs (44) — high-value først

**Port-nu (light-years, reel kode):**
1. `lib/scanner/{watertight,findings-schema,sprg-guardrails,pipeline}.ts`
2. `lib/validation/shadow-mode.ts`
3. `lib/surveillance/drift-monitor.ts`
4. `lib/configurator/{schema,constraints,orthotic-generator}.ts`
5. `lib/fhir/resource-mappers.ts`
6. `lib/learning/{medical-claims,path-generator,reflexion-tutor,schema}.ts`
7. `lib/session` already present — keep ours
8. `lib/redact` already present — keep ours
9. `lib/color/oklab.ts`
10. `lib/foot-scanner.ts` (HTTP client) + Python module as private service

**Port senere (adapters, kræver nøgler/infra):**
- `lib/scanner/{gpu-adapter,vlm-caller,stl-export}.ts`
- `lib/voice/*`, `lib/embeddings/*`, `lib/gait/*`
- `lib/orthotic/mill-adapter.ts`, `lib/finance/sygesikringen-factoring.ts`
- `lib/shared-store/*` (Redis skal være ægte før prod multi-instance rate-limit)

**Port ikke wholesale:**
- `lib/roboflow/mcp-client.ts` (mock-heavy)
- UI mock pages uden durable backend
- Gaussian splat theater uden viewer + data pipeline

### 2.2 API/sider kun i zip
- FHIR R5 façade (`/api/fhir/R5/*`)
- Foot-scan sessions/frames/reconstruct/report/orthotic
- Scans upload + STL
- Learning chat
- UI: `/learning`, `/configurator`, `/scan/capture`

### 2.3 Tests kun i zip
~45 suites: scanner, learning, configurator, security (CSP/CORS), regulatory audit-completeness, gait, FHIR, finance, a11y.  
**Brug som kravspec** — importer kun når modulet ports.

### 2.4 Migrations — hard rename required

| Zip | Workspace | Handling |
|---|---|---|
| `0001_initial` | `0001_initial` | Diff; keep workspace |
| `0002_foot_scanner` | `0002_seed_demo` | **Konflikt** → ny `0005_foot_scanner` (fix `app.tenant_id`, audit target) |
| `0003_langgraph` | `0003_langgraph` | Keep workspace |
| `0004_clinical_scanner` | `0004_swarm_state` | **Konflikt** → ny `0006_clinical_scanner` |
| `0005…0009` | — | Renumber to `0007+` after review |

---

## 3 · Hvad nuværende branch allerede har overgået zip

| Area | Workspace ahead |
|---|---|
| Data durability | `lib/data/repo.ts` + memory/Supabase path |
| Auth API | `/api/auth/me`, `/api/signup`, verified API keys |
| Tenant isolation | `authorizeTenantRequest` (session mismatch → 403) |
| Swarm / 24/7 | Full `lib/swarm/*`, cron, SSE, awaken, human-gated merge |
| Frej MDR | Fixed: `class_0` + MDR-tier authoritative (zip havde `class_iia`+`active` bug) |
| Ops | `/api/health`, orchestrator run poll, smoke scripts |
| Tests | Swarm + request-auth + api-keys (ikke i zip) |

---

## 4 · REAL vs STUB vs THEATER (sammenfatning)

### Reel nok til at porte (“light-years” kerne)
- HMAC sessions, scrypt passwords, PII redaction
- SPRG guardrails, watertight mesh checks, findings Zod schema
- Shadow-mode kappa gate, CUSUM drift monitor
- Orthotic 16-param schema + constraints + generator
- FHIR R5 mappers (ren projektion)
- Learning medical-claims regex + reflexion tutor contract
- Foot-scanner Python pipeline scaffold (COLMAP/Open3D) som **separat service**
- LangGraph orchestrator skeleton + MDR dispatch metadata

### Stub / UI-theater (må ikke sælges som live)
- MitID, CPR Match, NemSMS/KOMBIT, MedCom, Sundhed.dk
- PraxisOS Pay (MobilePay/Dankort/Klarna)
- Autonom 9-agent workforce med tool-execution
- Live Deepgram medical ASR (default = scripted)
- Live Roboflow training/deploy
- Vorum mill “live” (placeholder)
- Staff admin-sider der kun læser `lib/mock*`
- “Sub-mm clinical scanner in production” uden GPU/VLM keys + engine

### Risikable bugs fundet i zip (fix før port)
1. Default-to-stub når keys mangler (embeddings/GPU/VLM/ASR) — fail-closed i prod
2. Env schema vs runtime mismatch (`PRAXIS_LLM_MODE` mock/stub/live)
3. Audit column mismatch vs `audit_log` schema
4. Hardcoded API key “secrets” i seed
5. Frej MDR inconsistency (fixed på vores branch)
6. Scanner pipeline kalder ikke SPRG wrap i main path
7. Migration 0002 bruger `praxis.tenant_id` (skal være `app.tenant_id`)
8. Redis shared-store er throwing stub
9. STL post-verify overstated
10. MCP CORS `*` (zip claimed fixed — workspace stadig `*` i MCP)

---

## 5 · Production readiness scores

| Produktflade | Score | Kommentar |
|---|---:|---|
| Zip snapshot overall | **34** | Prototype + strong invariants |
| Workspace clinic-ops (auth/bookings/clients) | **55** | Durable path exists; DB seed/migrations i prod mangler |
| Workspace swarm harness | **60** | Works locally + cron; needs Supabase snapshot applied |
| Clinical scanner (zip) | **25** | Pipeline real; engines/keys/storage not production |
| DK public integrations | **10** | Catalogs/UI only |
| Payments | **15** | Fee math + UI; no PSP |
| MDR Class IIa go-live | **5** | Correctly frozen; Presafe on hold |

**“Klar til færdig produktion”** = nej for hele platformen.  
**Klar til næste produktionslag** = ja for class_0 clinic loop, hvis:
1. PR #3 merges  
2. Migrations applied (inkl. `0004_swarm_state`)  
3. Password hashes seeded i Supabase  
4. Secrets rotated / fail-closed enforced  

---

## 6 · Light-years-ahead inklusionsplan (prioriteret)

### Lag A — Ship clinic-ops (nu)
1. Merge working-core + swarm (PR #3)
2. Apply `0004_swarm_state` + seed users
3. Fail-closed MCP CORS allowlist + events HMAC always-on
4. Staff UI already session-tenant — keep

### Lag B — Import “moat” guardrails (næste coding sprint)
1. Port scanner schemas + SPRG + watertight + shadow-mode + drift-monitor **med tests**
2. Port configurator schema/constraints (frozen behind feature flag)
3. Port FHIR mappers + read-only R5 routes (no write claims)
4. Port learning medical-claims + path generator (class_0 patient education)
5. Renumber migrations `0005+` as above; **do not** break swarm `0004`

### Lag C — External engines (infra)
1. Deploy `modules/foot-scanner` as private service (token, no public CORS `*`)
2. Wire `FOOT_SCANNER_URL` + object storage for meshes
3. Optional: Replicate GPU + Anthropic VLM behind `PRAXIS_CLINICAL_DEV` / CE gate
4. Real Redis/Upstash for SharedStore before multi-instance rate limits

### Lag D — Stakeholder-only (Michael)
- Ortos LOI, Patient-Zero clinics, Presafe (on hold), PRRC, live API keys  
Se `docs/ingest/MICHAELS-ACTION-LIST.md`.

### Bevidst ude (indtil CE / partners)
- Auto-merge/deploy swarm (NO)
- Class IIa agents in prod (Niels/Liv/Atlas)
- Claims of autonomous living organism / auto PR to main

---

## 7 · Claim vs reality (top 12)

1. “334/334 tests” — sandt i zip-era prototype; **ikke** i nuværende workspace (38 tests).  
2. “Pilot-ready” — modsagt af Medical Expert Panel (“not fit for patient exposure”).  
3. “CSP landed” — ikke i nuværende `next.config`/`middleware`.  
4. “MCP CORS fixed” — workspace MCP stadig `*`.  
5. “SharedStore fixes multi-instance” — Redis stub; memory default.  
6. “Audit no longer Potemkin” — dispatcher findes; kliniske call sites mangler i workspace.  
7. “9 agents autonomous” — personas + routing; begrænset tool-loop.  
8. “MitID/NemSMS/MedCom live” — UI/catalog.  
9. “Sub-mm scanner prod” — pipeline + Python scaffold; weights/engines separate.  
10. “Vorum mill live” — mostly stub.  
11. Migrations 0008/0009 “applied” — not in workspace line.  
12. Zip `lib/` == savage-sweep `lib/` — **exact overlap** (68/68). Zip er bundle, ikke nyere magi.

---

## 8 · Anbefalet beslutning til dig (Michael)

Svar gerne med:
1. **Merge PR #3?** ja/nej  
2. **Kør migration 0004 i prod Supabase?** ja/nej  
3. **Start Lag B port** (scanner guardrails + configurator schemas + FHIR mappers + learning claims) på ny branch? ja/nej  
4. **Deploy foot-scanner Python service** som separat Render/Docker service? ja/nej  

Indtil da: zip er fuldt inventariseret; intet 3.7 GB dump i git; working-core + swarm forbliver kanonisk base.
