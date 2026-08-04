# EPIC-4 · §DoD-Actual (appendiks)

**Type:** appendiks der skal *tilføjes* nederst i eksisterende [`docs/harness/EPIC-4-ELearning.md`](../../../praxisos/docs/harness/EPIC-4-ELearning.md) (161 linjer). Filen her indeholder KUN den nye sektion — parent workflow appender den efter §7 "Rollback".

**Baseline:** [`COMPLETE-AUDIT-REPORT.md`](../../COMPLETE-AUDIT-REPORT.md) §9 Sprint 5 tabellen + §C5/C9/H-REG-1/UX-12, snapshot 2026-07-16.

---

## 8 · Definition of Done — Actual

### 8.1 Grade-legende

- ✅ **enforced** = både produktionskode kalder invariantens gate AND ≥1 test asserter failure-mode.
- 🟡 **partially-enforced** = kode ELLER test findes, men ikke begge.
- ❌ **declared-only** = kontrakten nævner INV-koden, men hverken kode-gate eller test håndhæver failure-mode.

### 8.2 EPIC-4 invariant-status pr. 2026-07-16

| INV | Titel (kort) | Grade | Evidens fra audit |
|---|---|---|---|
| **INV-EL-1** | Tenant-isolation | 🟡 partially-enforced | Standard RLS-mønster gælder for `learning_paths`, men **`learning_content`-tabellen har hverken `tenant_id` eller RLS aktiveret** (audit §C5, §SEC-15). Cross-tenant-lækage muligt via shared content-tabel. |
| **INV-EL-2** | Evidence-based content (`source_url` NOT NULL) | ✅ enforced | Migration 0006 CHECK-constraint. Trivielt at teste, men i praksis kombineret med content-corpus review. |
| **INV-EL-3** | Max 3 reflexion-iterationer | ✅ enforced | Reflexion-loop clamp i `lib/learning/reflexion-tutor.ts` + property-test (§6 test-strategi). |
| **INV-EL-4** | Ingen råt CPR i learning_paths | 🟡 partially-enforced | INV-3-parallel + `redact.ts`, samme H-BE-1/H-BE-2 caveats som INV-3. |
| **INV-EL-5** | Ingen medicinske claims uden citation | ✅ enforced | `medical-claims.ts` regex + retry-loop. Test dækker fabrikeret-citat-mønster. |
| **INV-EL-6** | Sprog fastlåst pr. sti | 🟡 partially-enforced | Zod-enum på `path.language`; ingen test asserter tutor-output-sprog-lock. Cross-sprog-injection ikke covered. |
| **INV-EL-7** | Progress monotont voksende | 🟡 partially-enforced | DB-constraint mangler; app-lag check findes uden test-adversarial. |

### 8.3 Sammendrag EPIC-4

- ✅ enforced: **3/7** (INV-EL-2, INV-EL-3, INV-EL-5)
- 🟡 partially-enforced: **4/7** (INV-EL-1, INV-EL-4, INV-EL-6, INV-EL-7)
- ❌ declared-only: **0/7**

**Regression-alarm — provenance-labelling-hul (audit §C9, §H-REG-1):**
- `TutorOutput`-typen har **ingen `ai_generated`-felt**. INV-CS-6-defensen når ikke det patient-vendte tutor-output.
- Konsekvens: EPIC-4 er delvist under Class 0-scope, men patient-facing tutor kræver AI-provenance-label pr. MDR + AI Act Art. 13. Ikke en INV-EL-fejl (koden er ikke deklareret her), men blocker for enhver patient-facing tutor-pilot.

**Regression-alarm — a11y (audit §UX-12):**
- Chat-message-list er `<div>` uden `aria-live` / `role='log'`. Input har kun `placeholder`, ingen `label`.
- Blocker for screen-reader-tilgængelighed på Class 0-surface.

**Regression-alarm — RLS-hul (audit §C5):**
- `learning_content` mangler både `tenant_id` og `ENABLE ROW LEVEL SECURITY`. Kompromitteret anon/service-token enumererer al content.
- Fix planlagt i Sprint 6 Goal C (audit §10.1 punkt 3): enable RLS på `users`, `memberships`, `tenants`, `learning_content`.

---

*Appendiks tilføjet 2026-07-16 · docs-fixer Batch 2 · baseline COMPLETE-AUDIT-REPORT.md*
