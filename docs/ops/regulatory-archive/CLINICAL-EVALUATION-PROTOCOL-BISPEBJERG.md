> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.


# Clinical Evaluation Protocol · PraxisOS Clinical Scanner v0.1

**Study title:** *Prospective validation of AI-assisted foot examination and orthotic-parametrisation in podiatric practice*

**Sponsor:** ReNew-DK ApS (CVR: [udfyldes]) · Michael Ambrosius, CEO
**Study center:** Bispebjerg Motion & Gait Lab · Region Hovedstaden
**Regulatory basis:** MDR 2017/745 · MDCG 2019-11 · MEDDEV 2.7/1 rev.4 · IEC 82304-1
**Protocol version:** 0.1 draft · 2026-07-13 · pending Datatilsynet + Videnskabsetisk Komité approval

---

## 1. Rationale

The PraxisOS Clinical Scanner (Class IIa SaMD, CE-mark pending) provides AI-assisted foot examination + orthotic-parametrisation to support autoriserede sundhedspersoner. Retrospective bias-audit + 6-month shadow-mode (Sprint 5-8) documented concordance vs blinded panel of Danish fodterapeuter with target Cohen's kappa ≥ 0.75.

This prospective study validates safety + performance in real clinical use across mixed-morbidity foot patients at Bispebjerg's Motion & Gait Lab, prior to CE-mark submission and general market launch.

---

## 2. Objectives

### 2.1 Primary objectives
1. **Concordance** — Cohen's kappa ≥ 0.75 mellem PraxisOS finding-detection og blinded fodterapeut/ortopæd-vurdering.
2. **Safety** — 0 adverse events attribuable til AI-recommendation over studieperioden.
3. **Time-savings** — dokumentations-tid reduceret ≥ 40 % vs baseline (self-report + timestamp-diff).

### 2.2 Secondary objectives
4. Practitioner accept-rate for AI-suggestions in 60–80 % range (afspejler alert-value uden fatigue).
5. Sygesikringen "danmark" claim-cycletime reduceret ≥ 30 % vs baseline.
6. Patient-outcome measures (FFI, FAAM) forbedret ved orthotic-brug ≥ minimum important difference (MID).
7. AI-provenance-transparency: 100 % af persisterede findings har inline provenance-spans + ai_generated flag.

---

## 3. Study Design

### 3.1 Type
Prospective, single-arm, open-label, multi-cohort observational study med matched historical controls fra Bispebjerg's baseline patient-register 2024-2025.

### 3.2 Population
500 patients (100 per stratum), enrolled Q1-Q2 2027, stratified by:

| Stratum | Definition | Target N |
|---------|-----------|----------|
| A | IWGDF risk 0-1 · biomekaniske symptomer | 100 |
| B | IWGDF risk 2 · PAD + LOPS | 100 |
| C | IWGDF risk 3 · prior ulcer/amputation in remission | 100 |
| D | Runners/athletes · sport-podiatri | 100 |
| E | Elderly (75+) · falls-prevention | 100 |

### 3.3 Inclusion criteria
- Voksne (≥ 18 år)
- Referred to Bispebjerg fodterapi-ambulatorium via GP eller egen henvisning
- Kan give informed consent på dansk eller (via tolk) andet EU-sprog
- Ejer smartphone (iOS 17+ eller Android 13+) til home-monitoring subset

### 3.4 Exclusion criteria
- Aktiv DFU (Wagner ≥ 2) uden Total Contact Cast plan
- Charcot arthropathy under akut behandling
- Malignitets-mistanke (uafhængig dermatologisk henvisning obligatorisk)
- Alvorlig kognitiv reduktion der forhindrer consent
- Deltager i konkurrerende medical-device trial i studieperioden

---

## 4. Interventions

### 4.1 Study workflow
1. **Baseline visit (Uge 0):**
   - Standard fodterapi-vurdering + FFI/FAAM baseline
   - PraxisOS-scan (smartphone video 6-12 sek, kalibreret ArUco-plakat)
   - Vaskulær + neurologisk assessment (mandatory hvis IWGDF ≥ 1)
   - Practitioner reviewer AI-forslag inden clinic-visit-slut
2. **Orthotic prescription (Uge 1-2):**
   - Neural Configurator genererer 16-parameter vektor + practitioner-godkendelse
   - Vorum mill produktion 3-5 dage
   - Levering + tilpasning
3. **Follow-up 1 (Uge 6):**
   - FFI/FAAM re-measure
   - Follow-up PraxisOS-scan → longitudinal drift-detection
4. **Follow-up 2 (Uge 12):**
   - Endelig endpoint-vurdering
   - Sygesikringen-afregnings-cycletime dokumenteret

### 4.2 Sham/control comparator
Matched historical controls fra Bispebjerg's 2024-2025 patient-register (samme stratum-fordeling), pre-PraxisOS baseline.

---

## 5. Endpoints

### 5.1 Primary endpoints
- **E1:** Cohen's kappa concordance (AI vs blinded panel) · target ≥ 0.75 · CI 95 %
- **E2:** Serious adverse events attributable to AI-recommendation · target 0
- **E3:** Practitioner documentation time · target ≥ 40 % reduction vs baseline

### 5.2 Secondary endpoints
- **E4:** Practitioner accept-rate distribution (60-80 %)
- **E5:** Sygesikringen claim submission-to-payout cycletime reduction (≥ 30 %)
- **E6:** FFI/FAAM improvement ≥ MID at 12 uger
- **E7:** Ingen dokumenterede INV-CS-6 / INV-CS-7 breaches
- **E8:** 100 % findings have `ai_generated: true` og provenance-spans

### 5.3 Safety endpoints
- **S1:** Any adverse event within 12 uger, attributable to AI-recommendation (Sponsor + PRRC review)
- **S2:** Practitioner-overridden AI-recommendations tracked (post-market surveillance signal)
- **S3:** Escalation-flag accuracy vs subsequent clinical outcomes (sensitivity/specificity)

---

## 6. Sample Size Justification

Assumptions:
- Expected agreement rate 87 % · baseline agreement 82 % (retrospective)
- Cohen's kappa target 0.75 · effect size 0.10
- Alpha 0.05 · Power 0.90
- Attrition 15 %

n = 500 provides 95 % CI half-width < 0.05 for kappa · sufficient stratified analysis N ≥ 100/stratum.

---

## 7. Statistical Analysis Plan

### 7.1 Primary analysis
- Cohen's kappa overall + stratified · 95 % CI via bootstrap resampling n=1000
- Non-inferiority test vs 0.60 minimum acceptable kappa
- Fitzpatrick I-VI subgroup analysis for bias-audit compliance

### 7.2 Secondary analyses
- Documentation-time delta · paired-Wilcoxon signed rank
- Sygesikringen cycletime · Kaplan-Meier + log-rank vs historical control
- FFI/FAAM · repeated-measures ANOVA with covariates (age, IWGDF, orthotic-type)

### 7.3 Safety analysis
- Any adverse event reviewed by PRRC + external CRO (Presafe DK · IEC 62366 usability-audit)
- Interim safety review at n=100 (Q1 2027)

---

## 8. Ethical Considerations

### 8.1 Governance
- **Videnskabsetisk Komité** (Region Hovedstaden) approval pending
- **Datatilsynet** DPIA + tilsynsanmeldelse (Sundhedsloven §42a-d)
- **DPO** engagement via ReNew-DK

### 8.2 Informed consent
- Skriftlig samtykke · gennemlæst med patient og signeret inden baseline visit
- Sundhedsstyrelsens standard `Informationsmateriale om deltagelse i sundhedsvidenskabeligt forskningsprojekt` bruges
- Consent kan trækkes tilbage når som helst uden konsekvens for standard-behandling

### 8.3 Data protection
- Alle patient-data pseudonymiseret via CPR-hash (SHA-256 · aldrig rå)
- Data-lokation Supabase EU-West (Ireland) · GDPR Art. 46 SCC signed
- Data retention 7 år (klinisk journal-lov) · derefter destrueret

### 8.4 Compensation
- Ingen kompensation til patient-deltagere (standard NHS-DK studie-praksis)
- Rejseudgifter refunderet efter Region Hovedstadens takster

---

## 9. Reporting & Publications

- Study registration: EU Clinical Trials Register (EudraCT) + ClinicalTrials.gov
- Primary publication: peer-reviewed medical journal (target: BMJ Open eller Journal of Foot and Ankle Research)
- SPIRIT + CONSORT reporting standards
- Data-sharing: aggregate results shared via DAKISS (Danish Clinical Research Sharing Standard) upon publication

---

## 10. Study Team

| Rolle | Person |
|-------|--------|
| Sponsor | ReNew-DK ApS (Michael Ambrosius, CEO) |
| Principal Investigator | [udfyldes · Bispebjerg leder for Motion & Gait Lab] |
| Study coordinator | [udfyldes] |
| PRRC (MDR) | [udfyldes · engageret Sprint 1] |
| DPO | [udfyldes] |
| External CRO | Presafe DK (usability-audit IEC 62366) |
| Data Safety Monitoring Board | 3 externe · TBD |

---

## 11. Timeline

| Milestone | Date |
|-----------|------|
| Protocol submission (VEK + Datatilsynet) | 2026-08-15 |
| Approvals received | 2026-11-30 |
| First patient enrolled | 2027-02-01 |
| Enrollment complete | 2027-08-31 |
| Follow-up complete | 2027-12-31 |
| Primary analysis + report | 2028-03-31 |
| Publication submitted | 2028-06-30 |
| CE-mark submission (integrated) | 2028-Q3 |

---

## 12. Amendments

Alle protocol-ændringer godkendes af VEK inden implementation. Versioneres i separat `AMENDMENTS.md` med date + rationale.

---

*Protocol draft · afventer Michael's underskrift + PI-udpegning ved Bispebjerg · VEK submission Q3 2026.*
