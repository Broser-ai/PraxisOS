# Model-registry · Del Pilar Nexus

**Ejer:** Broser  
**Regel:** Produktion må kun referere model-ID’er listet her. Status skal være
`shadow`, `canary` eller `active` for den pågældende rolle. Ændringer kræver
navngiven menneskelig godkendelse + audit-event. Agenter må ikke promote.

**Klinisk sprogpolitik (alle rækker):**  
«Kandidatområde registreret; kræver kliniker-review.» — aldrig diagnose-/behandlingstekst.

## Statusværdier

`disabled` | `shadow` | `canary` | `active` | `rolled_back`

## Legacy-modeller (nuværende pins — ikke ændret i denne leverance)

| Rolle | Provider | Model ID | Status | Owner | Godkendt threshold | Rollback ID | Bemærkning |
|-------|----------|----------|--------|-------|--------------------|-------------|------------|
| Foot isolation | Roboflow | `foot-segmentation-ehn9q/1` | `active` | Broser | segment conf ≥ 0.35 (pipeline soft) | — | Universe stand-in; privacy-gate kræver review før nye destinationer |
| Candidate findings (primary) | Roboflow | `foot-ulcer/1` | `shadow` | Broser | finding conf ≥ 0.55 (quality credit) | `wounds-detection/1` | Kun kandidat-lokalisering |
| Candidate findings (secondary) | Roboflow | `wounds-detection/1` | `shadow` | Broser | finding conf ≥ 0.55 | `foot-ulcer/1` | Ensemble / fallback |
| 3D lift | Replicate | `firtoz/trellis` | `active` | Broser | remote mesh URL required for PASS | procedural fallback (HOLD) | Mesh via models API |

Quality-gate score-threshold for PASS forbliver **70** (`SCAN_QUALITY_THRESHOLD`) —
**ikke ændret her**.

## Kandidat-modeller (ikke aktive pins)

| Navn | Planlagt Roboflow-projekt | Type | Status | Owner | Godkendt threshold | Rollback ID | Klinisk sprogpolitik |
|------|---------------------------|------|--------|-------|--------------------|-------------|----------------------|
| nexus-foot-seg | `praxisos-foot-seg` | instance-seg | `disabled` | Broser | TBD før shadow | `foot-segmentation-ehn9q/1` | N/A (anatomi/isolation) |
| nexus-foot-pathology | `praxisos-foot-pathology` | detect | `disabled` | Broser | TBD; starter `shadow` | `foot-ulcer/1` | Kandidatsprog obligatorisk |
| nexus-foot-landmarks | `praxisos-foot-landmarks` / `PraxisOS` | keypoints | `disabled` | Broser | TBD | — | Kun geometri; ingen diagnose |

## Env-knapper (dokumentation — værdier uændrede)

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

## Change log

| Dato | Ændring | Godkender |
|------|---------|-----------|
| 2026-08-26 | Registry oprettet; legacy pins dokumenteret uden env-ændring | Broser |

## Promotion-skabelon

Ved fremtidig statusændring udfyld:

- Fra-status → til-status  
- Exact model ID  
- Evaluation report (link)  
- Model card (version)  
- Rollback model ID  
- Navngiven godkender  
- Audit-event ID  
