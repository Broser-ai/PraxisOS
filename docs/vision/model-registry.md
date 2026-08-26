# Model-registry · Del Pilar Nexus

**Ejer:** Broser  
**Regel:** Produktion må kun referere model-ID’er listet her. Status skal være
`shadow`, `canary` eller `active` for den pågældende rolle. Ændringer kræver
navngiven menneskelig godkendelse + audit-event. Agenter må ikke promote.

**Klinisk sprogpolitik (alle rækker):**  
«Kandidatområde registreret; kræver kliniker-review.» — aldrig diagnose-/behandlingstekst.

## Statusværdier

`disabled` | `shadow` | `canary` | `active` | `rolled_back`

## Legacy-modeller (nuværende produktion på Hetzner — ikke ændret)

Disse Universe/Replicate-pins er **current production**. Custom endpoints nedenfor
er **shadow-kandidater** og erstatter **ikke** live routing.

| Rolle | Provider | Model ID | Status | Owner | Godkendt threshold | Rollback ID | Bemærkning |
|-------|----------|----------|--------|-------|--------------------|-------------|------------|
| Foot isolation | Roboflow | `foot-segmentation-ehn9q/1` | `active` | Broser | segment conf ≥ 0.35 (pipeline soft) | — | Universe stand-in; privacy-gate kræver review før nye destinationer |
| Candidate findings (primary) | Roboflow | `foot-ulcer/1` | `shadow` | Broser | finding conf ≥ 0.55 (quality credit) | `wounds-detection/1` | Kun kandidat-lokalisering |
| Candidate findings (secondary) | Roboflow | `wounds-detection/1` | `shadow` | Broser | finding conf ≥ 0.55 | `foot-ulcer/1` | Ensemble / fallback |
| 3D lift | Replicate | `firtoz/trellis` | `active` | Broser | remote mesh URL required for PASS | procedural fallback (HOLD) | Mesh via models API |

Quality-gate score-threshold for PASS forbliver **70** (`SCAN_QUALITY_THRESHOLD`) —
**ikke ændret her**.

## Shadow-workflow (registreret — active routing OFF)

Machine-readable: `docs/vision/workflows/del-pilar-nexus-shadow-evaluation.json`  
TS-export: `lib/scanner/shadow-workflow.ts`

| Felt | Værdi |
|------|-------|
| Workspace | `michaelba2712-gmail-com` |
| Workflow ID | `Z1TLmeAsa9GAWJg3xufe` |
| Workflow slug | `del-pilar-nexus-shadow-evaluation-1787761439900` |
| `deployment_state` | `shadow_only` |
| `approved_for_active_routing` | **false** |

| Rolle | Endpoint | Task | Status | Classes | Bemærkning |
|-------|----------|------|--------|---------|------------|
| Segmentation | `praxisos-foot-seg` | instance-segmentation | `shadow` | `foot`, `toes_region`, `heel_region` | Shadow-kandidat; erstatter ikke Universe-pin |
| Candidates | `praxisos-foot-candidates` | object-detection | `shadow` | `candidate_open_wound`, `candidate_localised_hyperkeratosis`, `candidate_heel_fissure` | Kandidatsprog — ikke diagnose |
| Landmarks | `praxisos` | keypoint-detection | `disabled` | — | `deployment_state: candidate_untrained`; **deployable: false**; **skipped** in shadow parallel inference |

**Video (shadow evaluation):** sources `live_smartphone_frames`, `recorded_video`;
`frame_sampling_fps: 3`.

**Landmarks training brief:** `landmarks-training-brief.md` — not deployable until
trained + adjudicated. Helpers: `isLandmarksEndpointRunnable()`,
`listShadowParallelInferenceEndpoints()` (omits landmarks).

**Promotion pack (Broser, before any `approved_for_active_routing: true`):**
`docs/vision/promotion/` (`gate-checklist.md`, eval-report, model-card,
rollback-plan, audit-checklist). Flag remains **false**.

**SHADOW_ONLY parallel eval (optional):** `docs/vision/shadow-evaluation.md` —
flag `PRAXIS_SHADOW_EVAL_ENABLED` (default OFF) + privacy-gate. Logs only;
**does not** replace Universe pins, quality gate, or patient copy.
`approved_for_active_routing` remains **false**.

**CaptureGate-Σ / TriView-Lift (shadow, default OFF):** `capture-gate.md`,
`triview-lift.md` — neither changes threshold 70 nor live TRELLIS pin.

**Privacy unlock (Broser):** if DPA env unsigned, follow
`privacy-unlock-broser-unblock.md` — do not fake signatures.

**Ikke i scope uden Broser-promotion:** env-swap af live pins på Hetzner,
ændring af patientvendt sprog, retention eller `SCAN_QUALITY_THRESHOLD`.

## Kandidat-modeller (overblik)

| Navn | Roboflow-endpoint | Type | Status | Owner | Rollback (legacy pin) | Klinisk sprogpolitik |
|------|-------------------|------|--------|-------|----------------------|----------------------|
| nexus-foot-seg | `praxisos-foot-seg` | instance-seg | `shadow` | Broser | `foot-segmentation-ehn9q/1` | N/A (anatomi/isolation) |
| nexus-foot-candidates | `praxisos-foot-candidates` | detect | `shadow` | Broser | `foot-ulcer/1` | Kandidatsprog obligatorisk |
| nexus-foot-landmarks | `praxisos` | keypoints | `disabled` | Broser | — | Ikke deployable / untrained; see `landmarks-training-brief.md` |

## Env-knapper (dokumentation — værdier uændrede / legacy production)

| Variabel | Pin / default |
|----------|----------------|
| `ROBOFLOW_SEGMENT_MODEL` | `foot-segmentation-ehn9q/1` |
| `ROBOFLOW_MODEL` | `foot-ulcer/1` |
| `ROBOFLOW_MODEL_SECONDARY` | `wounds-detection/1` |
| `REPLICATE_MESH_MODEL` | `firtoz/trellis` |
| `SCAN_QUALITY_THRESHOLD` | `70` |

## Secrets

| Secret | Placering |
|--------|-----------|
| `REPLICATE_API_TOKEN` | `/data/secrets.json` |
| `ROBOFLOW_API_KEY` | `/data/secrets.json` (Private/Secret key — ikke publishable `rf_…`) |

Agent-tooling (Cursor Roboflow-plugin MCP) er separat fra denne nøgle — se `docs/ops/roboflow-cursor-sot.md`.

## Change log

| Dato | Ændring | Godkender |
|------|---------|-----------|
| 2026-08-26 | Registry oprettet; legacy pins dokumenteret uden env-ændring | Broser |
| 2026-08-26 | Shadow-workflow `Z1TLmeAsa9GAWJg3xufe` registreret; `approved_for_active_routing: false`; landmarks disabled | Broser (input Michael) |
| 2026-08-26 | SHADOW_ONLY parallel eval path (`PRAXIS_SHADOW_EVAL_ENABLED`, privacy-gate); active routing still false | Broser (draft) |
| 2026-08-26 | Landmarks training brief + promotion pack scaffolding; landmarks skipped for shadow parallel inference; routing still false | Broser (agent draft) |

## Promotion-skabelon

Udfyld pack under `docs/vision/promotion/` før statusændring:

- Fra-status → til-status  
- Exact model ID  
- Evaluation report (`promotion/eval-report.md`)  
- Model card (`promotion/model-card.md`)  
- Rollback model ID (`promotion/rollback-plan.md`)  
- Navngiven godkender + audit (`promotion/audit-checklist.md`)  
- Master gate (`promotion/gate-checklist.md`) — må ikke sætte
  `approved_for_active_routing: true` uden sign-off  
