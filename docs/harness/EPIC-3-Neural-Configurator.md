> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.


# EPIC-3 · §DoD-Actual (appendiks)

**Type:** appendiks der skal *tilføjes* nederst i eksisterende `docs/harness/EPIC-3-Neural-Configurator.md` (full 245-line contract not in Drive extract; this file is the DoD-Actual appendix only). Filen her indeholder KUN den nye sektion — parent workflow appender den efter §9 "Rollback".

**Baseline:** [`COMPLETE-AUDIT-REPORT.md`](../../COMPLETE-AUDIT-REPORT.md) §9 Sprint 3 tabellen + §2 blocker-liste + §C19/C22/C23, snapshot 2026-07-16.

---

## 10 · Definition of Done — Actual

### 10.1 Grade-legende

- ✅ **enforced** = både produktionskode kalder invariantens gate AND ≥1 test asserter failure-mode.
- 🟡 **partially-enforced** = kode ELLER test findes, men ikke begge.
- ❌ **declared-only** = kontrakten nævner INV-koden, men hverken kode-gate eller test håndhæver failure-mode.

### 10.2 EPIC-3 invariant-status pr. 2026-07-16

| INV | Titel (kort) | Grade | Evidens fra audit |
|---|---|---|---|
| **INV-NC-1** | Parameter-vektor låst efter approval | ✅ enforced | TS + DB CHECK triple-layer verificeret; contract-test i §8 test-strategi. `PractitionerSignOff` gater lab-submit. |
| **INV-NC-2** | Alle biophysical maps markeret ai_generated | 🟡 partially-enforced | INV-CS-6-parallel virker på scanner-output. Biophysical-inversion v2-output ryger igennem samme `enforceAiGenerated` — men ingen dedikeret configurator-side test asserter marker på maps. |
| **INV-NC-3** | Alle 16 parametre inden for range | ✅ enforced | Zod-validation + DB-CHECK + 200-syntetisk-property-test (§8). |
| **INV-NC-4** | Ingen orthotic til lab uden practitioner-approval | 🟡 partially-enforced | DB CHECK-constraint eksisterer i migration 0005:32-34, men **ingen SQL-lag-test asserter constraint-throwet** (audit §9 Sprint 3, §B14). TS-parallel i `constraints.ts` beviser intet om SQL-adfærd. |
| **INV-NC-5** | Tenant-isolation | ✅ enforced | Standard RLS-mønster; INV-1-parallel dækker via write-once tenantId. |
| **INV-NC-6** | Ingen medicinske claims i parameter-navnene | 🟡 partially-enforced | Zod-whitelist findes; ingen adversarial-test injicerer fri-tekst-mutations. |
| **INV-NC-7** | STL-eksport genbruger EPIC 2's dobbelt-verify | 🟡 partially-enforced | Kode-genbrug findes; INV-CS-1/2 er selv kun delvist testede (se EPIC-2 §13.4). |

### 10.3 Sammendrag EPIC-3

- ✅ enforced: **3/7** (INV-NC-1, INV-NC-3, INV-NC-5)
- 🟡 partially-enforced: **4/7** (INV-NC-2, INV-NC-4, INV-NC-6, INV-NC-7)
- ❌ declared-only: **0/7**

**Positiv observation:** EPIC-3 har det højeste enforced-tal proportionalt (3/7 = 43 %) og ingen decl-only. Contract-follow-through er bedst her.

**Regression-alarm — visuel-fidelity-lag ikke wired (audit §C19):**
- `ClinicLamp` (IES-profil), `Oklab` interpolation, `ColorCheckerOverlay` er byggede som standalone-filer og **importes ikke** af `NeuralConfigurator.tsx` (2067 LOC).
- Konsekvens: Class-IIa material-kalibrering ΔE<3 kan ikke måles (audit §9 Sprint 3 · "Cannot measure without wiring").
- Ikke en INV-NC-fejl, men en DoD-contract-fejl vs. Sprint 3 §5 resolution. Sprint 6 Goal F (audit §10.1) planlægger 1-day PR til lukning.

**A11y-regression-alarm:**
- FancyRange-slider har ingen visible focus-ring (C22 · WCAG 2.4.7 fail på Class-IIa-surface).
- ModalShell/SignOffModal mangler focus-trap, initial focus, Escape close, backdrop close (C23). Sign-off er load-bearing for INV-NC-4.

---

*Appendiks tilføjet 2026-07-16 · docs-fixer Batch 2 · baseline COMPLETE-AUDIT-REPORT.md*
