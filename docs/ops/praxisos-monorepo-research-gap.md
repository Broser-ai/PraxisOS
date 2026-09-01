# praxisos-monorepo · research gap vs PraxisOS

**Status:** research inventory — **ingen** kode-merge, **ingen** deploy, **ingen** secrets i repo  
**Dato:** 2026-09-01  
**Branch:** `cursor/monorepo-research-2c11`  
**Mål-repo (nuværende produkt):** `Broser-ai/PraxisOS` (`/workspace`)  
**Kilde-URL (anmodet):** `git@github.com:Broser-ai/praxisos-monorepo.git`  
**Sammentænkning:** `docs/vision/drive-folders-research-gap.md`, `docs/vision/alphaxiv-*`,
`docs/vision/harness-human-gate.md`, `docs/vision/shadow-evaluation.md`,
`docs/vision/privacy-gate.md`, `docs/ops/supabase-to-hetzner-migration.md`

---

## 0 · Executive verdict (til Michael)

1. **GitHub-repoet `Broser-ai/praxisos-monorepo` findes ikke for denne agent** (SSH + HTTPS +
   `gh api` → 404). Det er **ikke** i den offentlige Broser-ai-org-liste.
2. **Lokal checkout findes i Google Drive** under
   [PraxisOS → `praxisos/`](https://drive.google.com/drive/folders/10S79DncQ-wZfIrw8LzjmuK6kN_OeB9lW)
   (ekstraheret 2026-09-01 fra juli-zip). Drive `.git/config` bekræfter:
   `remote.origin.url = https://github.com/Broser-ai/praxisos-monorepo.git`, branch `master`.
3. **Monorepoet er et juli-2026 multi-tree snapshot**, ikke et Turbo/pnpm-workspace:
   `prototype/` + `modules/foot-scanner/` + `praxis-agent/` + `mobile/` + `docs/` + `vendor/`.
4. **Nuværende PraxisOS har allerede absorberet og supersedet `prototype/`-kernen**
   (root Next.js, MDR-gate, MCP, Bird, self-host Hetzner, shadow/privacy/canary).
5. **Det værdifulde er selektivt:** harness/QMS-docs, human-track, foot-scanner Python
   (uden weights), orthotic `.scad`, evt. voice-plane stubs — **ikke** blind tree-merge.
6. **Blind-merge er farligt:** Clerk-auth, Vercel-topologi, autonome voice-tools,
   Class-IIa biomech/ICD-forslag, 3 GB vendor/cache, forældede Supabase-cloud-antagelser.
7. **Når GitHub-adgang genåbnes:** re-kør denne score letter-for-letter mod live `master`;
   indtil da er Drive-extract + denne memo SoT for gap-planen.

---

## 1 · Access status

| Kilde | Resultat | Note |
|-------|----------|------|
| `git@github.com:Broser-ai/praxisos-monorepo.git` | ❌ 404 | Ingen SSH-host-key til GitHub i env; HTTPS fallback også 404 |
| `gh repo clone Broser-ai/praxisos-monorepo` | ❌ Not Found | GraphQL + REST |
| `gh repo list Broser-ai` | ❌ ikke i listen | 16 synlige repos; PraxisOS findes, monorepo gør ikke |
| Drive `.git/config` i `praxisos/` | ✅ | `origin` → `https://github.com/Broser-ai/praxisos-monorepo.git` |
| Drive folder `praxisos/` | ✅ | Fuld juli-checkout (prototype, modules, praxis-agent, mobile, docs, vendor, `.git`) |
| Drive `praxisos.zip` (tidligere research) | ✅ | Samme indhold; se `docs/vision/drive-folders-research-gap.md` |

**Konklusion access:** Repoet **har eksisteret lokalt hos Michael** med den præcise remote-URL,
men er **ikke klonbart nu** (slettet, aldrig publiseret, eller private uden Cursor-token).
Research nedenfor er **Drive-checkout-baseret** (= bedste tilgængelige monorepo-kopi).

**Michael-action for fuld letter-by-letter:** genskab/åbn `Broser-ai/praxisos-monorepo`
(eller send korrekt URL) + grant Cursor GitHub App read access → agent re-diff’er commits.

---

## 2 · Monorepo struktur (Drive `praxisos/` · ~2026-07-17)

```
praxisos/                          # local path historisk: C:/Users/Ambro2/praxisos
├── .git/                          # origin → Broser-ai/praxisos-monorepo (master)
├── README.md                      # Status 2026-07-17 · 334/334 tests · Sprint 6
├── MICHAELS-ACTION-LIST.md
├── STATUS-SPRINTS-1-7.md
├── SPRINT-6-FINAL-STATUS.md
├── COMPLETE-AUDIT-REPORT.md       # (og øvrige sprint/audit reports)
├── HANDOVER.md / CODE-MAP.md / PRAXISOS-BRIEF.md
├── prototype/                     # Next.js 16 app (BLEV til dagens PraxisOS-root)
│   ├── app/ · lib/ · supabase/migrations/ · tests/
│   └── … LangGraph · FHIR · voice stubs · configurator …
├── modules/
│   └── foot-scanner/              # Python FastAPI/CLI/MCP · OpenSCAD · vendor FOCUS/FIND
├── praxis-agent/                  # Separat Next+LiveKit scaffold (Clerk · Ethos-klon)
│   ├── app/ · components/ · lib/ · worker/
│   └── SYSTEM-BLUEPRINT.md · PRAXIS-AGENT-KOMPLET.md
├── mobile/                        # React Native / Expo-lignende (Class 0 patient)
├── docs/
│   ├── harness/                   # EPIC-1…4 · SPRINT-6-BLOCKER-PLAN
│   └── qms/                       # SOUP inventory · iso-14971/
└── vendor/
    └── persona-hub/               # store .jsonl (anti-git)
```

**Ikke** et klassisk JS-monorepo (ingen `pnpm-workspace.yaml` / `turbo.json` / `nx.json`
fundet). Det er et **multi-package folder-monorepo** med én primær Next-app + side-trees.

### 2.1 Snapshot-signaler (juli)

| Signal | Monorepo (Drive README / STATUS) | PraxisOS nu |
|--------|----------------------------------|-------------|
| Tests | 334/334 · 42 filer (claim) | ~16 testfiler (vision/swarm/gates fokususeret) |
| Layout | `prototype/` subtree | Flattened til repo-root |
| Migrations | 0001–0009 (MDR, foot_scan_*, shared RLS) | 0001–0006 (+ self-host compose) |
| MDR | `canDispatchAgent` wired Sprint 6 | **ALREADY_HAVE** i `lib/agents.ts` + orchestrator |
| Prod topology | Vercel + Supabase cloud (antaget) | **Hetzner** · self-host Postgres · `app.bypilar.dk` |
| SMS | NemSMS stubs / KOMBIT track | **Bird** live path (`lib/bird.ts`) |
| Vision | Python COLMAP path + stubs | Roboflow + TRELLIS + shadow/canary/privacy |
| Agents | Aria/Sigrid/Frej active; Niels/Liv/Atlas frozen | Samme MDR-filosofi + nyere swarm/harness |

---

## 3 · Feature-by-feature scorecard

Forklaring:

- **MERGE_NOW** — unik værdi mangler i PraxisOS; lav-risiko at hente (docs/ops/selektiv kode)
- **PORT_SELECTIVE** — idé/patterns/snippets; rewrite ind i nuværende gates
- **ALREADY_HAVE** — supersedet af nuværende PraxisOS
- **IGNORE / ARCHIVE** — obsolete, duplicate, unsafe, eller governance-konflikt

### 3.1 `prototype/` (Next.js klinik-OS)

| Area | Score | Begrundelse |
|------|-------|-------------|
| App shell / multi-tenant / booking / journal | **ALREADY_HAVE** | Root `app/`, `lib/tenants.ts`, journal, bookings |
| `canDispatchAgent` / MDR tiers | **ALREADY_HAVE** | `lib/agents.ts` + `lib/orchestrator.ts` |
| HMAC sessions / scrypt passwords | **ALREADY_HAVE** | `lib/session-token.ts`, `lib/password.ts` |
| MCP 19 tools | **ALREADY_HAVE** | `lib/mcp-tools.ts` / `app/api/mcp/v1` |
| Audit writers | **ALREADY_HAVE** | `lib/audit.ts` (videreudviklet) |
| LangGraph orchestration | **ALREADY_HAVE** | + nyere `lib/swarm/*`, agents registry |
| FHIR R5 façade | **PORT_SELECTIVE** | Ikke i nuværende tree; nyttig som **shadow/export-only** facade senere — ingen clinical claim |
| Voice-plane stubs (LiveKit/Deepgram) | **PORT_SELECTIVE** | Kun class_0 receptionist; **ikke** diagnose-voice; overlap med `praxis-agent` |
| Configurator / Vorum mill / gait MVP | **PORT_SELECTIVE** | Shadow + human CAD-gate; Class IIa frozen |
| Learning / e-learning | **PORT_SELECTIVE** | class_0 quiz senere; **ikke** patient-diagnose-tutor |
| `node_modules` / `.next` i snapshot | **IGNORE** | Cache/deps — aldrig merge |
| Cloud-Supabase-only antagelser | **IGNORE** | Konflikt med self-host cutover |

### 3.2 `modules/foot-scanner/`

| Area | Score | Begrundelse |
|------|-------|-------------|
| `ARCHITECTURE.md` + pipeline (capture→calibrate→reconstruct→biomech→orthotic) | **MERGE_NOW** (docs) / **PORT_SELECTIVE** (code) | MetricAnchor/A4-idé matcher vision-spikes; kolmap-path er **alternativ** til TRELLIS |
| `openscad/orthotic.scad` | **MERGE_NOW** | Concrete OrthoSTL spike; human CAD-gate obligatorisk |
| MCP bridge (`foot.*` tools) | **PORT_SELECTIVE** | Må **ikke** bypass adjudication; map til Broser MCP + shadow |
| FastAPI/CLI/`pyproject.toml` | **PORT_SELECTIVE** | Isoleret service bag `FOOT_SCANNER_TOKEN`; ikke i Next process |
| Biomech flags → ICD-10 suggestions | **IGNORE / ARCHIVE** (as-is) | Konflikt: AI findings = suggestions only + clinician gate; ICD-auto = governance risk |
| `vendor/FOCUS|FIND|*.pth` | **IGNORE** | Anti-git · Art.9 · aldrig clinical GT |
| Claiming “orthotic-grade” from phone | **IGNORE** | Overclaim vs MDR Class 0 posture |

### 3.3 `praxis-agent/` (LiveKit + Clerk scaffold)

| Area | Score | Begrundelse |
|------|-------|-------------|
| `SYSTEM-BLUEPRINT.md` / voice pipeline diagram | **PORT_SELECTIVE** | God reference for class_0 voice receptionist |
| CSP / security headers patterns | **PORT_SELECTIVE** | Nyttige header-idéer til Hetzner/Next |
| Clerk auth stack | **IGNORE** | Konflikt med PraxisOS session/MitID/tenant model |
| Ethos reverse-eng marketplace/tools | **IGNORE** | Andet produkt; ikke klinik-OS |
| Slack/Notion write-tools | **IGNORE** | Autonomi-risiko; Broser human-gate |
| Separate Vercel+Railway deploy | **IGNORE** | Konflikt med Hetzner single-host preferencer |
| Clerk/LiveKit/Supabase cloud env matrix | **IGNORE** (blind) | Secrets surface + dual-DB |

### 3.4 `mobile/`

| Area | Score | Begrundelse |
|------|-------|-------------|
| Patient-facing RN shell | **PORT_SELECTIVE** | Senere; Class 0 only; white-label byPilar branding |
| Capture UI patterns | **PORT_SELECTIVE** | Align med `app/(internal)/scan` + CaptureGate |
| Shipping as “clinical scanner app” | **IGNORE** | MDR |

### 3.5 `docs/harness/` + `docs/qms/` + root sprint docs

| Area | Score | Begrundelse |
|------|-------|-------------|
| EPIC-1…4 DoD-Actual | **MERGE_NOW** | Mangler som kontrakt-arkiv i repo |
| EPIC-2 REV-02 (landmarks, client QC) | **MERGE_NOW** (arkiv) | Map til CaptureGate/landmarks — shadow only |
| EPIC-2 REV-01 (SPRG/LIST3R/YOLO26) | **IGNORE** | Retrakteret / fantasy |
| `SPRINT-6-BLOCKER-PLAN` + FINAL-STATUS | **MERGE_NOW** (ops historik) | Diff åbne B16–B18 vs human track |
| `MICHAELS-ACTION-LIST` | **MERGE_NOW** | Ortos LOI, Patient-Zero, PRRC, DPIA |
| Presafe letter + Bispebjerg protokol | **MERGE_NOW** (regulatory archive) | On-hold; ikke “vi er CE” |
| `docs/qms/soup-inventory.csv` | **MERGE_NOW** | Opdatér versions vs nuværende `package.json` |
| iso-14971 folder | **MERGE_NOW** (hvis ikke-tom) | QMS scaffold |
| Overnight/God-Mode panel reports | **IGNORE** | Overclaim |

### 3.6 `vendor/persona-hub`

| Area | Score | Begrundelse |
|------|-------|-------------|
| `.jsonl` datasets | **IGNORE** (git) / **PORT_SELECTIVE** (object storage later) | E-learning research only |

### 3.7 Infra / env / CI (monorepo vs nu)

| Area | Score | Begrundelse |
|------|-------|-------------|
| Hetzner compose / self-host DB | **ALREADY_HAVE** (PraxisOS ahead) | `docker-compose.*.yml`, `scripts/*selfhost*`, cutover docs |
| Bird SMS | **ALREADY_HAVE** | Monorepo havde NemSMS stubs |
| Roboflow / TRELLIS / shadow / canary / TriView | **ALREADY_HAVE** | Nyere end monorepo |
| Traefik i monorepo | **ALREADY_HAVE / N/A** | Ikke set som first-class i Drive root; nuværende prod docs dækker Hetzner |
| GitHub Actions CI i monorepo | **PORT_SELECTIVE** | PraxisOS root har **ingen** `.github/` — overvej minimal CI senere (ikke monorepo-blind) |
| `FOOT_SCANNER_TOKEN` fail-closed | **PORT_SELECTIVE** | Genindfør hvis Python-engine brings back |
| Clerk / Cartesia / Deepgram keys | **IGNORE** until product decision | Dual-auth risiko |

---

## 4 · Broser hard-constraint conflicts

| Constraint | Monorepo-risiko | Handling |
|------------|-----------------|----------|
| byPilar ≠ PraxisOS branding på customer hosts | `praxis-agent` / mobile kan lække “Praxis” chrome | White-label audit før enhver UI-port |
| Tenants/API/MCP/DB = Broser-only | Foot-scanner MCP + Ethos-style tools | Hold MCP bag Broser auth; ingen tenant self-host MCP |
| AI findings = suggestions only | Biomech `flag` + ICD suggestions; voice tools | Strip autonomous clinical language; clinician adjudication |
| Pathology/candidates shadow until gates | Active reconstruct→report path | Kun shadow + `adjudication.ts` gates |
| No autonomous diagnosis | Class IIa agents + scanner reports | Keep `frozen` / CE flag; no blind unfreeze |
| Production = Hetzner / self-host | Vercel+Supabase+Clerk topology i `praxis-agent` | **IGNORE** deploy topology; port patterns only |

---

## 5 · Prioritized merge backlog (ordered)

### P0 — docs/ops archive (lav risiko, høj klarhed)

1. Kopiér *renset* `docs/harness/EPIC-*.md` + `SPRINT-6-BLOCKER-PLAN.md` →
   `docs/harness/` (eller `docs/vision/harness-archive/`).
2. Kopiér `MICHAELS-ACTION-LIST.md` → `docs/ops/michaels-action-list.md` (opdatér dato +
   markér lukkede kode-blockers).
3. Kopiér Presafe letter + Bispebjerg clinical eval → `docs/ops/regulatory-archive/`
   (status: on-hold).
4. Kopiér `docs/qms/soup-inventory.csv` → `docs/ops/qms/` og **diff** mod nuværende deps
   (zod major, next pins, fjern `safety-kit` hvis repo 404).
5. Kopiér `modules/foot-scanner/ARCHITECTURE.md` + README → `docs/vision/foot-scanner-architecture.md`.

### P1 — selective code ports (shadow / Class 0)

6. Hent `openscad/orthotic.scad` (+ kun non-binary Python package layout) til
   `modules/foot-scanner/` **uden** vendor weights; wire som research CLI, ikke prod path.
7. Port FHIR resource-mappers som **export-only** under `lib/fhir/` med tests; ingen
   DiagnosticReport → patient UI uden gate.
8. Voice-plane: genbrug **kun** adapter-interfaces fra `prototype/lib/voice/*` eller
   blueprint latency-mål — **ikke** Clerk `praxis-agent` tree; auth forbliver PraxisOS.
9. Genindfør fail-closed `FOOT_SCANNER_TOKEN` hvis/når engine container tilføjes til
   `docker-compose.praxis.yml`.

### P2 — later / research only

10. Mobile capture shell → Expo spike aligned with CaptureGate (Class 0).
11. Persona-hub → private object storage for e-learning (ikke git).
12. FOCUS/FIND weights offline MetricAnchor experiments (privacy-gate, never GT).

### Explicit “nothing left of value” (til Michael)

| Område | Verdict |
|--------|---------|
| `prototype/node_modules`, `.next`, Turbopack caches | **Intet** — slet/ignorér |
| Duplicate root HANDOVER/CODE-MAP/BRIEF fra juli | **Intet** — nuværende rod er nyere |
| EPIC-2 REV-01 SPRG/LIST3R/YOLO26 plan | **Intet** — anti-fantasy |
| Ethos marketplace / Clerk / dual cloud deploy | **Intet** til PraxisOS produkt |
| Autonomous ICD / orthotic-grade claims | **Intet** uden CE + clinician gates |
| AlphaXiv / Aurelle / Roboflow unlock stack | **Allerede i PraxisOS** — monorepo tilføjer ikke |

---

## 6 · Top 10 MERGE_NOW / PORT (paths)

| # | Action | Monorepo path (Drive) | Target i PraxisOS |
|---|--------|------------------------|-------------------|
| 1 | MERGE_NOW | `docs/harness/EPIC-*.md`, `SPRINT-6-BLOCKER-PLAN.md` | `docs/harness/` |
| 2 | MERGE_NOW | `MICHAELS-ACTION-LIST.md` | `docs/ops/michaels-action-list.md` |
| 3 | MERGE_NOW | `docs/PRESAFE-DK-PRE-SUBMISSION-LETTER.md` | `docs/ops/regulatory-archive/` |
| 4 | MERGE_NOW | `docs/CLINICAL-EVALUATION-PROTOCOL-BISPEBJERG.md` | `docs/ops/regulatory-archive/` |
| 5 | MERGE_NOW | `docs/qms/soup-inventory.csv` (+ iso-14971) | `docs/ops/qms/` |
| 6 | MERGE_NOW | `modules/foot-scanner/ARCHITECTURE.md` | `docs/vision/foot-scanner-architecture.md` |
| 7 | MERGE_NOW | `modules/foot-scanner/openscad/orthotic.scad` | `modules/foot-scanner/openscad/` |
| 8 | PORT_SELECTIVE | `modules/foot-scanner/` (Python sans vendor) | `modules/foot-scanner/` + compose service |
| 9 | PORT_SELECTIVE | `prototype/lib/fhir/*` (hvis til stede i extract) | `lib/fhir/` export-only |
| 10 | PORT_SELECTIVE | `praxis-agent/SYSTEM-BLUEPRINT.md` + CSP headers | docs + Next headers — **ikke** Clerk app |

---

## 7 · Top IGNORE (med reasons)

1. **Hele `prototype/` tree-merge** — allerede flattened + videreudviklet i PraxisOS root.  
2. **`vendor/**/*.pth` / FOCUS / FIND / persona-hub i git** — størrelse, Art.9, anti-GT.  
3. **`praxis-agent` Clerk + Ethos clone as product** — auth/topology konflikt; Broser-only tenants.  
4. **EPIC-2 REV-01 / overnight “God-Mode” reports** — retrakteret / overclaim.  
5. **Biomech → ICD / “orthotic-grade” auto-claims** — bryder suggestions-only + shadow gates.  
6. **Vercel/Railway/Supabase-cloud deploy recipes** — konflikt med Hetzner self-host.  
7. **Autonomous Slack/Notion write tools** — human-gate / NO_AUTO_MERGE.  
8. **Re-import juli `HANDOVER` med key-lignende strenge** — secrets hygiene (rotér hvis eksponeret).

---

## 8 · Risks of blind-merging the monorepo

1. **Auth fork:** Clerk middleware vs PraxisOS sessions/MitID → broken tenant isolation.  
2. **Clinical autonomy leak:** unfrozen Class IIa paths, ICD suggestions, orthotic auto-STL.  
3. **Brand leak:** PraxisOS chrome on byPilar customer hosts.  
4. **Infra regression:** undo Hetzner/self-host cutover by restoring Supabase-cloud assumptions.  
5. **Secret sprawl:** Drive zip/handover historically carried env-like strings.  
6. **Repo bloat / supply chain:** 3 GB+ caches/weights; unknown licenses in vendor.  
7. **Test theater:** 334-test claim er juli-snapshot; nuværende gate-tests er den relevante SoT.  
8. **MCP surface expansion** without Broser auth → tenant/data exfil risk.  
9. **Duplicate orchestrators** (`praxis-agent` worker vs `lib/swarm` / LangGraph) → inconsistent gates.  
10. **False “CE readiness”** from copying Presafe/QMS docs without PRRC/VEK process.

---

## 9 · Letter-level digs (hvor det betyder noget)

### 9.1 package.json

| | Monorepo `prototype` (juli claims) | PraxisOS nu |
|--|-------------------------------------|-------------|
| name | `praxisos-prototype` (samme lineage) | `praxisos-prototype` |
| next | ~16.2.x | `^16.2.12` |
| LangChain/LangGraph | present | present |
| three / R3F | present | present |
| Bird | absent | present (`lib/bird.ts` + admin UI) |
| Clerk (praxis-agent) | present in side-app | **absent** (correct) |
| `safety-kit` (SOUP csv) | `github:Broser-ai/safety-kit#v0.1.0` | **404** — ignore until published |

### 9.2 Env vars (delta)

**Monorepo / praxis-agent ekstra (port ikke blindt):**  
`CLERK_*`, `LIVEKIT_*`, `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`, `SLACK_BOT_TOKEN`,
`NOTION_API_KEY`, `NEXT_PUBLIC_POSTHOG_*`.

**PraxisOS ahead:**  
`BIRD_*`, `PRAXIS_SHADOW_EVAL_ENABLED`, `PRAXIS_ACTIVE_ROUTING_ENABLED`,
`FOOT_VISION_CANARY_PERCENT`, `PRAXIS_TRIVIEW_SHADOW_ENABLED`, `PRAXIS_CAPTURE_GATE_SHADOW`,
`REPLICATE_*`, `ROBOFLOW_*`, self-host `PRAXIS_DB` / compose.

**Shared / keep:** `PRAXIS_SESSION_SECRET`, Supabase/self-host URL keys, OpenAI/Anthropic,
MitID, MedCom/NemSMS stubs.

### 9.3 Docker / Traefik / DB

- Monorepo foot-scanner: `docker compose` service port **8787**, bearer token.  
- PraxisOS: `docker-compose.db.yml`, `docker-compose.praxis.yml`, `docker/supabase-selfhost/` —
  **ahead**; any scanner service must attach here, not revive Vercel.  
- Traefik: not a first-class monorepo root artifact in Drive extract; do not invent from memory.

### 9.4 Migrations

Monorepo claimed `0007_mdr_*`, `0008_hotfix`, `0009_enable_rls_on_shared_tables`.  
PraxisOS currently: `0001`…`0006` (swarm/agent ledger/meshes).  
**PORT_SELECTIVE:** review MDR/foot_scan SQL against live self-host schema **before** apply —
do not dump juli migrations onto Hetzner without diff.

### 9.5 MCP

- PraxisOS: 19 clinic tools (`list_bookings` … `interpret_foot_scan`).  
- Monorepo foot-scanner: `foot.list_engines|new_session|ingest_*|reconstruct|report|generate_orthotic|list_sessions`.  
**Port under Broser auth only;** `generate_orthotic` + `report` = shadow + human CAD/clinician gate.

---

## 10 · Sibling Broser repos (checked, not monorepo)

| Repo | Relevans |
|------|----------|
| `Broser-ai/PraxisOS` | Current product SoT |
| `Broser-ai/EARTH` | Unrelated Vite logistics UI |
| `Broser-ai/Broser-ai-autonom-multi-partner` | Revenue swarm — **IGNORE** for clinic OS |
| `Broser-ai/mtc-platform` | Master Team Console — orchestration patterns only, not merge |
| `Broser-ai/safety-kit` | Referenced in SOUP csv — **404** currently |

---

## 11 · Relation til tidligere Drive-research

Denne memo **supplerer** (ikke erstatter) `docs/vision/drive-folders-research-gap.md`:

- Drive-research = zip CD inventory + selective extract.  
- Denne memo = **explicit monorepo remote confirmation** + `praxis-agent`/`mobile`/`qms`
  scorecard + prioritized backlog vs **post-selfhost** PraxisOS.

Når GitHub-repoet genåbnes: append sektion `## 12 · Live git re-diff` med commit SHAs.

---

## 12 · PR / process note

- Branch: `cursor/monorepo-research-2c11`  
- Deliverable: denne fil only (research).  
- **Do not** merge monorepo code to `main` from this work.  
- **Do not** deploy.  
- Re-run with live clone when Michael grants access.
