# Model-governance · Del Pilar Nexus

**Status:** bindende for Broser og agenter  
**Relateret:** `privacy-gate.md`, `model-registry.md`,
`docs/alphaxiv-del-pilar-nexus-sota-prompt.md`

## Principper

1. **Suggestions only.** Vision-output er beslutningsstøtte til kliniker-review —
   ikke diagnose, triage eller behandlingsvalg.
2. **Pinning.** Produktion må kun kalde **eksakte** model-ID/versioner fra
   `model-registry.md` (fx `foot-ulcer/1`, `firtoz/trellis`).
3. **Shadow først.** Nye eller ændrede modeller starter i status `shadow`.
4. **Ingen agent-autonomi på klinisk sti.** Agenter må research’e og lave
   draft-PR/tests — ikke promote, merge, deploy eller ændre thresholds.

## Statusmaskine

| Status | Betydning |
|--------|-----------|
| `disabled` | Må ikke kaldes |
| `shadow` | Kører/logges; driver ikke kliniske påstande som fakta |
| `canary` | Begrænset eksponering under Broser-kontrol |
| `active` | Godkendt til den rolle, registry angiver |
| `rolled_back` | Tidligere aktiv; beholdt til rollback |

## Agent-governance (ikke-forhandlingsbart)

Agenter og automatiserede processer **må ikke**:

- promote en model (`shadow` → `canary`/`active`),
- merge eller deploy,
- ændre `SCAN_QUALITY_THRESHOLD` eller andre kliniske thresholds,
- enable/disable pathology-outputs,
- ændre patientvendt sprog,
- ændre data-retention,
- skifte produktions-model-ID i env/secrets.

Agenter **må**:

- opdage research og ranke spikes,
- generere draft-PR’er,
- tilføje tests, fixtures og evidence notes.

## Promotion-krav (menneske)

Hver promotion kræver **alle** følgende:

1. **Navngiven menneskelig godkender** (Broser)
2. **Evaluation report** (metrikker, slices, failure modes)
3. **Versioneret model card**
4. **Rollback model ID** (eksakt tidligere pin)
5. **Immutable audit-event** (fx `model.version.changed`)

Udfyld skabelonerne i `docs/vision/promotion/` (`gate-checklist.md` som master).
Sæt **ikke** `approved_for_active_routing: true` uden komplet, signeret pack.

Uden disse forbliver modellen i `shadow` eller `disabled`.

## Klinisk sprogpolitik

Tilladt patient-/kliniker-vendt formulering:

> «Kandidatområde registreret; kræver kliniker-review.»

Forbudt: «sår/ulcus påvist», «patient skal have behandling X», autonome
risikoscores, triage eller behandlingsvalg.

Pathology/lesion-modeller forbliver `shadow`, indtil prospektiv,
kliniker-adjudiceret evaluering med foruddefinerede gates er bestået.

## Separation of concerns

- **Klinisk sti:** isolation, geometri/mål, kandidat-lokalisering, quality gate,
  MonoMSK-proxy, journal med `ai_generated`.
- **nail_materials / atelier:** delt viewer/rendering — må ikke ændre findings,
  confidence, quality gates, audit eller klinisk prioritering.

## Scope-begrænsning for denne leverance

Denne dokumentation og kontrakterne **ændrer ikke** produktions-model-ID’er,
thresholds, patientvendt sprog, retention eller deploy-konfiguration. De
etablerer kun governance-fundamentet.
