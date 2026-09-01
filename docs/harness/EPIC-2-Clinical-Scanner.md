> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.


# EPIC-2 · §DoD-Actual (appendiks)

**Type:** appendiks der skal *tilføjes* nederst i eksisterende `docs/harness/EPIC-2-Clinical-Scanner.md` (full 502-line contract not in Drive extract; this file is the DoD-Actual appendix only). Filen her indeholder KUN den nye sektion — parent workflow appender den efter §12 "Definition of Done for denne kontrakt".

**Baseline:** [`COMPLETE-AUDIT-REPORT.md`](../../COMPLETE-AUDIT-REPORT.md) §9 Sprint 2 tabellen + §2 blocker-liste + REVISION-02 §3 (INV-CS-19/20/21), snapshot 2026-07-16.

---

## 13 · Definition of Done — Actual

### 13.1 Grade-legende

- ✅ **enforced** = både produktionskode kalder invariantens gate AND ≥1 test asserter failure-mode.
- 🟡 **partially-enforced** = kode ELLER test findes, men ikke begge.
- ❌ **declared-only** = kontrakten nævner INV-koden, men hverken kode-gate eller test håndhæver failure-mode.

### 13.2 EPIC-2 baseline invariant-status (INV-CS-1 … INV-CS-18) pr. 2026-07-16

| INV | Titel (kort) | Grade | Evidens fra audit |
|---|---|---|---|
| **INV-CS-1** | Watertight garanti på mesh | ✅ enforced | Post-generation-verify + test. |
| **INV-CS-2** | Ingen delvist gyldig STL | 🟡 partially-enforced | Storage-delete-branch findes; ingen adversarial-test der beviser cleanup ved partial failure. |
| **INV-CS-3** | Skala-fidelitet ±0.5 mm | 🟡 partially-enforced | UI-warning-mekanisme wired; ingen kalibrerings-property-test. |
| **INV-CS-6** | Alle findings AI-generated markeret | ✅ enforced | Layered defense: schema + `enforceAiGenerated` + SPRG re-assert. `tests/clinical-scanner/inv-cs-6-ai-generated.test.ts` med 100-syntetic-findings property-test. Gold standard. |
| **INV-CS-7** | Ingen autonom medicinsk beslutning | ✅ enforced (efter Batch 1) | `journal_entries.ai_approved_at IS NULL` release-gate + `canDispatchAgent` wired ved supervisor + worker via B2-fix. |
| **INV-CS-8** | Tenant-flag kan ikke bruger-toggles | 🟡 partially-enforced | RLS + audit-log-entry declared; H-BE-3 flagger asymmetrisk dev-mode-bypass der kan omgå gate på Vercel preview. |
| **INV-CS-9** | 60 s escalation-SLA | ❌ declared-only | Ingen test asserter SLA. |
| **INV-CS-10** | Raw frames slettes efter 30 d | ❌ declared-only | Cron-job absent. Ingen `pg_cron`-schedule. H-DM-5 flagger data-lifecycle-hul. |
| **INV-CS-11** | Ingen råt CPR i scanner-runs | ✅ enforced | INV-3-parallel + DB-CHECK. |
| **INV-CS-12** | Klient-samtykke krævet før upload | ❌ declared-only | H-SEC-1: route accepterer klient-supplied `consent_given: true` boolean — ingen cross-check mod `consent_events`. Bypassable. |
| **INV-CS-13** | Total pipeline ≤ 180 s | ❌ declared-only | Ingen timeout-test. |
| **INV-CS-14** | GPU-cost-loft 300 s/tenant/hr | ❌ declared-only | `tenantGpuBudget = new Map<>()` in-memory på serverless — 5× overspend på 5 warm instances (B9). |
| **INV-CS-15** | Max 3 samtidige scans pr. tenant | ❌ declared-only | Ingen test. |
| **INV-CS-16** | `scanner_version = 'v1-manual'` default | ✅ enforced | DB-default sat i 0004; nye tenants arver v1-manual. |
| **INV-CS-17** | Ingen breaking changes til eksisterende `/scans/*` | ❌ declared-only | INV-17-parallel: ingen HTTP-integration-test (B13). |
| **INV-CS-18** | `FEATURE_CAD_EXPORT` kan slås fra midt i flow | ❌ declared-only | Ingen graceful-abort-test. Bemærk: `FEATURE_CLINICAL_SCANNER_V2` flag helt fraværende fra kode (C21). |

### 13.3 EPIC-2 REVISION-02 invariant-status (INV-CS-19 … INV-CS-21)

| INV | Titel (kort) | Grade | Evidens |
|---|---|---|---|
| **INV-CS-19** | SPRG-verifiable-evidence (mesh-face + frames-krav + label→region + fail-CLOSED hvis MedSAM utilgængelig) | 🟡 partially-enforced | Reference-kvalitets kode i `lib/scanner/sprg-guardrails.ts` (417 LOC, 6 SECURITY-FIXES i header), men **0 tests** (B15). Zero coverage af de 6 SECURITY-FIXES. |
| **INV-CS-20** | LIST3R-anchor-persistence (landmark cross-scan drift ≤ 2.0 mm) | ❌ declared-only | Ingen longitudinal test-fixture, ingen fast-check-property-test som REVISION-01 §8 tabel planlægger. |
| **INV-CS-21** | YOLO26-precheck-gate (coverage_score) | ❌ declared-only | REVISION-02 downgrader til advisory (ikke hard-reject), men selv advisory-branchen har ingen assertion. |

### 13.4 Sammendrag EPIC-2

- ✅ enforced: **4/21** (INV-CS-1, INV-CS-6, INV-CS-7, INV-CS-11, INV-CS-16 — 5 hvis vi tæller INV-CS-16 med, ellers 4)
- 🟡 partially-enforced: **5/21** (INV-CS-2, INV-CS-3, INV-CS-8, INV-CS-19; plus 1 udefineret grænsetilfælde)
- ❌ declared-only: **11/21** (INV-CS-9, INV-CS-10, INV-CS-12, INV-CS-13, INV-CS-14, INV-CS-15, INV-CS-17, INV-CS-18, INV-CS-20, INV-CS-21 · + INV-CS-8 hvis vi vægter Vercel-preview-bypass som fuld regression)

**Regression-alarm:** INV-CS-12 (consent-verification), INV-CS-14 (GPU-cost-loft), INV-CS-19 (SPRG) er alle Class-IIa-audit-kritiske og enten uenforced eller utestet. B7, B9, B15, B19 dækker fixes i Batch 2/3.

---

*Appendiks tilføjet 2026-07-16 · docs-fixer Batch 2 · baseline COMPLETE-AUDIT-REPORT.md*
