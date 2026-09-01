# Roboflow-prompt · Del Pilar Nexus / PraxisOS fod-scan

Kopiér blokken herunder ind i Roboflow (Assist / project setup / train brief).
Workspace: `michaelba2712-gmail-com` · eksisterende tomt projekt `PraxisOS` er keypoint-detection uden billeder — brug det til landemærker ELLER opret to nye projekter som nedenfor.

---

## Prompt (kopiér fra her)

```
You are helping build production computer-vision models for Del Pilar Nexus,
a clinical foot-scan module inside PraxisOS (podiatry / fodpleje clinics in Denmark).

CONTEXT — what already exists in our product
We already have a live pipeline (ARIA orchestrator → S-Agent) with these stages:

1) FOOT ISOLATION (Roboflow) — currently calling public Universe model
   `foot-segmentation-ehn9q/1` via detect.roboflow.com
   Purpose: confirm a foot is present, isolate foot from background/clinic clutter.
   Quality gate: if foot not detected → scan HOLD (clinical fail-closed).

2) PATHOLOGY DETECTION (Roboflow) — currently calling Universe models
   `foot-ulcer/1` + secondary `wounds-detection/1`
   Purpose: bounding boxes / classes for skin & nail findings on plantar + dorsal views.
   Findings feed journal SOAP as AI suggestions (NOT autonomous diagnosis).
   Confidence threshold we care about: ≥0.55 for quality credit.

3) 3D LIFT (Replicate, not Roboflow) — `firtoz/trellis` image→mesh GLB

4) MonoMSK biomechanics (our code) — arch strain (MPa), torsion (N·m), pronation proxy
   from a synthesized landmark stream. Better anatomical keypoints from Roboflow
   would materially improve this stage.

5) UI — camera/upload on app.bypilar.dk/scan, Alpha 4D viewer, quality grade A–F,
   PASS requires live mesh + foot detected + score ≥70.

HARD CONSTRAINTS
- EU clinic / GDPR Art. 9 health data mindset: training images must be de-identified.
- Output must be decision-support labels, never diagnostic claims.
- Photos are real clinic phone/camera: overhead plantar, medial/lateral, dorsal,
  with variable lighting, skin tones, nail polish, socks partially removed, cluttered floors.
- Prefer models that work with our existing HTTP contract:
  POST https://detect.roboflow.com/{project}/{version}?api_key=PRIVATE
  body = raw base64 (no data-URL prefix) → JSON predictions[{class,confidence,x,y,width,height}]
- We already store Private API Key server-side; Publishable key is unused.

GOAL — make Del Pilar Nexus MUCH better than generic Universe models
Design and (step-by-step) help me create THREE Roboflow projects in workspace
`michaelba2712-gmail-com`:

### Project A — `praxisos-foot-seg` (Instance Segmentation)
Replace `foot-segmentation-ehn9q`.
Classes (polygon masks):
- foot_plantar
- foot_dorsal
- foot_medial
- foot_lateral
- toes_region
- heel_region
Reject / hard-negative: empty floor, shoes only, hands, legs without foot, blur.

Success metrics we need:
- Recall of “any foot present” ≥ 0.95 on clinic phone photos
- Mask IoU ≥ 0.85 on clear plantar shots
- Graceful low confidence (<0.4) when no foot → our app will HOLD

### Project B — `praxisos-foot-pathology` (Object Detection)
Replace `foot-ulcer` + `wounds-detection` with podiatry-specific classes:
- ulcer_dfu (diabetic foot ulcer suspect)
- callus
- fissure_heel
- hyperkeratosis
- onychomycosis_suspect
- ingrown_nail_suspect
- wart_suspect
- hematoma_subungual
- erythema_hotspot
- maceration_interdigital
- pressure_point_blanch
- scar_prior
- healthy_skin_ref (optional negative/control boxes — skip if noisy)

Labeling rules:
- Box tight around lesion; one primary class per lesion
- If uncertain between classes, prefer broader class + note in annotation comments
- Never invent severity grades in class names (severity stays severity-agnostic)

Success metrics:
- Per-class precision focus on ulcer_dfu / callus / fissure_heel first
- Minimize false positives on healthy shiny skin and wet floors

### Project C — `praxisos-foot-landmarks` (Keypoint Detection)
Upgrade our MonoMSK inputs. Use/adapt existing empty project `PraxisOS`
(currently keypoint-detection, 0 images) OR create fresh.
Required keypoints (normalized foot anatomy, plantar-preferred + dorsal optional):
- heel_center
- medial_malleolus_proj
- lateral_malleolus_proj
- navicular
- cuboid
- mtp1
- mtp5
- hallux_tip
- digit2_tip
- digit5_tip
- arch_apex
- midfoot_center

These must be stable enough that we can map (x,y) → our Float32 XYZ stream
(heel, arch, ball, hallux, fifth, navicular, lateral, medial).

DATASET PLAN (tell me exactly what to do in the Roboflow UI)
1) Minimum viable: 150–300 images before first train (mix plantar/dorsal/side).
2) Augmentations: rotation ±15°, brightness/contrast, mild blur, mosaic off for keypoints.
3) Train YOLOv8/YOLOv11 (or Roboflow’s current recommended) — start nano/small, then medium.
4) Export hosted model versions: `/1` then `/2` after active learning.
5) Give me the exact model IDs to put in env:
   ROBOFLOW_SEGMENT_MODEL=...
   ROBOFLOW_MODEL=...
   ROBOFLOW_MODEL_SECONDARY=...

ACTIVE LEARNING LOOP with our app
We will upload real (de-identified) clinic fails: false HOLD, missed ulcers, wrong boxes.
Propose a Roboflow workflow: Model Monitoring → review queue → retrain weekly.

OUTPUT FORMAT I NEED FROM YOU NOW
1) Exact project types + class lists (copy-paste ready)
2) Annotation instructions for a non-ML clinic assistant (Danish or English)
3) Recommended train settings for first version
4) Acceptance checklist before we swap Universe models in production
5) Risks (domain shift, nail polish, dark skin tones, wet tile reflections) + mitigations

Do NOT suggest full-body pose models. Scope is FOOT only (podiatry).
Do NOT claim the model diagnoses disease — labels are findings for clinician review.
```

---

## Kort status (hvad der kører nu)

| Lag | Status |
|-----|--------|
| ARIA + S-Agent + UI `/scan` | Live på app.bypilar.dk |
| Replicate 3D (`firtoz/trellis`) | Nøgle sat |
| Roboflow API | Secret key sat · `liveReady: true` |
| Segment | Universe `foot-segmentation-ehn9q/1` |
| Pathology | Universe `foot-ulcer/1` + `wounds-detection/1` |
| Jeres Roboflow-projekt `PraxisOS` | Tomt keypoint-projekt — perfekt kandidat til Project C |

Når Roboflow har trænet version `/1`, lim model-ID’erne her — så skifter jeg env væk fra Universe.
