# AlphaXiv top-3 spikes · Del Pilar Nexus

**Status:** research ranking — shadow-only  
**Kilde:** `docs/alphaxiv-del-pilar-nexus-sota-prompt.md`  
**Governance:** `docs/vision/model-governance.md`, `acceptance-criteria.md`, `model-registry.md`  
**Dato:** 2026-08-26

---

## Binding disclaimer — ingen active routing

**Ingen af disse spikes autoriserer active routing.**

De må **ikke** promote modeller (`shadow` → `canary`/`active`), ændre
produktions-pins (`foot-segmentation-ehn9q/1`, `foot-ulcer/1`,
`wounds-detection/1`, `firtoz/trellis`), ændre `SCAN_QUALITY_THRESHOLD` (70),
enable pathology-outputs, ændre patientvendt sprog, eller merge/deploy uden
navngiven Broser-godkendelse + model card + audit-event.

Pathology/candidates forbliver **shadow**, indtil kliniker-adjudicerede gates
er bestået (`acceptance-criteria.md` §C). AI = suggestions only;
kandidatsprog: *«Kandidatområde registreret; kræver kliniker-review.»*

`nail_materials` må dele viewer/rendering — ikke findings, confidence, quality
gates, audit eller klinisk prioritering. Agenter må **ikke** promote til active.

---

## Ranked table

| Rank | Codename | Track | Impact | Feasibility | MDR risk | Priority | Spike (shadow) |
|------|----------|-------|--------|-------------|----------|----------|----------------|
| 1 | **CaptureGate-Σ** | mdr_safety + foot_scanner | 8 | 9 | 1 | **72.0** | Uncertainty-aware quality signals → shadow score card |
| 2 | **TriView-Lift** | foot_scanner | 8 | 8 | 1 | **64.0** | Multi-view phone ritual + InstantMesh A/B vs TRELLIS |
| 3 | **MetricAnchor** | foot_scanner | 9 | 7 | 2 | **31.5** | Metric scale uden checkerboard (Depth Anything V2 + reference) |

Formel: `Priority = (Impact × Feasibility) / MDR_risk`  
Tie-break (ikke nødvendig her): time-to-demo → data burden → reversibility.

---

## 1. CaptureGate-Σ — Uncertainty-aware quality gate

| Felt | Værdi |
|------|-------|
| **Impact** | 8 |
| **Feasibility** | 9 |
| **MDR_risk** | 1 |
| **Priority** | **72.0** |
| **MDR posture** | `class_0` (capture/ops — ikke diagnose) |

### Rationale

Nuværende quality gate (`scoreScanQuality`, threshold 70) er regelbaseret
(mesh remote, foot detected, resolution, providers, findings-conf). Den mangler
eksplicit usikkerhed om *capture-egnethed* (blur, belysning, beskæring,
hudtone/neglelak-slices). Stretch-temaet «uncertainty-aware quality gate» er
den hurtigste SOTA-differentiering med lavest MDR: den forbedrer workflow og
fail-closed uden at røre kliniske findings.

### Evidence notes

- Shaw et al., *A Decoupled Uncertainty Model for MRI Segmentation Quality
  Estimation*, arXiv:[2109.02413](https://arxiv.org/abs/2109.02413) — task-
  specifik usikkerhed som proxy for «algorithmic quality»; **evaluering er MRI**,
  ikke phone-fod. Overfør idé (usikkerhed → QC), ikke vægte.
- Relateret: *Estimating MRI Image Quality via Image Reconstruction Uncertainty*,
  arXiv:[2106.10992](https://arxiv.org/abs/2106.10992).
- **Begrænsning:** papirerne er ikke fodpleje/phone-capture; metrik skal
  re-valideres på egne fixtures. Aldrig «clinical-grade» ud fra papir alene.
- **Repo-kontekst:** `docs/vision/acceptance-criteria.md` §A; slices for skin
  tone / nail polish / lighting nævnt i §C og SOTA-prompt track E.

### Suggested next experiment (shadow-only)

1. **Input:** eksisterende scan-fixtures + 20–40 de-identificerede clinic
   photos (privacy-gate først).
2. **Output:** shadow JSON `{ blur_proxy, exposure_proxy, crop_foot_ratio,
   slice_tags[], uncertainty_band: low|med|high }` — **logges**, driver ikke
   PASS/HOLD.
3. **Baseline:** nuværende `scoreScanQuality` uden uncertainty fields.
4. **Success:** usikkerheds-band korrelerer med kliniker «optag igen»-label
   (κ ≥ 0.4 på lille set); ingen ændring af threshold 70.
5. **Rollback:** feature-flag OFF; slet shadow logger.

### Explicitly OUT of scope

- Ændring af `SCAN_QUALITY_THRESHOLD` eller PASS-definition i produktion  
- Autonom triage / «scan rejected → patient risk»  
- Diagnose- eller behandlingsforslag baseret på usikkerhed  
- Active routing af nye modeller  

---

## 2. TriView-Lift — Multi-view ritual + InstantMesh shadow A/B

| Felt | Værdi |
|------|-------|
| **Impact** | 8 |
| **Feasibility** | 8 |
| **MDR_risk** | 1 |
| **Priority** | **64.0** |
| **MDR posture** | `class_0` / geometry shadow |

### Rationale

Live 3D er `firtoz/trellis` (single-shot → remote GLB). Multi-view phone ritual
+ feed-forward mesh (InstantMesh-familien) er det klareste «vanvittigt men
byggbart» spring på track A: bedre topologi/overflade til demo og senere
ortose-eksport — uden diagnose. Kan starte som weekend/Hetzner-GPU A/B i
shadow ved siden af TRELLIS.

### Evidence notes

- Xu et al., *InstantMesh: Efficient 3D Mesh Generation from a Single Image
  with Sparse-view Large Reconstruction Models*,
  arXiv:[2404.07191](https://arxiv.org/abs/2404.07191) — feed-forward
  multi-view diffusion + sparse LRM; ~10 s mesh; **generiske 3D-assets**, ikke
  kliniske fødder; metric scale ikke garanteret.
- Stack i dag: Replicate `firtoz/trellis` for PASS (`model-registry.md`).
- **Failure modes i dansk klinik:** blanke fliser, spejlende neglelak, stærk
  overhead-lys, delvis fod uden for frame, hand/shoe clutter.

### Suggested next experiment (shadow-only)

1. **Input contract:** 3 phone frames (medial / plantar / lateral) + existing
   foot-seg mask; samme session-ID.
2. **Output contract:** shadow artifact
   `{ trellis_glb_url, instantmesh_glb_url?, hausdorff_proxy?, latency_ms,
     winner_shadow_only }` — UI viser stadig kun production TRELLIS path.
3. **Baseline:** single-shot TRELLIS latency + visual mesh completeness checklist.
4. **Compute:** 1× Hetzner GPU job eller Replicate-compatible InstantMesh
   endpoint; budget ≤ få minutter pr. session.
5. **Success:** ≥70 % af sessions: kliniker foretrækker TriView mesh *eller*
   målt lavere huller/self-intersect (scripted mesh checks); TRELLIS forbliver
   live pin.
6. **Rollback:** stop shadow job; ingen env-swap af `REPLICATE_MESH_MODEL`.

### Explicitly OUT of scope

- Erstatte `firtoz/trellis` i produktion  
- CE/MDR-påstande om «anatomisk korrekt» mesh  
- Orthotic print til patient uden menneskelig CAD-review  
- nail_materials SSS som driver for klinisk mesh-kvalitet  

---

## 3. MetricAnchor — Metric scale uden checkerboard

| Felt | Værdi |
|------|-------|
| **Impact** | 9 |
| **Feasibility** | 7 |
| **MDR_risk** | 2 |
| **Priority** | **31.5** |
| **MDR posture** | `shadow` (anatomisk/geometrisk mål — ikke diagnose) |

### Rationale

MonoMSK leverer arch strain / torsion / pronation-proxy fra synthesised
landmarks — uden metric scale er mm/N·m-fortolkning svag. Stretch-temaet
«metric scale without checkerboard» er den største måle-fidelity-gevinst inden
for tilladte capabilities (anatomical/geometric measurement). MDR 2 fordi
mål kan misforstås klinisk — derfor kun shadow + tydelig «proxy / ikke
force-plate»-copy.

### Evidence notes

- Yang et al., *Depth Anything V2*, arXiv:[2406.09414](https://arxiv.org/abs/2406.09414)
  (+ metric fine-tunes Hypersim/VKITTI på GitHub) — stærk monocular depth;
  **indoor metric fine-tune ≠ fodklinik**; scale drift forventes uden
  scene-reference.
- Pose/scale-litteratur (fx category-level RGB metric recovery,
  arXiv:[2309.10255](https://arxiv.org/abs/2309.10255)) viser at scale ofte
  de-kobles fra pose — relevant designmønster, ikke drop-in for fod.
- Plantar-pressure surrogater (PressNet arXiv:[2001.00657](https://arxiv.org/abs/2001.00657),
  MMVP CVPR 2024) er **bevidst ikke** denne spike (højere MDR / data-byrde).
- **Repo:** MonoMSK = kinematic proxy (`acceptance-criteria.md` §E) — må aldrig
  mærkes «clinical-grade».

### Suggested next experiment (shadow-only)

1. **Input:** plantar RGB + foot-seg mask + **known reference** i frame
   (A4-kort / klinikkens standard lineal / mål-tape) — ikke checkerboard-krav.
2. **Output:** shadow
   `{ foot_length_mm_est, scale_mm_per_px, depth_model_id, reference_type,
     confidence }` skrevet til audit/log — **ikke** journal-SOAP som fakta.
3. **Baseline:** pixel-only MonoMSK uden mm; optional manual caliper på 15 fødder.
4. **Success:** median |est − caliper| ≤ 8 mm på ≥15 adjudicerede scans;
   dokumentér skin-tone / lighting slices.
5. **Rollback:** disable metric branch; MonoMSK uændret i UI.

### Explicitly OUT of scope

- Patient-specifikke behandlingsråd ud fra mm-mål  
- Erstatte force-plate / trykmåtte-claims  
- RGB→plantar-pressure som «diagnostisk load»  
- Automatisk ændring af MonoMSK kritiske flags i produktion  

---

## Metode note — hvordan scores er sat

1. **Formel** fra SOTA-prompt:  
   `Priority = (Impact 1–10 × Feasibility 1–10) / MDR_risk 1–5`.
2. **Impact / Feasibility** er skøn baseret på:
   - promptens actionability bar (kontrakt, baseline, ≤90 dage, eksisterende stack);
   - repo-kontekst (quality gate, TRELLIS pin, MonoMSK proxy, shadow workflow
     allerede registreret med `approved_for_active_routing: false`);
   - stretch-temaer der dækker mdr_safety + foot_scanner først.
3. **MDR_risk** følger prompt-skalaen: 1 = ops/non-klinisk; 2 =
   geometri/måling der kan misforstås; 3+ = kandidat-pathology / CE-tungt.
   Pathology-VLM-spikes scorer lavere på priority pga. højere MDR og er derfor
   **ikke** i top-3 (bevidst).
4. **Evidence:** WebSearch brugt til at verificere reelle arXiv-ID’er
   (InstantMesh 2404.07191, Depth Anything V2 2406.09414, MedSAM 2304.12306
   som baggrund for VLM-track — ikke valgt som top-3 pga. MDR).  
   **Ingen opfundne DOI’er.** Fuld AlphaXiv paper-pack / deep-dive top-5 er
   *ikke* kørt end-to-end i dette miljø; ranking er prompt-kriterier +
   repo + stikprøve af verificerede papers. Forvent re-score når LUNA/alphaXiv
   harvest leverer bredere paper pack.
5. **Separation:** ingen spike rører nail_materials clinical path; agent
   governance uændret.

---

## Anti-anbefalinger (kort)

| Skip nu | Hvorfor |
|---------|---------|
| Autonom triage / risk score | Bryder klinisk grænse; MDR 5 |
| Træne foundation lesion-model fra scratch | Fejler 90-dages / actionability bar |
| Force-plate hardware som first spike | Specialist hardware; phone-first constraint |

---

## Relaterede filer

- `docs/vision/alphaxiv-aurelle-transcript-impact.md` — bredere transcript-impact + anti-recs
- `docs/alphaxiv-del-pilar-nexus-sota-prompt.md`
- `docs/vision/model-governance.md`
- `docs/vision/acceptance-criteria.md`
- `docs/vision/model-registry.md`
- `docs/vision/workflows/del-pilar-nexus-shadow-evaluation.json`
