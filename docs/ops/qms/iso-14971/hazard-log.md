> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.


# PraxisOS — Hazard Log (ISO 14971)

Status: skeleton — sprint 7. Kilde-invarianter: `prototype/lib/**` (grep `INV-`) og
`prototype/tests/inv-known-gaps.json`. Fuld mapping i [`INV-hazard-map.csv`](./INV-hazard-map.csv).
Risk management-proces beskrevet i [`risk-management-plan.md`](./risk-management-plan.md).

Severity og probability skala: 1 (lavest) – 5 (højst). Risk score = severity × probability.
Residual risk er vurderet EFTER de angivne mitigations er implementeret og testdækket; hvor
mitigation kun er delvist på plads (jf. `inv-known-gaps.json`), er dette markeret eksplicit.

| hazard_id | hazard_category (join key til CSV) | description | severity(1-5) | probability(1-5) | INV_codes | mitigation | residual_risk |
|---|---|---|---|---|---|---|---|
| HAZ-01 | silent-stub clinical output | En mock/stub-genereret klinisk vurdering (VLM-finding, biophysical map, scanner-output) præsenteres for klinikeren uden markering af at den er syntetisk, hvilket kan føre til fejlbehandling baseret på fiktive data. | 5 | 3 | INV-CS-6, INV-CS-7, INV-NC-2 | `ai_generated:true` håndhæves obligatorisk på alle findings/biophysical-regions via Zod-refine (`findings-schema.ts`, `constraints.ts`) og re-verificeres efter redaction-wrap (`sprg-guardrails.ts`); MDR Class-IIa dispatch-gate (`orchestrator.ts`) blokerer dispatch ved manglende klassifikation. | Lav — dobbelt håndhævelse (schema-refine + post-wrap re-check) reducerer sandsynlighed for at et umærket stub-resultat undslipper til bruger-flade. Ingen kendt gap i `inv-known-gaps.json` for INV-CS-6/CS-7. |
| HAZ-02 | cross-tenant data leak | Klinisk data, scanner-output eller GPU-forbrugsdata for én tenant bliver synlig for eller påvirker en anden tenant pga. manglende isolation i delt state (SharedStore) eller manglende RLS. | 5 | 2 | INV-CS-14 (delt via `shared-store/adapter.ts`) | Tenant-scoped nøgler i SharedStore-adapter for både GPU-budget-tracking og login-brute-force-tælling; RLS-politikker håndhæves af `safety-kit` (jf. `soup-inventory.csv`, SOUP-B) på databaselaget. | Medium — mitigation afhænger af korrekt tenant_id-scoping ved hvert kald; ingen dedikeret INV-code håndhæver isolation eksplicit i kode i dag. Kræver dedikeret INV-CS-2x invariant + RLS-test i næste sprint (åbent). |
| HAZ-03 | session forgery | En angriber forfalsker eller genbruger en session-token/cookie og opnår adgang til klinisk data eller orchestrator-dispatch under falsk identitet. | 4 | 2 | INV-CS-14 (delt brute-force-tæller i `shared-store/adapter.ts`) | Login-brute-force-beskyttelse via samme SharedStore-adapter som GPU-budget; session-validering håndteres af underliggende auth-lag (uden for `prototype/lib` grep-scope). | Medium — ingen dedikeret INV-code for session-integritet er fundet i `prototype/lib`; brute-force-tælleren reducerer credential-stuffing men adresserer ikke token-forfalskning direkte. Kræver eksplicit INV-CS-2x for session-verifikation (åbent). |
| HAZ-04 | GPU budget overrun | En tenant overskrider allokeret GPU-timebudget for scanner-pipeline (Level 2/3 lift), hvilket kan udsulte andre tenanters kapacitet eller generere uventede cloud-omkostninger. | 2 | 4 | INV-CS-14 | Hård grænse håndhævet i `gpu-adapter.ts` (`GPU_HOURLY_LIMIT_SEC`) — kald der ville overskride budgettet kastes som violation før GPU-lift igangsættes. | Lav — hård pre-check før forbrug; ingen kendt gap i `inv-known-gaps.json`. |
| HAZ-05 | timeout-uden-audit | Scanner-pipeline'en timer ud (fx VLM- eller MedSAM-kald der hænger) uden at hændelsen logges i audit-trail, hvilket skjuler fejl for QA/PMS-processen. | 3 | 3 | INV-CS-13 | `PIPELINE_TIMEOUT_MS` (180s) defineret i `pipeline.ts`; audit-logging af timeout-hændelser er specificeret men mangler testdækning. | Medium-Høj (åben gap) — INV-CS-13 står eksplicit i `inv-known-gaps.json` som mangler test-dækning. Residualrisiko kan IKKE nedgraderes til Lav før test er skrevet og gap fjernet fra ratchet-listen. |
| HAZ-06 | VLM hallucination | Det vision-language-baserede scanner-lag (Claude Sonnet 5 vision) genererer et klinisk finding der ikke er anatomisk verificerbart eller MedSAM-bekræftet, og confidence-niveauet afspejler ikke usikkerheden. | 5 | 4 | INV-CS-6, INV-CS-19 | SPRG-guardrails (`sprg-guardrails.ts`) håndhæver at hvert finding enten er anatomisk verificeret eller nedgraderet i confidence (INV-CS-19-assertion på verdict-count == findings-count); `ai_generated` re-check efter wrap. | Medium — assertion fanger struktur-mismatch (manglende verdict), men fanger ikke semantisk forkert men "plausibel" hallucination. Kræver klinisk sample-audit som supplerende kontrol (proces, ikke kode). |
| HAZ-07 | MedSAM adapter fail | Geometri-adapterkæden (watertight-check → STL-export → mill-adapter) fejler stille eller producerer en ikke-manifold/non-printbar model der alligevel sendes til lab. | 4 | 3 | INV-CS-1, INV-CS-2, INV-CS-8 | Dobbelt watertight-verifikation: pre-export (`watertight.ts`, INV-CS-1) og post-export re-parse (`stl-export.ts`, INV-CS-2); `feature_cad_export`-flag håndhæves før export tillades (INV-CS-8); mill-adapter re-tjekker `locked`/`approved_by` (INV-NC-1, INV-NC-4) før afsendelse til lab. | Lav-Medium — flerlags-verifikation reducerer sandsynlighed markant, men ingen kendt automatiseret gate for selve mill-hardwarens accept/fejl-retursignal er fundet i grep-scope. |
| HAZ-08 | klient-CPR i log | Personhenførbart CPR-nummer fra klientprofil eller VLM-kontekst havner uredigeret i logs, persisteret summary, eller frameUrl, hvilket udgør et GDPR-brud. | 4 | 3 | INV-CS-11, INV-EL-4 | `redactPII` anvendes obligatorisk på `frameUrl` og `overall_summary_da` før persistering (`sprg-guardrails.ts`) og på klient-kontekst før VLM-kald (`vlm-caller.ts`); klient-profil redigeres for CPR før brug i learning path-generator (`path-generator.ts`, INV-EL-4). | Lav — redaction er placeret ved alle identificerede injektionspunkter (VLM-input, VLM-output, persisteret summary, learning-profil); ingen kendt gap i `inv-known-gaps.json` for INV-CS-11/EL-4. |

## Noter til fremtidig udvidelse

- `PROC-01` / **Process-integrity (non-safety)** (bruges kun i `INV-hazard-map.csv`, ikke en
  række i tabellen ovenfor): dedikeret ikke-hazard klassifikationsbøtte for invarianter, der
  håndhæver data-/proceskvalitet uden en identificeret patientsikkerheds- eller
  GDPR-konsekvens (fx range-checks på konfigurations-parametre, reflexion-loop-grænser,
  monoton progress-guard). Disse indgår bevidst ikke som selvstændige rækker i
  risikoregistret ovenfor, men spores i CSV'en under `hazard_category = "Process-integrity
  (non-safety)"` for fuld sporbarhed af samtlige INV-koder fundet i `prototype/lib` og
  `inv-known-gaps.json`.
- HAZ-02 og HAZ-03 mangler i dag en dedikeret, testbar INV-code i `prototype/lib` — de er
  medtaget her fordi de er kendte hazard-klasser for et multi-tenant klinisk system, men
  risikovurderingen er baseret på indirekte mitigation (delt SharedStore-scoping). Dette skal
  lukkes med eksplicitte invarianter (foreslået: `INV-CS-20` cross-tenant isolation,
  `INV-CS-21` session-integritet) i et senere sprint.
- Enhver ny hazard identificeret under risk review (§8/§9 i `risk-management-plan.md`) skal
  tilføjes som ny række her med fortløbende `hazard_id` (HAZ-09, HAZ-10, …) — eksisterende
  rækker må ikke omnummereres.
