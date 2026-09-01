# Drive-folders · research gap vs PraxisOS

**Status:** research inventory — ingen active routing, ingen secrets i repo  
**Dato:** 2026-08-27  
**Branch:** `cursor/drive-folders-research-2c11`  
**Kilder:** Michaels to Google Drive-foldere (offentligt «anyone with link»)  
**Sammentænkning:** `alphaxiv-aurelle-transcript-impact.md`, `alphaxiv-top3-spikes.md`,
`shadow-evaluation.md`, `privacy-gate.md`, `harness-human-gate.md`, `promotion/`

**Metode:** WebFetch på folder-URL’er + HTML-inventar + Drive `uc?export=download`
på små markdown-filer. For `praxisos.zip` (3,42 GB): HTTP Range på EOCD/central
directory + selektiv udtræk af tekstfiler — **ingen** fuld zip i git, **ingen**
`.pth`/vendor-binaries commit’et.

**Google Drive MCP:** ikke tilgængelig i dette miljø (ingen Drive-namespace i MCP-katalog).

---

## 1 · Access status

| Folder | URL | Adgang | Indhold (synligt) |
|--------|-----|--------|-------------------|
| **1 · PraxisOS** | [folder `1F_jY0ZDRX…`](https://drive.google.com/drive/folders/1F_jY0ZDRX-VBSUscR2vfvOjlu1FP6JCf?usp=sharing) | ✅ offentlig view/download | 1 fil: `praxisos.zip` (3,42 GB · `3677404056` bytes · ændret Aug 1) · file id `1zMF3AhyiUjIyniDzW8V1GGvOASFkl5FT` |
| **2 · Handover 2026-06-16** | [folder `1lwdMSzk…`](https://drive.google.com/drive/folders/1lwdMSzkjdOStSIRcZr3q6m7_nf8jAb7c?usp=sharing) | ✅ offentlig view/download | 4 stub-markdowns (Jun 21) — se inventar |

Hvis adgang senere lukkes: del igen som «anyone with link can view», eller eksporter
en **docs-only** zip (uden `node_modules` / `.next` / `.venv` / `.pth` / `.env.local`)
og paste file-list.

**Sikkerhedsadvarsel (folder 2 README + zip-HANDOVER):** README beder om at slæbe
`PraxisOS-Handover-FULL.zip` ind med **`.env.local` + service_role_key**. Zip’ens
fulde `HANDOVER.md` indeholder også env-nøgle-lignende strenge. Folderne er
offentligt linkbare → **rotér Supabase service_role** (og evt. andre keys) hvis de
nogensinde lå i en delt zip; hold secrets ude af Drive «anyone with link».

---

## 2 · Inventory

### 2.1 Folder 2 — Handover stubs (downloadet)

| Fil | Type | Størrelse | Note |
|-----|------|-----------|------|
| `CODE-MAP - All Files Explained` | Markdown | ~3 KB | Stub → peger på GitHub/lokal fuld CODE-MAP; omtaler gammel `prototype/`-layout |
| `HANDOVER - PraxisOS Complete Handover` | Markdown | ~1 KB | Stub → TL;DR + link til fuld HANDOVER på GitHub |
| `PRAXISOS-BRIEF` | Markdown | ~2 KB | Kort brief · 2026-06-16 |
| `README - SLAEB ZIP HERIND` | Markdown | ~2 KB | Instruks om at uploade lokal handover-zip (inkl. `.env.local` ⚠️) |

**Tema:** onboarding/handover-pointere — **ikke** AlphaXiv-papers, datasets eller scanner-specs.

Repo-roden har allerede **nyere, fulde** versioner (`HANDOVER.md` ~40 KB ·
`CODE-MAP.md` · `PRAXISOS-BRIEF.md`, opdateret 2026-07-31). Drive-stubs er forældede.

### 2.2 Folder 1 — `praxisos.zip` (inventar via CD, ikke fuld download)

| Metrik | Værdi |
|--------|-------|
| Compressed | 3,42 GB |
| Uncompressed (sum) | ~5,2 GB |
| Entries | 37 895 (heraf ~34 357 filer) |
| Dominerende bulk | `prototype/.next/` Turbopack-cache · `prototype/node_modules/` · `modules/foot-scanner/vendor/` (FOCUS/FIND + `.venv`) · `vendor/persona-hub/` |

#### Top-level (temaer)

| Sti / fil | Type | PraxisOS-relevans |
|-----------|------|-------------------|
| `prototype/` | Gammel app-tree (Next + deps + `.next` + `.git`) | **Duplicate** af dagens repo-rod — undgå re-import |
| `modules/foot-scanner/` | Python FastAPI/CLI/MCP + OpenSCAD + vendor FOCUS/FIND | **Delvist nyttig** arkitektur; vendor-binaries = anti-git |
| `docs/harness/` | EPIC 1–4 + REV-01/02 + Sprint-6 blocker plan | **Mangler i repo** som kontrakt-arkiv |
| `docs/MODEL-CARD-v1.md` | Model card draft (shadow-only) | Overlap med `docs/vision/promotion/model-card.md` |
| `docs/CLINICAL-EVALUATION-PROTOCOL-BISPEBJERG.md` | VEK/protokol-udkast | **Mangler** (regulatory) |
| `docs/PRESAFE-DK-PRE-SUBMISSION-LETTER.md` | Notified Body pre-submission | **Mangler** (on hold i Michael-listen) |
| `docs/BY-PILAR-TEST-OBJECT.md` | Pilot/test-objekt | Delvist dækket af byPilar-tenant i kode |
| Root `0[1-4]-*.md` | Research/MVP/arkitektur/auth | Historisk; delvist supersedet |
| Root `*-REPORT.md` / `SPRINT-*.md` / `OVERNIGHT-*.md` | Panel-/audit-/overnight-rapporter | Historisk; brug selektivt |
| `MICHAELS-ACTION-LIST.md` | Human-only ops | **Mangler** som ops-checkliste |
| `vendor/persona-hub/` | Store `.jsonl` persona-datasets | E-learning research; **ikke** i git |
| `HANDOVER.md` / `CODE-MAP.md` / `PRAXISOS-BRIEF.md` (i zip) | Fulde juni/juli-docs | Duplicate / ældre end repo |

#### `docs/harness/` (udtrukket, tekst)

| Fil | Bytes | Indhold (kort) |
|-----|------:|----------------|
| `EPIC-1-Orchestration.md` | ~6 KB | DoD-Actual-appendiks (INV-1…19 grades) — parent EPIC mangler i denne zip-sti som fuld kontrakt |
| `EPIC-2-Clinical-Scanner.md` | ~5 KB | DoD-Actual for INV-CS-1…21 |
| `EPIC-2-REVISION-01.md` | ~35 KB | SPRG / LIST3R / YOLO26 — **senere retrakteret** |
| `EPIC-2-REVISION-02.md` | ~45 KB | Honest evidence-grounding, landmarks, client-side quality gate |
| `EPIC-3-Neural-Configurator.md` | ~3,5 KB | DoD-Actual orthotic/configurator |
| `EPIC-4-ELearning.md` | ~3,4 KB | DoD-Actual reflexion tutor / learning |
| `SPRINT-6-BLOCKER-PLAN.md` | ~21 KB | B1–B19 security/audit blockers |

#### `modules/foot-scanner/` (ikke-vendor, signal)

| Fil | Note |
|-----|------|
| `ARCHITECTURE.md` | Capture → calibrate (A4/ArUco) → reconstruct (COLMAP/Open3D/…) → biomech → OpenSCAD orthotic |
| `README.md`, `Dockerfile`, `docker-compose.yml`, `pyproject.toml` | Engine-pakke |
| `openscad/orthotic.scad` | Parametrisk orthotic-skabelon |
| `mcp/praxisos-foot-scanner.json` | MCP tool-deskriptor |
| `tests/test_pipeline.py`, `scripts/smoke_test.py` | Smoke |
| `vendor/FOCUS/…/*.pth`, DSINE `paper.pdf`, FIND checkpoints | **Store weights** — evaluér offline; commit aldrig |

**Ikke fundet i zip:** dedikeret AlphaXiv paper-pack / Aurelle-transcript (det lever i
nuværende repo under `docs/vision/alphaxiv-*` + `lib/alphaxiv/`). Drive er primært
**juni–juli harness/audit/scanner-vendor dump**, ikke den senere AlphaXiv-research-linje.

---

## 3 · Gap table · Drive → PraxisOS

Status-forklaring: **allerede** = integreret/supersedet i repo · **delvist** =
idé/kode findes, kontrakt eller dybde mangler · **mangler nyttigt** = værd at
hente (docs/ops, ikke binære) · **duplicate** = ignore · **anti** = usikkert /
klinisk uacceptabelt / fantasy.

| Drive-item | PraxisOS status | Anbefalet action |
|------------|-----------------|------------------|
| Folder 2 stub HANDOVER/CODE-MAP/BRIEF | **Allerede** (fuldere i repo-rod, 2026-07-31) | Ignorér Drive-stubs; pege Michael til repo |
| Folder 2 «slæb zip med `.env.local`» | **Anti** (secrets + offentlig folder) | Rotér keys; aldrig commit/deling af `.env.local` |
| `prototype/` i zip (inkl. `node_modules`/`.next`) | **Duplicate** | Ikke re-merge; repo er root-layout |
| `docs/harness/EPIC-1…4` DoD-Actual | **Mangler nyttigt** (kontrakt-arkiv) | Kopiér *renset* til `docs/harness/` (eller `docs/vision/harness-archive/`) som historik — map INV’er til nuværende `lib/swarm` + scanner-gates |
| `EPIC-2-REVISION-01` (SPRG/LIST3R/YOLO26) | **Anti** (fabrikerede/overclaim; REV-02 retrakterer) | Behold kun som «hvad vi *ikke* bygger»; se anti-liste i Aurelle-memo |
| `EPIC-2-REVISION-02` (EGL, landmarks, client QC) | **Delvist** — CaptureGate-Σ + landmarks-brief + quality.ts findes | Map INV-CS-19…21 → shadow CaptureGate / adjudication; **ingen** hard clinical reject |
| `EPIC-3` Neural Configurator / OpenSCAD | **Delvist** — OrthoSTL i Aurelle «senere»; `openscad/orthotic.scad` ikke i repo | Shadow/research: hent `.scad` + human CAD-gate; ikke CE-claim |
| `EPIC-4` E-Learning / reflexion | **Delvist** — RLVR-QuizPack / AdaptiveTutor i Aurelle; ingen `lib/learning/*` | class_0 quiz først; **ikke** patient-diagnose-tutor |
| `SPRINT-6-BLOCKER-PLAN` / audit-reports | **Delvist** — mange B-items er historiske; privacy/shadow/promotion er nyere | Diff kun åbne B17/B18/B16-tema vs nuværende ops; undgå at «re-fixe» lukkede stubs |
| `MICHAELS-ACTION-LIST` | **Mangler nyttigt** (ops) | Brug som Broser human-track: Ortos LOI, Patient-Zero, PRRC, DPIA — ikke kode-agent |
| Bispebjerg clinical eval protocol | **Mangler nyttigt** | Arkivér under `docs/vision/` eller regulatory-mappe når Broser vil genoptage; kræver VEK/PRRC |
| Presafe DK pre-submission letter | **Mangler** (bevidst on hold) | Behold draft offline; genoptag kun efter pilot-signal |
| `MODEL-CARD-v1.md` (zip) | **Delvist** — `docs/vision/promotion/model-card.md` | Align felter; zip-card nævner Bedrock/MedSAM-ensemble ≠ live Roboflow+TRELLIS pins |
| `modules/foot-scanner` ARCHITECTURE (A4 calibrate, COLMAP, biomech) | **Delvist** — MetricAnchor spike + MonoMSK proxy + TRELLIS live | Brug som **alternativ reconstruct-path research**; MetricAnchor A4-reference matcher calibrate-idéen |
| FOCUS densedepth `.pth` / FIND checkpoints | **Anti** til git + **anti** som clinical GT | Offline MetricAnchor/depth eksperiment kun; Art. 9 + privacy-gate |
| `vendor/persona-hub` jsonl | **Mangler** (dataset) / tung | Ikke i git; evt. privat object storage til class_0 persona-øvelser |
| Overnight / Frontier / Guru / Medical panel reports | **Duplicate** + delvis **anti** (overclaim) | Aurelle-memo + UNCATEGORIZED kill-list dækker anti-fantasy; ikke re-implement «God-Mode» |
| Zip `HANDOVER` med key-lignende strenge | **Anti** | Rotér; scrub før enhver gen-deling |
| AlphaXiv papers / Aurelle transcript | **Ikke i Drive** | **Allerede** i `docs/vision/alphaxiv-*` + `lib/alphaxiv/` — Michael skal ikke gen-researche derfra via Drive |
| Privacy / shadow / canary / TriView (nu i integrate) | **Allerede** (nyere end zip) | Drive tilføjer ikke unlock-arket — se PR #21 tip |
| Active routing / diagnose-VLM / MonoMSK-as-GT | **Anti** | Uændret: suggestions only; routing kanary-gated; never clinical GT |

---

## 4 · Top 5 · «vi mangler stadig / kan bruge»

1. **Harness EPIC-kontrakter (især EPIC-2 REV-02 + DoD-Actual)**  
   Manglende i repo som samlet arkiv. Brugbar til at mappe invariants til
   CaptureGate / landmarks / consent — **uden** at genoplive REV-01 SPRG/YOLO26-fantasy.

2. **Michael human-only track (`MICHAELS-ACTION-LIST`)**  
   Ortos/Sahva LOI, 3 Patient-Zero klinikker, PRRC, Datatilsynet DPIA, Bispebjerg VEK.
   Det er ikke kode — men det er den største ikke-tekniske gap zip’en minder om.

3. **Foot-scanner Python-arkitektur + `orthotic.scad` (uden vendor)**  
   A4/ArUco-kalibrering → metric scale er direkte input til **MetricAnchor**.
   OpenSCAD-skabelon er den konkrete konkrete OrthoSTL-spike i Drive (stadig human CAD-gate).

4. **Regulatory drafts: Bispebjerg-protokol + Presafe-letter + Model Card v0.1**  
   Findes ikke som fulde drafts i nuværende `docs/vision/promotion/` (kun templates).
   Nyttige når MDR-sporet genoptages — **ikke** som «vi er CE-marked».

5. **FOCUS/FIND depth-weights offline (ikke git)**  
   Eneste tunge ML-artefakt i zip der kan spille ind på MetricAnchor shadow.
   Privacy-gate + aldrig «clinical ground truth»; hold ude af repo.

---

## 5 · Explicit · hvad vi allerede har (Michael: undgå redo)

| Område | Hvor i PraxisOS nu | Drive-værdi |
|--------|--------------------|-------------|
| Fuld handover / code-map / brief | Repo-rod `HANDOVER.md`, `CODE-MAP.md`, `PRAXISOS-BRIEF.md` | Folder 2 = stubs; zip = ældre kopi |
| AlphaXiv ranking + anti-fantasy | `docs/vision/alphaxiv-top3-spikes.md`, `alphaxiv-aurelle-transcript-impact.md` | **Ikke** i Drive-folderne |
| CaptureGate / TriView / MetricAnchor spikes | Vision-docs + `lib/scanner/capture-gate.ts`, `triview-lift.ts` | REV-02 overlapper CaptureGate-idé; MetricAnchor ≈ A4 calibrate |
| Privacy unlock + shadow eval + adjudication | `privacy-gate.ts`, `shadow-*.ts`, `docs/vision/privacy-*`, `shadow-evaluation.md` | Nyere end zip (Aug integrate) |
| Promotion / model card templates | `docs/vision/promotion/*` | Zip model card = ældre draft — merge felter, ikke erstat |
| Live scan stack | Roboflow Universe pins + Replicate TRELLIS + quality 70 + MonoMSK **proxy** | Zip Python COLMAP-path er *alternativ*, ikke erstatning |
| Swarm / human gate / NO_AUTO_MERGE | `lib/swarm/*`, `harness-human-gate.md`, `scripts/harness-human-gate.mjs` | EPIC-1 overlapper orchestration-invariants |
| Landmarks training posture | `landmarks-training-brief.md`, registry `deployable: false` | EPIC-2 landmarks = samme gate-filosofi |
| E-learning som research | Aurelle RLVR-QuizPack / AdaptiveTutor-0 | EPIC-4 + persona-hub = senere class_0 |

**Kort verdict:** Drive indeholder **ikke** en hemmelig AlphaXiv-guldmine oven på det,
I allerede har research’et. Den store zip er et **juli-2026 snapshot**
(harness/audit + Python foot-scanner + regulatory drafts + vendor-bulk). Det
nyttige er **selektive docs + ops-liste + metric/orthotic-idéer** — ikke at
genimportere `prototype/` eller 3 GB cache/weights.

---

## 6 · Anti-anbefalinger (Drive-specifikke)

1. **Commit aldrig** `praxisos.zip`, `.pth`, `.venv`, `node_modules`, `.next`, persona-hub jsonl.  
2. **Genopliv ikke** EPIC-2 REV-01 (SPRG/LIST3R/YOLO26) som produktionsplan — REV-02 + Medical panel retrakterer.  
3. **Claim ikke** MonoMSK/FOCUS/FIND output som clinical GT eller force-plate.  
4. **Enable ikke** active pathology routing / diagnose-tutor fordi et overnight-report siger «done».  
5. **Del ikke** `.env.local` / service_role i offentlige Drive-links — rotér hvis eksponeret.

---

## 7 · PR-pointer

- Integrate-stack (privacy/shadow/canary/TriView): **[PR #21](https://github.com/Broser-ai/PraxisOS/pull/21)** · branch `cursor/integrate-all-superb-2c11`
- Dette memo: branch `cursor/drive-folders-research-2c11` · fil
  `docs/vision/drive-folders-research-gap.md`

---

## Relaterede filer

- `docs/ops/praxisos-monorepo-research-gap.md` — deep research vs `praxisos-monorepo`
  (Drive checkout + GitHub 404 access note; merge/port/ignore backlog)
- `docs/vision/alphaxiv-aurelle-transcript-impact.md`
- `docs/vision/alphaxiv-top3-spikes.md`
- `docs/vision/harness-human-gate.md`
- `docs/vision/capture-gate.md` · `triview-lift.md` · `shadow-evaluation.md`
- `docs/vision/privacy-gate.md` · `promotion/model-card.md`
- `lib/scanner/*` · `lib/swarm/*` · `lib/alphaxiv/*`
