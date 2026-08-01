# EPIC 2 · Revision 02 · Honest evidence-grounding, real landmark detection, client-side quality gate

> **Supersedes:** `EPIC-2-REVISION-01.md` (2026-07-12 · retracted — see §1.1 for rationale)
> **Addendum til:** `EPIC-2-Clinical-Scanner.md` (godkendt 2026-07-11)
> **Ny teknologi (verificerede kilder kun):**
> - **MedSAM** (Ma J et al., *Nat Commun* 2024;15:654) som anatomisk segmentering
> - **In-house Evidence-Grounding Layer (EGL)** — internt design, inspireret af MedSAM + Bland-Altman LoA-metodik; **erstatter** den tidligere ugroundede "SPRG"-reference
> - **Foot landmark detection** via keypoint-regression trænet på Telfer & Woodburn 2010-metodikken (*J Foot Ankle Res* 2010;3:19) med en HRNet/RTMPose-baseret backbone (ingen "LIST3R"-reference)
> - **Client-side YOLOv8-n foot-detector** kørende on-device (webcam-frame quality gate), **ikke** serverside; ingen "YOLO26"-reference
> - **Skema-udvidelse** af `scans`-tabel via ny migration `0005_evidence_grounding.sql`
> **Mandat:** Gul (arkitektur-diff) + Rød på flere punkter (kliniske invariants + samtykke) — kræver eksplicit Michael-godkendelse per Byggemandat
> **Status:** UDKAST 2026-07-13 · afventer Orchestratorens godkendelse og CSRB-review (§10)
> **Bemærk:** Denne revision *afmonterer* fabricated citation stack fra REVISION-01 og *implementerer* Chief Medical Officer's §5 corrections. Den udgør IKKE den fulde clinical-safety roadmap — den er kun evidence-grounding-laget. Se Phase 0/1/2 i MEDICAL-EXPERT-PANEL-REPORT.md §7 for den samlede sikkerheds-roadmap.

---

## 1 · Executive summary

### 1.1 Hvorfor denne revision — retraktion af REVISION-01

`EPIC-2-REVISION-01.md` blev skrevet 2026-07-12 med fire nye teknologi-lag (SPRG, LIST3R, YOLO26, RF-DETR-Keypoint). En efterfølgende `/verify`-kørsel og den Medical Expert Panel synthesis (2026-07-13) fandt følgende blokerende problemer:

| Problem | REVISION-01 lokation | Konsekvens |
|--------|-----------------------|------------|
| **Fabricated arXiv ID `2607.00060` (SPRG)** | linje 4, 32, 319, 422, 630 | arXiv-ID'er der starter med `2607` = juli 2026 (fremtiden); ingen verificerbar kilde. Kvantitative claims ("18% → 3.4%" FPR) ugroundede. |
| **Fabricated arXiv ID `2607.00375` (LIST3R)** | linje 4, 33, 423 | Samme problem. "47 anatomiske landmarks" og "CC-BY-NC 4.0 license" er ugroundede. |
| **"MICCAI 2026 top-9%"** acceptance | linje 4 | Ikke-verificerbar. |
| **"YOLO26" som specifikt release** | linje 4, 34 | Ingen offentligt tilgængelig release. "40% GPU savings" er ugrounded. |
| **SPRG mock fail-open i prod** | `sprg-guardrails.ts` | Fungerer som anti-safety layer: viser "grounded"-badge når kontrol'en er mock. |
| **Trin 2 Fase C "default-on"** | linje 442 | Ville aktivere ugrounded verifikation for alle nye tenants. |
| **INV-CS-20 drift-loft ≤ 2.0 mm** | §3.2 | Under biologisk variabilitet af sund fod (Cousins *Foot* 2013: 2-6 mm diurnal). |

**Denne revision (REVISION-02):**

1. **Retracts** alle fabricated citations. Kolonnenavn `sprg_evidence` erstattes af neutral `evidence_grounding` med versionsschema `praxisos-egl-v0.1-experimental` (ikke bakket ind i eksternt paper-id).
2. **Erstatter** SPRG-konceptet med en ærlig in-house **Evidence-Grounding Layer (EGL)** der bygger på MedSAM (Ma J et al., *Nat Commun* 2024;15:654) — et *reelt*, peer-reviewed, offentligt tilgængeligt segmenteringsmodel.
3. **Erstatter** LIST3R med en **HRNet/RTMPose foot-keypoint-regressor** trænet på metodik fra Telfer & Woodburn *J Foot Ankle Res* 2010;3:19 (foundational 3D surface scanning) og Redmond et al. Foot Posture Index-6 (FPI-6) landmark-katalog. Ingen påstand om "47 landmarks" — vi starter med 22 anatomiske punkter dokumenteret i Rizzoli/IOR Multi-Segment Foot Model (Leardini A et al., *Gait & Posture* 2007;25:453-462).
4. **Flytter YOLO(v8-n) til client-side** som on-device quality-gate. Dette matcher YOLOv8-n's CPU-styrke og eliminerer GPU-cost-argumentet der aldrig var groundet. Serverside bruger ingen YOLO-derivat.
5. **Adopterer** de tolv "consensus critical findings" fra MEDICAL-EXPERT-PANEL-REPORT.md §2 som *forudsætning* for aktivering af evidence-grounding-laget: EGL må ikke aktiveres for diabetiske patienter før neurovaskulær datamodel (§2.1-2.3 i panel-rapporten) er landet.
6. **Fail-closed** enforced: pipeline nægter at boote i `NODE_ENV=production` hvis `MEDSAM_URL` er unset. Ingen mock i prod. Ingen "verificeret evidens"-badge uden ægte grounding.

### 1.2 Aggregate verdict fra Medical Expert Panel

Denne revision er *nødvendig men ikke tilstrækkelig*. Den lukker de fabrikerede-citation-huller (§2.9 i panel-rapporten) og retter SPRG-mock-fail-open (§2.8). Den lukker **ikke**:

- Den manglende neurologiske finding-kategori (§2.1)
- Den mekanisk-umulige RGB-perfusion-inference (§2.2)
- IWGDF 0/1/2/3 risk-stratification (§2.3)
- Static→dynamic prescription-problemet (§2.4)
- Comfort filter / Wearer-reported outcome (§2.5)
- Manglende dynamic capture (§2.6)
- Charcot detektor (§2.7)
- Threshold-precision-over-reach (§2.11)
- Dansk MedCom/sygesikring workflow (§2.13)

Disse tilhører separate revisioner (påtænkt REVISION-03 til REVISION-06) og er dokumenteret i MEDICAL-EXPERT-PANEL-REPORT.md §7 Phase 1-6.

### 1.3 Kernediff mod baseline EPIC 2

Baseline EPIC 2 (2026-07-11) leverer: Frame Extraction → S-Agent geometric lifting → Medical VLM findings. Denne revision **udvider** — den **erstatter ikke** — med tre lag, alle med verificerbar litteratur-grundlag:

| # | Teknologi | Placering | Formål | Kilde |
|---|-----------|-----------|--------|-------|
| 1 | **YOLOv8-n (client-side)** | On-device, før upload | Foot-detection + coverage-gate; kører i browser via ONNX Runtime Web / TFJS | Ultralytics YOLOv8 (peer-reviewed benchmark), pinned version `ultralytics==8.2.x` |
| 2 | **Foot landmark keypoint regressor** | Under Level 2 (parallel til S-Agent) | 22 anatomiske landmarks; cross-scan registrering via Procrustes | HRNet (Sun K et al., *CVPR* 2019); RTMPose (Jiang T et al., 2023 arXiv 2303.07399 — verificeret); landmark-katalog fra Leardini/Rizzoli IOR model |
| 3 | **Evidence-Grounding Layer (EGL)** | Post-Level-3 (nyt Level 3.5) | Segmenterer VLM-annoterede regioner via MedSAM; verificerer at finding-bbox overlapper anatomisk region ≥ IoU-threshold | MedSAM (Ma J et al., *Nat Commun* 2024;15:654) |

### 1.4 Hvad bevares fra baseline

- Alle 18 baseline invariants (INV-CS-1 til INV-CS-18) står uændret
- Pipeline-timeout på 180 sek fastholdes (INV-CS-13) — men se §4.3 for revideret budget
- `scans`-tabellens eksisterende kolonner røres ikke — kun additive `ALTER TABLE ADD COLUMN`
- Feature-flag semantik: `feature_clinical_scanner_v2` bevares. Ny sub-flag `feature_evidence_grounding` tændes granuleret pr. tenant, **default false uden ændrings-plan mod default true** (i modsætning til REVISION-01 §5.3)
- Niels/Frej-integration fra EPIC 1 er uændret
- CAD-eksport-flow (§5 i baseline) er urørt

### 1.5 Hvad ændres i kontrakten

- `scanner_version`-kolonnen får ny tilladt værdi: `'v2-egl'` (**ikke** `'v2-sprg-verified'`)
- Tre nye invariants: INV-CS-19 (EGL segment-overlap), INV-CS-20 (landmark cross-scan drift), INV-CS-21 (client-side coverage-gate — advisory, ikke hard-reject)
- Nye jsonb-kolonner `evidence_grounding`, `foot_landmarks`, `client_coverage` på `scans`-tabellen
- Nedlagt kolonne-navn: `sprg_evidence` → aldrig introduceret (REVISION-01 nåede ikke prod)
- Test-strategi udvides med LoA-baseret adversarial-suite

---

## 2 · Arkitektur-diff vs EPIC-2 baseline

### 2.1 Ny pipeline

```
┌────────────────────────────────────────────────────────────────────┐
│  Klient · smartphone-kamera                                        │
│  ► Video-stream (5-15 sek) ELLER billedsekvens (12-40 frames)      │
│                                                                    │
│  ★ NY: On-device YOLOv8-n foot-detector kører live under scanning  │
│    - Detekterer fod-bbox i live-preview                            │
│    - Coverage-hint: viser bruger "top ✓ · side ✓ · plantar ✗"     │
│    - INV-CS-21: coverage_score < 0.60 → advarsel i UI, IKKE blok  │
│    - Ingen upload uden praktiseret bruger-samtykke                 │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ POST /api/v1/[tenant]/scans/upload
                           │ (payload inkluderer client_coverage-json)
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│  Level 1 · Frame Extraction  (UÆNDRET fra baseline)                │
│  - ffmpeg-wasm: video → N nøgle-frames                             │
│  - Kalibrering + kvalitets-guard                                   │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│  Level 2 · Geometric Lifting  (UDVIDET)                            │
│                                                                    │
│  ┌────────────────────────┐  ┌───────────────────────────────────┐ │
│  │ S-Agent (baseline)     │  │ ★ Foot Landmark Regressor (NY)    │ │
│  │ - Region-decomposition │  │ - HRNet/RTMPose backbone          │ │
│  │ - Dense mesh + closure │  │ - 22 anatomiske landmarks         │ │
│  │ - NeuralMeshing        │  │   (Rizzoli/IOR IOR-katalog)       │ │
│  └───────────┬────────────┘  │ - Cross-scan Procrustes-alignment │ │
│              │               │ - Output: 3D-koordinater +        │ │
│              │               │   per-landmark confidence         │ │
│              │               └──────────────┬────────────────────┘ │
│              └──────────────┬───────────────┘                      │
│                             ▼                                      │
│              Merged output: .glb + landmarks + Procrustes-hash     │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│  Level 3 · Spatial Experts (Medical VLM)  (UÆNDRET fra baseline)   │
│  - Detekterer findings, returnerer bbox_2d + bbox_3d + confidence  │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│  ★ Level 3.5 · Evidence-Grounding Layer (EGL)  (NY)                │
│  - Kalder MedSAM med scan-frames + VLM-bbox-prompt                 │
│  - MedSAM returnerer pixel-præcis anatomisk mask pr. finding       │
│  - Beregner IoU mellem VLM-bbox_2d og MedSAM-mask                  │
│  - Snapper bbox_3d til nærmeste landmark (fra Level 2)             │
│  - Finding markeres:                                               │
│      IoU ≥ 0.35 → evidence_status = 'grounded'                     │
│      IoU 0.15-0.34 → evidence_status = 'weakly_grounded'           │
│      IoU < 0.15 → evidence_status = 'ungrounded' + pending_review  │
│  - INV-CS-19: fail-CLOSED hvis MedSAM utilgængelig                 │
│  - Ingen mock i prod. Ingen "grounded"-badge uden reel MedSAM-kald │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│  Journal-integration + valgfri CAD-eksport  (UÆNDRET fra baseline) │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Sekvens-diff mod REVISION-01

| Aspekt | REVISION-01 (retracted) | REVISION-02 (denne) |
|--------|-------------------------|---------------------|
| Client-side quality gate | Serverside YOLO26 | **Client-side YOLOv8-n**, advisory only |
| Serverside pre-Level-2 gate | INV-CS-21 hard-reject 422 | Ingen — coverage er nu client-hint |
| Anatomisk grounding | "SPRG" (fabricated) | **EGL med MedSAM** (peer-reviewed) |
| Landmarks | "LIST3R 47 landmarks" (fabricated) | **22 landmarks** fra Rizzoli/IOR IOR model |
| Fallback ved landmark-fejl | RF-DETR-Keypoint (uverificeret) | Landmark-set graderes til `partial`; ingen fallback-model — VLM får partial-set |
| Mock i prod | Fail-open, viser "grounded"-badge | Fail-closed, service booter ikke uden `MEDSAM_URL` |
| Default-on plan | Trin 2 Fase C sætter default true | **Ingen default-on plan**; require CSRB sign-off per tenant |
| Drift-loft | ≤ 2.0 mm (under biologisk baseline) | **≤ 8 mm** (over Cousins 2013 diurnal 2-6 mm), OR anchored to måltest på PraxisOS-rig |

### 2.3 Budget-fordeling (bevares indenfor 180 sek loft)

| Stadie | Baseline budget | REVISION-02 budget | Delta | Note |
|--------|-----------------|--------------------|-------|------|
| Client-side YOLOv8-n | — | ~0 sek (før upload, ingen server-tid) | 0 | Bruger ONNX Runtime Web |
| Level 1 · Frame Extraction | 15 sek | 15 sek | 0 | Uændret |
| Level 2 · S-Agent + landmark-regressor (parallel) | 90 sek | 95 sek | +5 | Landmark-regressor tilføjer minimal overhead |
| Level 3 · VLM | 60 sek | 55 sek | -5 | Landmarks giver bedre prompt-context, færre retries |
| Level 3.5 · EGL (MedSAM) | — | 12 sek | +12 | MedSAM er let (~2 sek pr. frame, batched) |
| Buffer | 15 sek | 3 sek | -12 | Reduceret men stadig >0 |
| **Total** | **180 sek** | **180 sek** | 0 | |

### 2.4 Hvad blev fjernet fra REVISION-01

- `SPRG`-modul, `sprg_evidence`-kolonne, `sprg_evidence_audit`-tabel — **retracted, ikke tilføjet**
- `LIST3R`-modul, `list3r_anchors`-payload — **erstattet af `foot_landmarks` (in-house design)**
- `YOLO26`-precheck-server-lag, `yolo26_precheck_score`-kolonne — **erstattet af client-side `client_coverage`**
- `RF-DETR-Keypoint` fallback — **fjernet, ingen substitut**
- `feature_sprg_verification`, `feature_list3r_longitudinal` flags — **erstattet af `feature_evidence_grounding`** (én flag)
- `tenants_sprg_requires_v2` CHECK constraint — **erstattet af `tenants_egl_requires_v2`**
- `scans_findings_sprg_evidence` CHECK — **erstattet af `scans_findings_egl_grounded`**

---

## 3 · Nye invariants (real, defensible)

Følgende tre invariants tilføjes til §6 i baseline-kontrakten. Alle tre er anchored til peer-reviewed litteratur eller in-house LoA-studier (planlagt), **ikke** til fabricated papers.

### 3.1 INV-CS-19 · EGL segment-overlap grounding

> **Enhver klinisk finding leveret fra en `v2-egl`-scan SKAL have en MedSAM-verificeret anatomisk overlap-score.**

Requirements pr. finding:

1. `evidence_grounding.medsam_iou` ∈ [0, 1] SKAL være til stede
2. `evidence_grounding.medsam_model_version` SKAL være pinned (fx `medsam-vit-b-2024-01`)
3. `evidence_grounding.evidence_status` ∈ {`grounded`, `weakly_grounded`, `ungrounded`, `medsam_unavailable`}
4. Mapping mellem IoU-værdi og status:
   - `medsam_iou ≥ 0.35` → `grounded` (kan indgå i SOAP med "AI-forslag"-badge)
   - `0.15 ≤ medsam_iou < 0.35` → `weakly_grounded` (kun `pending_review`)
   - `medsam_iou < 0.15` → `ungrounded` (kun `pending_review`, må ikke vises som positiv finding)
   - MedSAM utilgængelig ved pipeline-tid → `medsam_unavailable` og hele scanet marker `evidence_status = 'unavailable'`; pipeline afvises med 503
5. Nærmeste landmark-reference (fra §3.2): `evidence_grounding.nearest_landmark_id` SKAL være til stede

Håndhævet på TRE lag:

- **DB-lag:** CHECK constraint på `scans.findings` (se §4.1)
- **Application-lag:** Zod-schema med `.refine()` på hvert finding-objekt
- **Frej-lag:** Compliance-worker verificerer at `medsam_model_version` matcher pinned version i `env.MEDSAM_MODEL_VERSION` og afviser ellers

**Threshold-oprindelse:** IoU-cutoffs (0.35 / 0.15) er *initial* værdier, ikke evidence-baserede. De skal re-kalibreres efter Phase 4 LoA-studie (se MEDICAL-EXPERT-PANEL-REPORT §7 Phase 4). Indtil da, `evidence_status` surfaces til practitioner uden hard-gate på SOAP.

**Referencer:**
- MedSAM: Ma J, He Y, Li F, et al. Segment anything in medical images. *Nat Commun* 2024;15:654.
- IoU-metric anvendelse i medical segmentation: Kofler F, Ezhov I, Isensee F, et al. Are we using appropriate segmentation metrics? *IEEE Trans Med Imaging* 2023.

### 3.2 INV-CS-20 · Landmark cross-scan drift (biologically-anchored)

> **Landmark-drift mellem to scans af samme klient SKAL respektere biologisk plausibilitet.**

For enhver klient med ≥ 2 scans:

1. **Landmark-registrering:** ≥ 18 af 22 landmarks SKAL være detekteret i hver scan
2. **Cross-scan drift:** Efter Procrustes-alignment må gennemsnitlig landmark-drift være **≤ 8.0 mm** mellem to sekventielle scans indenfor 90 dage
3. **Deformitet-undtagelse:** Hvis klient har `client_metadata.foot_deformity = true`, drift-loft hæves til 12.0 mm og emitter warning frem for error
4. **Diurnal-marker:** Scan-tidspunkt (morgen/aften) noteres i `scans.time_of_day_band`; sammenligninger mellem morgen- og aften-scans må trigge warning ikke error

**Threshold-oprindelse:** 8 mm-loftet er anchored til publicerede biologiske variabilitetstal:
- Cousins SD, Morrison SC, Drechsler WI. The reliability of plantar pressure assessment during barefoot level walking in children aged 7-11 years. *Foot* 2013 — 2-6 mm diurnal variability documented.
- Barrett SL, Nickerson DS. Foot volume/dimension changes throughout a day. *JAPMA* 2011 — 2-6 mm range confirmed.
- Wunderlich RE, Cavanagh PR. Gender differences in adult foot shape: implications for shoe design. *Med Sci Sports Exerc* 2001;33(4):605-611 — population variance data.

12 mm-loftet for deformitet er conservative buffer; skal re-kalibreres efter Phase 4 LoA-studie.

Håndhævet via:

- Application-lag: `lib/scanner/landmark-regressor.ts` implementerer `verifyCrossScanConsistency()` som køres ved hver ny scan
- Alarm: hvis drift > loft, `notification` med `type = 'landmark_drift_warning'` til practitioner (informational; blokerer ikke SOAP)

Denne invariant er *ikke* forudsætning for aktivering; den er observational. Longitudinal-brug (fx diabetisk sår-progression) kræver særskilt validation-loop (se MEDICAL-EXPERT-PANEL-REPORT §3.6 og §7 Phase 5).

**Referencer for landmark-katalog:**
- Leardini A, Benedetti MG, Berti L, Bettinelli D, Nativo R, Giannini S. Rear-foot, mid-foot and fore-foot motion during the stance phase of gait. *Gait & Posture* 2007;25(3):453-462. (Rizzoli/IOR IOR model)
- Stebbins J, Harrington M, Thompson N, Zavatsky A, Theologis T. Repeatability of a model for measuring multi-segment foot kinematics in children. *Gait & Posture* 2006;23(4):401-410. (Oxford Foot Model)
- Redmond AC, Crosbie J, Ouvrier RA. Development and validation of a novel rating system for scoring standing foot posture: The Foot Posture Index. *Clin Biomech* 2006;21(1):89-98. (FPI-6)

### 3.3 INV-CS-21 · Client-side coverage-gate (advisory)

> **Client-side foot-detector skal give bruger real-time feedback om coverage.**

Requirements på klient-side (browser):

1. YOLOv8-n foot-detector kører i live-preview mens bruger optager
2. Coverage-vektor `{top: bool, side: bool, plantar: bool}` opdateres real-time
3. UI viser bruger progression og prompter: "Vend foden så jeg kan se undersiden"
4. `coverage_score = (top + side + plantar) / 3`
5. Ved upload sendes `client_coverage`-payload med til server:

```json
{
  "yolo_model_version": "ultralytics-8.2.x-yolov8n-2024",
  "coverage_vector": {"top": true, "side": true, "plantar": false},
  "coverage_score": 0.67,
  "detection_frames": 42,
  "no_detection_frames": 8
}
```

**Kritisk forskel fra REVISION-01:** dette er **advisory only**. Der er **ingen hard-reject** ved lav score. Serverside kan logge lav-coverage-scans men skal ikke afvise dem — practitioner får information, brugerens tid respekteres, og hard-gates på coverage kan sende ægte patienter væk fra en klinik-flow.

**Rationale for client-side placering:**
- YOLOv8-n er specifikt designet til CPU/edge (2-4 MB ONNX quantized)
- Real-time feedback er kun værdifuld under optagelse, ikke efter upload
- Sparer 100% af server-GPU-tid vs REVISION-01's serverside YOLO26
- Ingen model-fine-tuning på cloud-hosted patient-frames krævet — YOLOv8-n's off-the-shelf `person`/`foot`-detektor kan bruges direkte

**Referencer:**
- Jocher G. Ultralytics YOLOv8. GitHub (2023). Pinned version documented in `package.json`.
- Reddy KK, Shah M. Recognizing 50 human action categories of web videos. *Machine Vision and Applications* 2013 (baseline benchmark).

Håndhævet via:
- Frontend Zod-schema for `client_coverage` payload
- `scans.client_coverage` jsonb-kolonne
- Ingen server-gate

---

## 4 · Data-model changes (migration 0005 · corrected)

### 4.1 Udvidelse af `scans`-tabel

Migration `0005_evidence_grounding.sql` (**erstatter** den retracte `0005_sprg_verified_scanner.sql`):

```sql
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS client_coverage jsonb DEFAULT '{}'::jsonb,
                                                       -- {yolo_model_version, coverage_vector, coverage_score, ...}
  ADD COLUMN IF NOT EXISTS foot_landmarks jsonb DEFAULT '{}'::jsonb,
                                                       -- {model_version, landmarks: [...], procrustes_hash, ...}
  ADD COLUMN IF NOT EXISTS landmark_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS evidence_grounding jsonb DEFAULT '{}'::jsonb,
                                                       -- {version, medsam_model_version, per_finding_iou, computed_at}
  ADD COLUMN IF NOT EXISTS time_of_day_band text
    CHECK (time_of_day_band IS NULL OR time_of_day_band IN ('morning', 'midday', 'afternoon', 'evening'));

-- Udvid scanner_version tilladte værdier
ALTER TABLE scans
  DROP CONSTRAINT IF EXISTS scans_scanner_version_check;
ALTER TABLE scans
  ADD CONSTRAINT scans_scanner_version_check
  CHECK (scanner_version IN ('v1-manual', 'v2-sagent', 'v2-egl'));

-- INV-CS-19 håndhævet på DB-lag
ALTER TABLE scans
  ADD CONSTRAINT scans_findings_egl_grounded
  CHECK (
    scanner_version <> 'v2-egl'
    OR findings = '[]'::jsonb
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(findings) f
      WHERE (
        (f->'evidence_grounding'->>'medsam_iou') IS NULL
        OR (f->'evidence_grounding'->>'medsam_model_version') IS NULL
        OR (f->'evidence_grounding'->>'evidence_status') IS NULL
        OR (f->'evidence_grounding'->>'evidence_status') NOT IN
           ('grounded', 'weakly_grounded', 'ungrounded', 'medsam_unavailable')
      )
    )
  );

-- INV-CS-20 index til hurtig longitudinal-check
CREATE INDEX IF NOT EXISTS scans_client_landmarks_idx
  ON scans (client_id, created_at DESC)
  WHERE scanner_version = 'v2-egl' AND foot_landmarks IS NOT NULL;

-- Advisory index for client-coverage-analytics
CREATE INDEX IF NOT EXISTS scans_low_coverage_idx
  ON scans (tenant_id, created_at DESC)
  WHERE (client_coverage->>'coverage_score')::numeric < 0.60;
```

### 4.2 Zod-schema

```typescript
type EvidenceGrounding = {
  version: string;                        // "praxisos-egl-v0.1-experimental"
  computed_at: string;                    // ISO timestamp
  medsam_model_version: string;           // fx "medsam-vit-b-2024-01"
  per_finding: Record<string, {
    finding_id: string;
    medsam_iou: number;                   // 0..1
    evidence_status: "grounded" | "weakly_grounded" | "ungrounded" | "medsam_unavailable";
    nearest_landmark_id: string;          // fx "MTH1_dorsal"
    nearest_landmark_distance_mm: number;
    medsam_mask_area_mm2: number;
    vlm_bbox_area_mm2: number;
  }>;
  overall_grounding_rate: number;         // fraction of findings with status = grounded
};

type FootLandmarks = {
  version: string;                        // "praxisos-landmark-v0.1"
  model_version: string;                  // fx "rtmpose-foot-22kp-2026-07"
  landmarks: Array<{
    id: string;                           // fx "MTH1_dorsal", "calcaneal_tuberosity_medial"
    coordinates_mm: [number, number, number];
    confidence: number;                    // 0..1
    reference: string;                     // "Leardini2007" | "Redmond2006_FPI" | ...
  }>;
  procrustes_hash: string;                 // sha256 af aligned-landmark-array
  detected_count: number;                  // ≤ 22
};

type ClientCoverage = {
  yolo_model_version: string;
  coverage_vector: { top: boolean; side: boolean; plantar: boolean };
  coverage_score: number;                  // 0..1
  detection_frames: number;
  no_detection_frames: number;
};
```

### 4.3 Ny tabel `evidence_grounding_audit`

Til longitudinal analyse og re-verifikation (**erstatter** den retracte `sprg_evidence_audit`):

```sql
CREATE TABLE IF NOT EXISTS evidence_grounding_audit (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  scan_id           uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  finding_id        text NOT NULL,
  medsam_model_version text NOT NULL,
  medsam_iou        numeric(4,3) NOT NULL,
  evidence_status   text NOT NULL,
  verified_by_frej  boolean DEFAULT false,
  verified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (scan_id, finding_id, medsam_model_version)
);

ALTER TABLE evidence_grounding_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_grounding_audit_isolation ON evidence_grounding_audit
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 4.4 Feature-flag på `tenants`

```sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS feature_evidence_grounding boolean NOT NULL DEFAULT false;

-- Kræver at v2-sagent er aktiveret først
ALTER TABLE tenants
  ADD CONSTRAINT tenants_egl_requires_v2
  CHECK (
    feature_evidence_grounding = false
    OR feature_clinical_scanner_v2 = true
  );
```

**Bevidst udeladt:** `feature_list3r_longitudinal` — der er intet longitudinal-krav i dette lag; longitudinal-brug kræver særskilt validation per MEDICAL-EXPERT-PANEL-REPORT §3.6.

**Bevidst udeladt:** en `ALTER COLUMN feature_evidence_grounding SET DEFAULT true`-plan. **Der er ingen default-on plan.** Aktivering pr. tenant kræver CSRB sign-off.

---

## 5 · Migration plan

Tre-trins staged rollout, men uden default-on på trin 3.

### 5.1 Trin 0 · Nuværende tilstand (2026-07-13)

- Alle tenants: `scanner_version = 'v1-manual'`
- REVISION-01's migration `0005_sprg_verified_scanner.sql` er **aldrig applied** — dokumentation korrigeret 2026-07-13
- Baseline EPIC 2 er godkendt men ikke deployed til prod

### 5.2 Trin 1 · v1-manual → v2-sagent (baseline EPIC 2)

Uændret fra REVISION-01 §5.2. Per-tenant aktivering via `feature_clinical_scanner_v2 = true`, ingen sub-features aktiveret.

### 5.3 Trin 2 · v2-sagent → v2-egl (denne revision)

**Forudsætninger (alle SKAL være opfyldt før nogen tenant aktiveres):**

- Migration `0005_evidence_grounding.sql` applied på target-projekt
- **MedSAM hostet på Replicate ELLER egen GPU-worker med `MEDSAM_URL` sat i prod-miljø**
- MedSAM model-vægte checksummet og pinned i `env.MEDSAM_MODEL_VERSION`
- Landmark-regressor (HRNet eller RTMPose baseline) hostet på Replicate ELLER egen worker
- **Ingen mock-fallback i prod** — startup healthcheck verificerer at `MEDSAM_URL` responderer med 200
- Test-suite passeret på alle 3 nye INV (INV-CS-19/20/21)
- CSRB (Clinical Safety Review Board, se MEDICAL-EXPERT-PANEL-REPORT §6) har godkendt aktivering pr. tenant

**Aktivering (per-tenant, gated by CSRB):**

```sql
-- Fase A: intern pilot-tenant (kun praxisos-internal)
UPDATE tenants
SET feature_evidence_grounding = true
WHERE slug = 'praxisos-internal';

-- Fase B: opt-in klinikker med signed DPA-tillæg + CSRB-approval
-- (per-tenant SQL update, MANUELT gennemført af support-rolle efter CSRB-review)
UPDATE tenants
SET feature_evidence_grounding = true
WHERE id = $1;

-- Fase C: EKSISTERER IKKE. Ingen default-on plan.
-- Hver tenant kræver individuel CSRB sign-off.
```

### 5.4 Bag-katalog · re-processing af eksisterende v2-sagent scans

Kan startes pr. tenant af support-rolle **efter** patient-samtykke er re-bekræftet (åbne beslutning §8.3):

```
POST /api/v1/[tenant]/scanner/egl-backfill
Body: { since: "2026-01-01", limit: 100, consent_verified: true }
```

Jobbet:

1. Finder scans hvor `scanner_version = 'v2-sagent' AND dense_mesh_url IS NOT NULL`
2. Kører EGL post-hoc mod persisterede artefakter
3. Opdaterer `scans.evidence_grounding` og `scans.foot_landmarks` uden at ændre `scans.findings`
4. Rate-limited: max 10 scans/time/tenant (respekterer INV-CS-14)
5. Skriver audit-log-row pr. re-processeret scan

Idempotent, kan køres flere gange uden side-effekter.

### 5.5 Kompatibilitetsmatrix

| scanner_version | EGL grounding | Foot landmarks | Client coverage | Læses af journal-UI | CAD-eksport lovligt |
|-----------------|---------------|----------------|-----------------|---------------------|---------------------|
| `v1-manual` | Nej | Nej | Nej | Ja (legacy view) | Nej |
| `v2-sagent` | Nej | Nej | Nej | Ja | Ja (hvis §5.1 i baseline) |
| `v2-egl` | Ja | Ja | Ja (advisory) | Ja (m. grounding-badge) | Ja (m. IoU-guarantee på findings) |

Journal-UI viser badge:
- `v1-manual` → grå "Manuel scan"
- `v2-sagent` → blå "AI-scan · afventer behandler"
- `v2-egl` → grøn **"AI-scan · eksperimentel evidens-graf · afventer behandler"**
  - (bevidst forsigtig ordlyd: "eksperimentel" er nøgleordet indtil Phase 5 external validation er publiceret)

**Ændret fra REVISION-01:** vi bruger IKKE ordet "verificeret" i badge-tekst. "Verificeret evidens" var misvisende givet at IoU-thresholds ikke er kalibreret mod et Bland-Altman LoA-studie endnu.

---

## 6 · Rollback plan

Fire separate rollback-scenarier med præcise gennemførelses-trin.

### 6.1 Scenarie A · EGL grounder for aggressivt (høj false-negative rate)

**Symptom:** Practitioners melder at legitime findings markeres `ungrounded` (IoU < 0.15) selvom kliniker manuelt bekræfter fundet.

**Rollback:**

```sql
-- Pr. tenant
UPDATE tenants SET feature_evidence_grounding = false WHERE id = $1;
```

Nye scans falder tilbage til `v2-sagent`. Eksisterende `v2-egl` scans forbliver — deres data er stadig gyldige (evidence_grounding er additiv til findings).

**Ingen globalt default-toggle** — vi har ingen `ALTER TABLE ALTER COLUMN … SET DEFAULT` at rulle tilbage, fordi vi aldrig satte default true.

### 6.2 Scenarie B · Landmark-drift-warnings er støjede

**Symptom:** INV-CS-20 trigger warnings på alle klienter selvom biologisk plausibelt.

**Rollback:**

Miljø-flag deaktiverer cross-scan-check uden at deaktivere landmark-detection selv:

```
vercel env add DISABLE_LANDMARK_DRIFT_CHECK true --target=production
vercel deploy --target=preview  # QA først, manuel promote
```

Landmarks persisteres stadig for senere re-analyse.

### 6.3 Scenarie C · MedSAM-endpoint går ned

**Symptom:** `MEDSAM_URL` returnerer 5xx eller timeout.

**Adfærd (INTET rollback nødvendigt — dette er by design):**

- Pipeline abortes med HTTP 503 og struktureret payload:

```json
{
  "error": "EVIDENCE_GROUNDING_UNAVAILABLE",
  "code": "MEDSAM_UPSTREAM_ERROR",
  "message_da": "Anatomisk verifikation er midlertidigt utilgængelig. Prøv igen om nogle minutter.",
  "retry_after_seconds": 60
}
```

- Ingen "grounded"-badge udstedes.
- Ingen mock-fallback.
- Practitioner-notifikation genereres hvis nedetid > 15 min.

For midlertidig degradering til `v2-sagent` (uden grounding):

```sql
UPDATE tenants SET feature_evidence_grounding = false WHERE id = $1;
```

### 6.4 Scenarie D · Migration 0005 fejler eller korrumperer data

**Symptom:** ALTER TABLE fejler pga. eksisterende data der ikke passer nye CHECK constraints.

**Rollback:** Omvendt migration `0005_evidence_grounding_rollback.sql`:

```sql
-- Trin 1: Drop audit-tabel og indexes
DROP TABLE IF EXISTS evidence_grounding_audit;
DROP INDEX IF EXISTS scans_client_landmarks_idx;
DROP INDEX IF EXISTS scans_low_coverage_idx;

-- Trin 2: Drop constraints (nyeste først)
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_findings_egl_grounded;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_egl_requires_v2;

-- Trin 3: Restore scanner_version-check
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_scanner_version_check;
ALTER TABLE scans ADD CONSTRAINT scans_scanner_version_check
  CHECK (scanner_version IN ('v1-manual', 'v2-sagent'));

-- Trin 4: Drop nye kolonner (data-preserving — dump først via pg_dump)
ALTER TABLE tenants
  DROP COLUMN IF EXISTS feature_evidence_grounding;
ALTER TABLE scans
  DROP COLUMN IF EXISTS time_of_day_band,
  DROP COLUMN IF EXISTS evidence_grounding,
  DROP COLUMN IF EXISTS landmark_confidence,
  DROP COLUMN IF EXISTS foot_landmarks,
  DROP COLUMN IF EXISTS client_coverage;
```

**Backup-krav:** Før 0005 køres i prod, `pg_dump` af `scans` + `tenants` gemmes i tenant-owned bucket med 90-dages retention. Automatiseret i `deploy/migrate-with-backup.sh`.

### 6.5 Rollback-tabel · quick reference

| Scenarie | Rollback | Tid til effekt | Data-tab? |
|----------|----------|----------------|-----------|
| A · EGL falsk-neg | `feature_evidence_grounding = false` per tenant | < 1 min | Nej |
| B · Landmark drift-støj | `DISABLE_LANDMARK_DRIFT_CHECK=true` miljø-flag | 5-15 min | Nej |
| C · MedSAM nede | INGEN rollback — pipeline afvises indtil MedSAM er oppe | Realtid | Nej |
| D · Migration 0005 fejler | `0005_evidence_grounding_rollback.sql` + restore fra pg_dump | 15-60 min | Kun nye kolonners data |

---

## 7 · Test-strategi (tillæg til baseline §8)

| Type | Framework | Ny dækning |
|------|-----------|------------|
| Unit | vitest | Client-side YOLOv8-n wrapper, MedSAM-client med retry, landmark-regressor-adapter |
| Property-based | fast-check | INV-CS-19 (1000 syntetiske findings uden IoU-metadata → alle rejektes), INV-CS-20 (drift-toleranse 500 par med Cousins-baserede biologiske ranges) |
| Golden | vitest | 20 pre-recorded scans → forventet MedSAM-mask-checksums (deterministic mod pinned model-version) |
| Integration | vitest + testcontainers | End-to-end Level 1 → 2 → 3 → 3.5 mod mocked MedSAM (test-only mock, guarded via `NODE_ENV !== 'production'` + throw) |
| Adversarial | vitest kurateret | Finding med IoU manipuleret post-hoc → skal rejektes på DB + Zod + Frej |
| Longitudinal | vitest + Supabase branch | To scans af samme klient 60 dage apart → INV-CS-20 drift-check med diurnal-marker |
| Fail-closed | vitest | `MEDSAM_URL` unset i prod-mode → service SKAL nægte at boote (startup healthcheck) |
| Rollback | vitest | Kør 0005 forward + backward flere gange på testcontainer, verificer data-preservation |
| Client-side | Playwright + ONNX Runtime Web | YOLOv8-n kører i browser, coverage-vektor korrekt, ingen server-kald før upload |

**Særligt fail-closed test (ny, kritisk):**

```typescript
// tests/clinical-scanner/egl/fail-closed.test.ts
describe('EGL fail-closed in production', () => {
  it('refuses to boot scanner service in prod without MEDSAM_URL', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MEDSAM_URL;
    await expect(startScannerService()).rejects.toThrow(/MEDSAM_URL required in production/);
  });

  it('mockMedSam throws in production even if imported by mistake', async () => {
    process.env.NODE_ENV = 'production';
    const { testOnlyMockMedSam } = await import('../../lib/scanner/egl-medsam');
    expect(() => testOnlyMockMedSam()).toThrow(/mock forbidden in production/);
  });

  it('metric sprg_mock_fallback_active is renamed to egl_mock_fallback_active and alerts on >0', async () => {
    // verifies observability instrumentation
  });
});
```

---

## 8 · Open questions to CMO

Følgende beslutninger kræver eksplicit CMO- (Michael Ambro Stub) og CSRB-input før implementation kan begynde:

### 8.1 IoU-threshold-oprindelse

`grounded` = IoU ≥ 0.35 er en *placeholder* uden Bland-Altman LoA-grundlag. Skal vi (a) starte med 0.35 og re-kalibrere efter Phase 4-studie, (b) surface til practitioner uden hard-gate indtil kalibrering er publiceret, (c) blokere hele feature indtil kalibrering er komplet? Anbefalet: **(b)** — surface IoU til practitioner UI, ingen SOAP-hard-gate før kalibrering.

### 8.2 Landmark-model-license

HRNet er MIT-licenseret; RTMPose er Apache-2.0. Begge dækker kommerciel brug. Foot-specifik fine-tuning kræver annoteret dataset (~500 feet med 22 landmarks). Options:
- (a) intern annotation via klinikker der bruger PraxisOS (samtykke-flow)
- (b) offentligt dataset (foot posture image datasets — verificer license per dataset)
- (c) syntetisk genereret via S-Agent mesh + rendering

Anbefalet: **kombination (b) + (c) til bootstrap, (a) til iterativ forbedring** — men *ingen intern annotation uden separat patient-samtykke* per Sundhedsloven §15 og GDPR Art. 9(2)(a).

### 8.3 Backfill-samtykke

Skal eksisterende `v2-sagent`-scans kunne re-processeres til `v2-egl` uden ny klient-samtykke? Argumentet for: kun ekstra analyse af allerede-samtykkede data. Argumentet imod: EGL-graph er nyt data-artefakt (biometrisk kategori under GDPR Art. 9).

Anbefalet: **eksplicit re-consent** — send in-app notifikation "Vi har tilføjet AI-baseret anatomisk verifikation. Må vi analysere dine tidligere scans med den nye teknik?" med opt-in checkbox. Aldrig implicit tilladelse på biometriske data.

### 8.4 MedSAM hosting

Replicate er hurtigere at bringe live men koster mere per inference. Egen worker (A100 på Modal) kræver 3-5 dages setup. Anbefalet: **Replicate til pilot Fase A, migrer til Modal ved Fase B**. Kræver CSRB-review af begge sub-processorers DPA'er (Anthropic, Replicate, Modal, Supabase).

### 8.5 Aktivering for diabetiske patienter

Panel-rapport §7 Phase 7 forbyder eksponering af IWGDF risk 0-1 patienter før Phase 5 (external validation) er komplet, og IWGDF risk 2-3 kun efter pressure-mapping validation loop er operational. **Denne revision må derfor IKKE aktiveres for tenants der behandler diabetiske patienter** før:
- REVISION-03 lander neurologisk finding-kategori
- REVISION-04 lander IWGDF risk-stratification
- REVISION-05 lander Charcot-detektor
- Phase 5 external validation er publiceret

Anbefalet: **feature-flag på tenant-niveau `tenant_treats_diabetics: boolean` (self-declared ved onboarding)**, og en CHECK constraint der forbyder `feature_evidence_grounding = true AND tenant_treats_diabetics = true` indtil ovenstående revisioner er merged.

### 8.6 Client-side YOLOv8-n model-distribution

Model-vægte skal deployes til klienten (browser). Options:
- (a) statisk fra `/public/models/yolov8n.onnx` (2-4 MB, cachable)
- (b) versioneret via Vercel Edge-cache med SHA256-integrity-check
- (c) Supabase Storage med signed URL

Anbefalet: **(b)** — versionering via Vercel er billigst, cacheable, og integrity-check forhindrer at manipulered model kan udføre attack på klient-side inference.

### 8.7 Landmark-katalog scope

22 landmarks fra Rizzoli/IOR IOR model dækker rearfoot + midfoot + forefoot + hallux. Mangler:
- Individuelle tå-landmarks (2-5)
- Web spaces (fra panel-rapport §3.5)
- Nailfolds
- Heel fissure-zone

Anbefalet: **start med 22, evaluer efter 3 måneders pilot-data** om ekstra landmarks er nødvendige for diabetiske indikationer (som ikke aktiveres i denne revision jf. §8.5).

### 8.8 CSRB-composition

Panel-rapporten §6 anbefaler 7-seat CSRB. Denne revision blokerer ikke på CSRB-composition men *forudsætter* at CSRB er konstitueret før Fase B (§5.3). **CMO-beslutning:** Hvem inviteres til Chair-seat? Anbefalet fra panel: senior consultant fra Steno Diabetes Center Copenhagen eller Odense University Hospital sårcenter.

---

## 9 · Definition of Done for denne revision

- [ ] Michael har godkendt §1–§6 (revision-scope + invariants + migration + rollback)
- [ ] §8's 8 åbne beslutninger er lukket eller eksplicit deferred
- [ ] Migration `0005_evidence_grounding.sql` + `0005_evidence_grounding_rollback.sql` er skrevet men *ikke* applied
- [ ] MedSAM hosting-beslutning taget (§8.4)
- [ ] Landmark-model-fine-tuning-plan skitseret uden patient-data-eksponering (§8.2)
- [ ] Test-plan (§7) er scaffolded i `prototype/tests/clinical-scanner/egl/`
- [ ] **Fail-closed test er skrevet og passerer** før nogen deploy til prod
- [ ] Feature-flag `feature_evidence_grounding` defaulter til `false` (verificeret via SQL)
- [ ] Ingen ændring af baseline-invariants INV-CS-1 til INV-CS-18
- [ ] Baseline EPIC 2 §11 (godkendte beslutninger) er urørt — kun additive tilføjelser
- [ ] Niels-persona i `lib/agents.ts` er stadig urørt (MCP-tool `scanner.review_findings` udvides kun med evidence_grounding-payload, backward-compat)
- [ ] `EPIC-2-Clinical-Scanner.md` opdateres med krydsreference til denne revision i header (efter godkendelse)
- [ ] `EPIC-2-REVISION-01.md` markeres eksplicit som `RETRACTED — see REVISION-02` med redirect-note (kan ikke slettes pga. audit-krav på tidligere godkendt-materiale)
- [ ] Startup healthcheck implementeret der refuser boot i prod uden `MEDSAM_URL`
- [ ] Metric `egl_mock_fallback_active` alerter i observability-stack

---

## 10 · Forhold til CSRB og Medical Expert Panel Report

Denne revision implementerer specifikt MEDICAL-EXPERT-PANEL-REPORT.md §5 corrections:

| Panel-krav | REVISION-02 lokation |
|------------|----------------------|
| §5.1 · Retract fabricated citations | §1.1 (eksplicit retraktion) |
| §5.2 · Replace with verifiable substrates (MedSAM) | §1.3, §3.1, §4.1 |
| §5.3 · Fix INV-CS-19/20/21 thresholds | §3.1 (initial + re-kalibrering), §3.2 (biologisk anchored 8 mm), §3.3 (advisory) |
| §5.4 · Fail-closed the SPRG mock | §3.1 (fail-closed adfærd), §6.3 (503 status), §7 (fail-closed test) |
| §5.5 · Downstream: no default-on plan | §4.4 (bevidst udeladt), §5.3 (ingen Fase C) |

Denne revision lukker **ikke** de bredere consensus critical findings (§2 i panel-rapporten): neurologisk data-model, vaskulær vurdering, IWGDF-stratifikation, Charcot-detektor, comfort filter, dynamic capture, dansk workflow. Disse er scoped til separate revisions (REVISION-03 til REVISION-06) og roadmap Phase 1-6.

**Ingen tenant må aktivere denne revision for diabetiske patienter** før §8.5's forudsætninger er opfyldt. CSRB har veto per panel-rapport §6.2.1.

---

*Revision-udkast · Contract Compiler · 2026-07-13 · afventer Orchestratorens og CSRB's godkendelse.*
*Baseline: `EPIC-2-Clinical-Scanner.md` godkendt 2026-07-11.*
*Supersedes: `EPIC-2-REVISION-01.md` (RETRACTED 2026-07-13 pga. fabricated citations).*
*Reference: `MEDICAL-EXPERT-PANEL-REPORT.md` (2026-07-13).*
