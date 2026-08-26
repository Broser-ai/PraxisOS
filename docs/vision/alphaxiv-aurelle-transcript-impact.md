# AlphaXiv / Aurelle-transcript · impact på PraxisOS

**Status:** research memo — ingen active routing  
**Dato:** 2026-08-26  
**Branch-kontekst:** `cursor/integrate-all-superb-2c11` (+ dette memo)  
**Kilder (destilleret, ikke gen-pastet):** Aurelle/Alphaxiv-chat ·
`lib/alphaxiv/chat-claims.ts` · `lib/alphaxiv/catalog.ts` ·
`docs/alphaxiv-del-pilar-nexus-sota-prompt.md` ·
`docs/vision/alphaxiv-top3-spikes.md`  
**Governance:** `model-governance.md`, `acceptance-criteria.md`,
`privacy-gate.md`, `promotion/`  

**Formel:** `Priority = (Impact × Feasibility) / MDR_risk`  
**Binding:** AI = suggestions only. Pathology/candidates = shadow indtil
kliniker-adjudicerede gates. Agenter må research/draft — **ikke** merge,
deploy, ændre thresholds, model-pins, retention eller patientvendt sprog.

---

## A. Executive verdict

Transkriptet er en **idé-mine**, ikke en implementeringsplan. Meget af
«færdig kode / overnight God-Mode / NINA clinical oracle» er fantasy eller
overclaim. Det, der faktisk løfter PraxisOS nu, er det, der **låser op for
allerede bygget shadow-infrastruktur** og det, der forbedrer capture/mesh
uden at røre diagnose.

### Nu (14 dage) — top 5

| # | Codename | Priority | Hvorfor |
|---|----------|----------|---------|
| 1 | **PrivacyUnlock-Σ** | **81.0** | Åbner shadow parallel inference (allerede kodet) |
| 2 | **CaptureGate-Σ** | **72.0** | Lavest MDR, direkte værdi for klinik-workflow |
| 3 | **ShadowFlywheel** | **72.0** | Roboflow seg/candidates → audit → adjudication |
| 4 | **TriView-Lift** | **64.0** | Mesh-kvalitet uden at røre live TRELLIS-pin |
| 5 | **Harness-HumanGate** | **63.0** | Styrk LUNA→draft; **behold** NO_AUTO_MERGE |

### Senere

- **RLVR-QuizPack** / Adaptive Tutor (class_0 e-learning) — efter quiz-kontrakt
- **MetricAnchor** + landmarks-træning — efter privacy + adjudiceret set
- **S-Agent tool-hierarchy** som *mønster* over eksisterende tools (ikke paper-drop-in)
- Atelier neural nail / SSS — separat fra MDR-klinik
- CAD/STL ortose-eksport — først efter metric + menneskelig CAD-review

### Aldrig (som beskrevet i transkriptet)

- Overnight daemon der **merger til main / deployer**
- Autonom diagnose-VLM / «live AR teacher» der triagerer
- MonoMSK MPa/N·m som **klinisk ground truth**
- Offentlig Roboflow Universe til Art. 9-billeder
- Nail SSS som klinisk prioritet / findings-driver

> Dette memo **udvider** `alphaxiv-top3-spikes.md` (CaptureGate / TriView /
> MetricAnchor) med transcript-temaerne ops, e-learning, swarm og anti-fantasy
> — uden at erstatte top-3 spikes.

---

## B. Ranked improvement table

| Rank | Codename | Source theme | Status in PraxisOS | Impact | Feasibility | MDR | Priority | First spike | Owner |
|------|----------|--------------|--------------------|--------|-------------|-----|----------|-------------|-------|
| 1 | PrivacyUnlock-Σ | Privacy / DPA / Art.9 | Kode live (fail-closed); gate **closed** | 9 | 9 | 1 | **81.0** | Fuldfør Broser DPA-pakke + env | Broser |
| 2 | CaptureGate-Σ | Uncertainty QC | Quality gate regelbaseret; uncertainty **mangler** | 8 | 9 | 1 | **72.0** | Shadow blur/exposure/crop JSON | Broser + agent draft |
| 3 | ShadowFlywheel | Roboflow multi-model | Shadow seg/candidates kodet; flag OFF | 8 | 9 | 1 | **72.0** | Enable eval-host + audit review | Broser |
| 4 | TriView-Lift | 2D→3D / InstantMesh | Live = single-shot TRELLIS | 8 | 8 | 1 | **64.0** | 3-frame ritual + InstantMesh A/B shadow | Broser |
| 5 | Harness-HumanGate | Meta-harness / worktrees | Delvist: `lib/swarm/*` + NO_AUTO_* | 7 | 9 | 1 | **63.0** | LUNA harvest → ranked spike → PR draft only | Broser |
| 6 | RLVR-QuizPack | Lite PPO / ProRL / e-learn | Catalog + claims; **ingen** `lib/learning` | 7 | 8 | 1 | **56.0** | 20 verifiable anatomi-quiz items | Broser |
| 7 | AdaptiveTutor-0 | Reflexion / RAG tutor | Ikke startet (kun research track) | 6 | 7 | 1 | **42.0** | Non-diagnostic RAG over egne docs | Senere |
| 8 | MetricAnchor | Metric scale / MonoMSK | Proxy solver live; ingen mm-kalibrering | 9 | 7 | 2 | **31.5** | A4/lineal reference → mm shadow | Broser |
| 9 | LandmarksTrain | Landmarks / YOLO-World | `praxisos` **disabled** / untrained | 8 | 6 | 2 | **24.0** | Annotation atlas + privacy-gated set | Broser |
| 10 | NailAtelier-SSS | Neural nail / Gaussian | Specialist-stub; shader fallback | 4 | 5 | 1 | **20.0** | Atelier-only viewer track | Del Pilar Atelier |
| 11 | SpatialPlanner-Σ | S-Agent paper tool-use | Navn genbrugt til scan-pipeline; paper ≠ kode | 7 | 5 | 2 | **17.5** | Shadow planner der kalder eksisterende tools | Research |
| 12 | OrthoSTL-Export | CAD/STL ortose | Ikke startet | 8 | 4 | 3 | **10.7** | Watertight mesh → human CAD | Senere |
| 13 | MonoMSK-PaperPort | 4D gait / MonoMSK paper | Hooke-proxy ≠ paper pipeline | 6 | 3 | 4 | **4.5** | Research-only; aldrig «clinical GT» | Research |
| — | AutoMergeDaemon | Overnight self-merge | **Eksplicit forbudt** i invariants | 2 | 9 | 5 | **3.6** | — | **ANTI** |
| — | DiagnoseVLM-AR | Medical VLM live teacher | Pathology = candidate shadow | 5 | 4 | 5 | **4.0** | — | **ANTI** |

---

## C. Deep dives (top 8)

### 1. PrivacyUnlock-Σ — åbn det I allerede har bygget

**Byg:** Intet nyt produkt-API. Fuldfør
`docs/vision/privacy-gate-broser-checklist.md`: privat projekt, EU-route, DPA,
residens, retention, navngiven Broser-approver, audit-event-id. Sæt env på
**eval-host** (ikke blindt alle hosts).

**Byg ikke:** Midlertidig «skip gate for demo»; agent-self-approval;
upload til public Universe.

**Contracts/flags:** `lib/scanner/privacy-gate.ts` ·
`maySendImagesToCustomRoboflow` · `PRAXIS_VISION_*` env ·
`PRAXIS_SHADOW_EVAL_ENABLED` (stadig separat).

**Klinisk grænse:** Gate er ops/GDPR — ikke diagnose. Art. 9-billeder forbliver
i godkendt processor-route.

**Plug-in:** Uden denne er `shadow-inference.ts` permanent skippet. Med den
kan ShadowFlywheel køre uden at ændre Universe-pins eller threshold 70.

---

### 2. CaptureGate-Σ — uncertainty-aware quality (fra top-3)

**Byg:** Shadow score-card `{ blur_proxy, exposure_proxy, crop_foot_ratio,
slice_tags[], uncertainty_band }` logget ved siden af `scoreScanQuality`.

**Byg ikke:** Ændring af `SCAN_QUALITY_THRESHOLD`; autonom «reject → patient
risk»; diagnose ud fra usikkerhed.

**Contracts/flags:** Feature-flag til shadow logger; output må **ikke** drive
PASS/HOLD før Broser-godkendelse.

**Klinisk grænse:** class_0 capture/ops.

**Plug-in:** `lib/scanner/quality.ts` baseline; shadow log via samme audit-kanal
som `vision.shadow.*`. Se detaljer i `alphaxiv-top3-spikes.md` §1.

---

### 3. ShadowFlywheel — Roboflow multi-model (det realistiske fra «YOLO-World-stack»)

**Byg:** Med PrivacyUnlock: `PRAXIS_SHADOW_EVAL_ENABLED=true` på eval-host;
review `vision.shadow.completed` records; start kliniker-adjudikation på
candidate-bokse (acceptance §C). Aktiv læringskø i **privat** Roboflow efter
DPA.

**Byg ikke:** YOLO-World som live primary; landmarks i parallel infer før
træning; promote `approved_for_active_routing`; public dataset dump.

**Contracts/flags:** `contracts/roboflow-*.schema.ts` ·
`del-pilar-nexus-shadow-evaluation.json` ·
`listShadowParallelInferenceEndpoints()` (landmarks omitted).

**Klinisk grænse:** Kandidatsprog:
*«Kandidatområde registreret; kræver kliniker-review.»*

**Plug-in:** Fire-and-forget fra `AlphaSpatiotemporalPipeline.executeAlphaScan`
→ `scheduleShadowEval` — allerede wired.

---

### 4. TriView-Lift — multi-view + InstantMesh shadow A/B

**Byg:** 3 phone frames (medial/plantar/lateral) + shadow InstantMesh vs live
TRELLIS; UI viser stadig production mesh.

**Byg ikke:** Erstat `firtoz/trellis`; CE-claim «anatomisk korrekt»; ortose-print
uden CAD-review; nail SSS som mesh-driver.

**Contracts/flags:** Shadow artifact schema; `REPLICATE_MESH_MODEL` uændret.

**Klinisk grænse:** Geometry demo / ops — ikke diagnose.

**Plug-in:** Ved siden af Level 3 i `alpha-pipeline.ts` (Replicate TRELLIS).
Se `alphaxiv-top3-spikes.md` §2.

---

### 5. Harness-HumanGate — Meta-Engineering uden «Living Organism auto-merge»

**Byg:** Skærp agenda: LUNA (`runResearchHarvest`) → ranked spike note →
FELIX/ATLAS **draft** i worktree → FREJ gate → **menneskelig**
`humanApproveTask`. Dokumentér at daemon ticks er research/improve/audit — ikke
deploy.

**Byg ikke:** Fjernelse af `NO_AUTO_MERGE` / `NO_AUTO_DEPLOY`; «God-Mode
auto-accept»; NINA som klinisk oracle; overnight merge til `main`.

**Contracts/flags:** `SWARM_INVARIANTS` · `PRAXIS_SWARM_ENABLED` ·
`SWARM_APPROVE_TOKEN` · branch prefix `cursor/swarm-*-2c11`.

**Klinisk grænse:** S-agents = software; H-bridge = clinic ops — ingen threshold-
eller model-promotion.

**Plug-in:** `lib/swarm/meta-harness.ts`, `daemon.ts`, `worktree-manager.ts`,
`s-agents.ts` (LUNA → Alphaxiv).

---

### 6. RLVR-QuizPack — ProRL / Lite PPO *idé*, ikke træning endnu

**Litteratur (verificeret):** ProRL arXiv:[2505.24864](https://arxiv.org/abs/2505.24864)
(prolonged RLVR); Lite PPO i *Tricks or Traps* arXiv:[2508.08221](https://arxiv.org/abs/2508.08221)
(minimalist critic-free PPO-tricks). Clip-Higher er en DAPO-trick i samme
familie — **ikke** en PraxisOS-modul.

**Byg:** Verifiable-reward quiz items (anatomi/farmakologi/procedure) med
eksakt scoring; class_0 education; ingen patient-diagnose-coaching.

**Byg ikke:** Finetune af klinik-LLM med ProRL/Lite PPO før quiz-dataset og
evals; «RL powered diagnostic tutor».

**Contracts/flags:** Nyt `lib/learning/*` (findes ikke i dag); track
`rl_elearning` i catalog.

**Klinisk grænse:** Uddannelse ≠ device software claim.

**Plug-in:** LUNA harvest actions peger allerede på quiz-design
(`lib/alphaxiv/bridge.ts`).

---

### 7. AdaptiveTutor-0 — Reflexion / RAG (senere, stadig nyttig)

**Byg:** RAG over Broser-godkendte PraxisOS-docs + quiz feedback loop
(«reflexion» som self-critique på **forkerte quiz-svar** — ikke klinisk
journal-auto).

**Byg ikke:** Tutor der foreslår behandling ud fra kundens fodfoto; live AR
«teacher» over lesioner.

**Contracts/flags:** Separat feature-flag; ingen kobling til scan findings.

**Klinisk grænse:** class_0.

**Plug-in:** Efter RLVR-QuizPack; kan bruge H-bridge personas til *rolleleg*
uden diagnose-API.

---

### 8. MetricAnchor (+ LandmarksTrain som forudsætning)

**Byg:** Metric scale med scene-reference (A4/lineal) → `foot_length_mm_est`
shadow; landmarks-træning iht. `landmarks-training-brief.md`.

**Byg ikke:** Mærke MonoMSK-output som force-plate; opfinde usynlige keypoints;
auto-ændre `isCritical` flags i UI-copy til «klinisk fakta».

**Contracts/flags:** `contracts/roboflow-keypoints.schema.ts` ·
`SHADOW_LANDMARKS_DEPLOYABLE === false` indtil promotion pack.

**Klinisk grænse:** Anatomisk/geometrisk måling (MDR 2) — suggestions /
proxy-copy.

**Plug-in:** `MonoMSKSolver` i `lib/physics/mono-msk-tensor.ts` forbliver
**kinematic proxy**; paper MonoMSK (arXiv:[2511.19326](https://arxiv.org/abs/2511.19326))
er fuld MSK+ODE — **ikke** det I kører i produktion.

**S-Agent paper note:** Ropedia S-Agent
(arXiv:[2606.20515](https://arxiv.org/abs/2606.20515)) er spatial tool-use
VLM-planner. PraxisOS «S-Agent» = `AlphaSpatiotemporalPipeline` (Roboflow →
pathology → TRELLIS → MonoMSK). Genbrug **hierarki-mønsteret** (2D → lift →
aggregate) i shadow — ikke paper weights.

---

## D. Anti-recommendations (exactly 5)

1. **Overnight autodeploy / self-merge daemon til main**  
   Transkriptets «Living Organism / God-Mode» bryder
   `SWARM_INVARIANTS.NO_AUTO_MERGE` / `NO_AUTO_DEPLOY`. Daemon må kun queue
   research/improve; merge kræver token + navngiven menneske.

2. **Autonom diagnose-VLM / live AR medical teacher**  
   Bryder «AI = suggestions only». Pathology forbliver shadow + kandidatsprog
   indtil acceptance §C. Ingen triage/behandling fra VLM.

3. **Claim MonoMSK MPa / N·m som clinical ground truth**  
   Repo-solver er Hooke-proxy fra point cloud
   (`mono-msk-tensor.ts`). Paper MonoMSK ≠ jeres kode. UI: kinematic proxy —
   aldrig «clinical-grade» / force-plate-erstatning (`acceptance-criteria.md` §E).

4. **Offentlig Roboflow Universe til Art. 9 kliniske billeder**  
   `privacy-gate.md` forbyder public destinations indtil DPA-pakke. Shadow
   endpoints er **private** evaluation — ikke Universe training dump.

5. **Neural nail SSS / Gaussian configurator som klinisk prioritet**  
   `nail_materials` må dele viewer — ikke findings, quality gates, audit eller
   promotion. NINA-stub (`agents/specialists/DR-NINA.ts`) er atelier/render,
   ikke MDR-blocker. Hold ude af top kliniske backlog.

---

## E. Mapping: transcript claim → shipped / partial / not started

| Transcript-tema | Status | Konkret i repo |
|-----------------|--------|----------------|
| «S-Agent clinical scan pipeline» | **Delvist shipped** | `lib/scanner/alpha-pipeline.ts` (seg → pathology → TRELLIS → MonoMSK + quality). **Ikke** Ropedia S-Agent paper. |
| Roboflow seg + candidates | **Live pins + shadow kandidater** | Live: `foot-segmentation-ehn9q/1`, `foot-ulcer/1`, `wounds-detection/1`. Shadow: `praxisos-foot-seg`, `praxisos-foot-candidates` via `shadow-workflow.ts` / `shadow-inference.ts`. |
| Landmarks / MonoMSK inputs | **Stub / disabled** | `praxisos` landmarks `candidate_untrained`, `deployable: false`; brief i `landmarks-training-brief.md`. |
| Quality gate | **Shipped (regelbaseret)** | `lib/scanner/quality.ts`, threshold 70. Uncertainty CaptureGate **not started**. |
| Privacy gate | **Shipped kode, closed ops** | `privacy-gate.ts` + docs; default `closed`. |
| Shadow parallel eval | **Shipped, flag OFF** | `PRAXIS_SHADOW_EVAL_ENABLED`; docs `shadow-evaluation.md`. |
| Promotion pack | **Templates shipped** | `docs/vision/promotion/*`; `approved_for_active_routing: false`. |
| MonoMSK MPa/N·m | **Partial proxy** | `lib/physics/mono-msk-tensor.ts` — synthesised stream, ikke paper MSK/ODE. |
| Meta-harness / worktrees | **Partial, human-gated** | `lib/swarm/meta-harness.ts`, `worktree-manager.ts`, `daemon.ts`; invariants NO_AUTO_*. |
| ARIA / FELIX / LUNA / FREJ / ATLAS | **Partial** | `lib/swarm/types.ts` SAgentIds + `s-agents.ts`; Alphaxiv LUNA harvest. |
| NINA neural rendering | **Stub / degraded path** | `agents/specialists/DR-NINA.ts` + inline WGSL fallback; `lib/nail/...` ofte mangler. |
| YOLO-World open-vocab | **Not started** (i PraxisOS) | Nævnt i Roboflow skills; ikke i scan-routing. |
| RL fine-tune e-learning | **Research only** | `catalog.ts` `rl_elearning` + chat claim c01; ingen `lib/learning/*`. |
| Adaptive tutor / Reflexion | **Not started** | Track purpose only. |
| InstantMesh / multi-view | **Not started** (spike dok.) | Top-3 TriView-Lift; live mesh = `firtoz/trellis`. |
| Metric scale uden checkerboard | **Not started** (spike dok.) | MetricAnchor i top-3. |
| CAD/STL ortose | **Not started** | Catalog purpose only. |
| Overnight auto-merge | **Explicitly rejected** | `NO_AUTO_MERGE`; chat claim c07 `fantasy_dump`. |
| «Shells are production code» dumps | **Fantasy filter** | `FANTASY_PATHS` i `chat-claims.ts` — **note:** listen er delvist forældet (`alpha-pipeline.ts` og `mono-msk-tensor.ts` **findes** nu; orchestrator-navne afviger). Behandl dumps som backlog, ikke proof. |

### Live vs stub vs shadow-only (kort)

| Lag | Tilstand |
|-----|----------|
| Universe seg + Replicate TRELLIS + quality PASS/HOLD | **Live** |
| Pathology candidates (Universe) | **Live infer, klinisk = shadow/candidate copy** |
| Custom Roboflow shadow workflow | **Shadow-only** (routing OFF) |
| Landmarks | **Disabled / untrained** |
| Swarm daemon / worktrees | **Ops stub-capable**; merge human-only |
| E-learning / nail SSS / STL / InstantMesh metric | **Not started eller research** |

---

## F. 14-day Broser checklist (max 12)

- [ ] 1. Fuldfør `privacy-gate-broser-checklist.md` (DPA, EU-route, residens, retention).
- [ ] 2. Sæt `PRAXIS_VISION_*` + navngiven approver + audit-event-id på **eval-host**.
- [ ] 3. Verificér gate `passed` via eksisterende tests/helpers — ingen agent-self-approve.
- [ ] 4. Enable `PRAXIS_SHADOW_EVAL_ENABLED=true` **kun** på eval-host; bekræft Universe-pins uændrede.
- [ ] 5. Kør ≥10 de-id scans; indsaml `vision.shadow.completed` / `skipped` audit.
- [ ] 6. Draft CaptureGate-Σ shadow JSON schema + 1 PR (logger only; threshold 70 urørt).
- [ ] 7. Start kandidat-adjudikation-protokol (agree/disagree/unsure) for acceptance §C.
- [ ] 8. Åbn landmarks labeling **kun** efter privacy; følg `annotation-atlas.md` + training brief.
- [ ] 9. Udfyld promotion-pack templates som **øvelse** (eval-report/model-card) — flag forbliver false.
- [ ] 10. LUNA harvest → én ranked spike-note der peger på CaptureGate eller TriView (ingen merge).
- [ ] 11. Skriv 20 verifiable e-learning quiz-items (class_0) — ingen RL-træning endnu.
- [ ] 12. Eksplicit **nej**-liste i sprint-board: auto-merge daemon, diagnose-VLM, MonoMSK-as-GT, public Universe, nail-SSS clinical.

---

## Relaterede filer

- `docs/vision/alphaxiv-top3-spikes.md` — CaptureGate / TriView / MetricAnchor
- `docs/vision/shadow-evaluation.md` · `privacy-gate.md` · `model-registry.md`
- `docs/vision/promotion/README.md` · `landmarks-training-brief.md`
- `lib/scanner/{alpha-pipeline,shadow-workflow,shadow-inference,privacy-gate,quality}.ts`
- `lib/swarm/{meta-harness,daemon,worktree-manager,s-agents,types}.ts`
- `lib/alphaxiv/{catalog,chat-claims,bridge}.ts`
- `contracts/roboflow-*.schema.ts`

## Metode / ærlighed om litteratur

WebSearch brugt til at verificere: ProRL (2505.24864), Lite PPO / Tricks or
Traps (2508.08221), MonoMSK (2511.19326), S-Agent spatial tool-use (2606.20515).
**Ingen opfundne DOI’er.** Fuld AlphaXiv deep-ask pack er ikke kørt end-to-end;
ranking = transcript-temaer × repo-inventar × MDR-formel. Re-score når LUNA
leverer bredere paper-pack.
