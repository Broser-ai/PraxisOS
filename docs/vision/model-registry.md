# Model-registry · Del Pilar Nexus

**Ejer:** Broser  
**Regel:** Produktion må kun referere model-ID’er listet her. Status skal være
`shadow`, `canary` eller `active` for den pågældende rolle. Ændringer kræver
navngiven menneskelig godkendelse + audit-event. Agenter må ikke promote.

**Klinisk sprogpolitik (alle rækker):**  
«Kandidatområde registreret; kræver kliniker-review.» — aldrig diagnose-/behandlingstekst.

## Statusværdier

`disabled` | `shadow` | `canary` | `active` | `rolled_back`

## Legacy-modeller (nuværende produktion på Hetzner — quality-gate primary)

Disse Universe/Replicate-pins er **current production default** for patient PASS/HOLD
(~95% traffic). Custom endpoints are governance-unlocked
(`approved_for_active_routing: true`) and selected only when
`FOOT_VISION_CANARY_PERCENT=5` places the scan key in the canary bucket.

| Rolle | Provider | Model ID | Status | Owner | Godkendt threshold | Rollback ID | Bemærkning |
|-------|----------|----------|--------|-------|--------------------|-------------|------------|
| Foot isolation | Roboflow | `foot-segmentation-ehn9q/1` | `active` | Broser | segment conf ≥ 0.35 (pipeline soft) | — | Universe stand-in; live default (~95%) |
| Candidate findings (primary) | Roboflow | `foot-ulcer/1` | `shadow` | Broser | finding conf ≥ 0.55 (quality credit) | `wounds-detection/1` | Kun kandidat-lokalisering |
| Candidate findings (secondary) | Roboflow | `wounds-detection/1` | `shadow` | Broser | finding conf ≥ 0.55 | `foot-ulcer/1` | Ensemble / fallback |
| 3D lift | Replicate | `firtoz/trellis` | `active` | Broser | remote mesh URL required for PASS | procedural fallback (HOLD) | Mesh via models API |

Quality-gate score-threshold for PASS forbliver **70** (`SCAN_QUALITY_THRESHOLD`) —
**ikke ændret her**.

## Shadow-workflow (governance unlocked 2026-08-27 — live cutover OFF)

Machine-readable: `docs/vision/workflows/del-pilar-nexus-shadow-evaluation.json`  
TS-export: `lib/scanner/shadow-workflow.ts`  
Canary gate: `lib/scanner/active-routing.ts`

| Felt | Værdi |
|------|-------|
| Workspace | `michaelba2712-gmail-com` |
| Workflow ID | `Z1TLmeAsa9GAWJg3xufe` |
| Workflow slug | `del-pilar-nexus-shadow-evaluation-1787761439900` |
| `deployment_state` | `shadow_only` |
| `approved_for_active_routing` | **true** (Broser 2026-08-27) |
| `governance.active_routing` | **false** |
| `replaces_live_universe_pins` | **false** |
| `PRAXIS_ACTIVE_ROUTING_ENABLED` | **true** (host) |
| `FOOT_VISION_CANARY_PERCENT` | **5** (code max; Universe default) |

| Rolle | Endpoint | Task | Status | Classes | Bemærkning |
|-------|----------|------|--------|---------|------------|
| Segmentation | `praxisos-foot-seg` | instance-segmentation | `canary` | `foot`, `toes_region`, `heel_region` | Eligible when canary > 0; else Universe |
| Candidates | `praxisos-foot-candidates` | object-detection | `canary` | `candidate_open_wound`, `candidate_localised_hyperkeratosis`, `candidate_heel_fissure` | Kandidatsprog — ikke diagnose |
| Landmarks | `praxisos` | keypoint-detection | `disabled` | — | `deployment_state: candidate_untrained`; **deployable: false**; **skipped** |

**Video (shadow evaluation):** sources `live_smartphone_frames`, `recorded_video`;
`frame_sampling_fps: 3`.

**Landmarks training brief:** `landmarks-training-brief.md` — not deployable until
trained + adjudicated.

**Promotion pack (signed 2026-08-27):** `docs/vision/promotion/` — canary **5%** /
Universe default; full pin swap still Broser-only.

**SHADOW_ONLY parallel eval:** `PRAXIS_SHADOW_EVAL_ENABLED=true` on host +
privacy-gate open. Logs only; does not replace Universe outside canary.

**CaptureGate-Σ:** `PRAXIS_CAPTURE_GATE_SHADOW=true` (log-only).  
**TriView-Lift:** `PRAXIS_TRIVIEW_SHADOW_ENABLED=true` (fail-soft; live Trellis pin unchanged).

**Privacy unlock:** `privacy-unlock-audit-2026-08-27.md` —
operational DPA accept (`PRAXIS_VISION_DPA_STATUS=broser_operational_accept_2026-08-27`);
formal PDF pending — `dpa-operational-residual.md`.

**Ikke i scope uden yderligere Broser-ordre:** full pin swap (`replaces_live_universe_pins`),
landmarks deploy, ændring af patientvendt sprog, retention eller `SCAN_QUALITY_THRESHOLD`.

## Kandidat-modeller (overblik)

| Navn | Roboflow-endpoint | Type | Status | Owner | Rollback (legacy pin) | Klinisk sprogpolitik |
|------|-------------------|------|--------|-------|----------------------|----------------------|
| nexus-foot-seg | `praxisos-foot-seg` | instance-seg | `canary` | Broser | `foot-segmentation-ehn9q/1` | N/A (anatomi/isolation) |
| nexus-foot-candidates | `praxisos-foot-candidates` | detect | `canary` | Broser | `foot-ulcer/1` | Kandidatsprog obligatorisk |
| nexus-foot-landmarks | `praxisos` | keypoints | `disabled` | Broser | — | Ikke deployable / untrained |

## Env-knapper (live pins uændrede)

| Variabel | Pin / default |
|----------|----------------|
| `ROBOFLOW_SEGMENT_MODEL` | `foot-segmentation-ehn9q/1` |
| `ROBOFLOW_MODEL` | `foot-ulcer/1` |
| `ROBOFLOW_MODEL_SECONDARY` | `wounds-detection/1` |
| `REPLICATE_MESH_MODEL` | `firtoz/trellis` |
| `SCAN_QUALITY_THRESHOLD` | `70` |
| `PRAXIS_ACTIVE_ROUTING_ENABLED` | `true` (host) |
| `FOOT_VISION_CANARY_PERCENT` | `5` |

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
| 2026-08-27 | Privacy + shadow + governance unlock; `approved_for_active_routing: true`; canary 0% then raised to **5%**; Universe default; TriView+CaptureGate shadow ON; landmarks still off | Michael Ambrosius / Broser |

## Promotion-skabelon

Udfyld pack under `docs/vision/promotion/` før statusændring:

- Fra-status → til-status  
- Exact model ID  
- Evaluation report (`promotion/eval-report.md`)  
- Model card (`promotion/model-card.md`)  
- Rollback model ID (`promotion/rollback-plan.md`)  
- Navngiven godkender + audit (`promotion/audit-checklist.md`)  
- Master gate (`promotion/gate-checklist.md`)  
