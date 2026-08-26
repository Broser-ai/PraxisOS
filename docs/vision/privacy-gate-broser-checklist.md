# Privacy-gate · Broser godkendelsespakke (EU DPA)

**Status:** bindende før SHADOW_ONLY billedtrafik til custom Roboflow  
**Målgruppe:** Broser (menneskelig godkender)  
**Kilde:** `privacy-gate.md` · `model-governance.md` ·  
`workflows/del-pilar-nexus-shadow-evaluation.json`  
**Kode:** `lib/scanner/privacy-gate.ts` (fail-closed)

---

## Formål

Operationalisere privacy-gate, så **ingen** kliniske fod-billeder (GDPR art. 9)
sendes til custom Roboflow-endpoints — heller ikke i **SHADOW_ONLY** parallel
inference — før denne pakke er **PASS**.

> **Gate er lukket som standard.** Agenter må ikke åbne den. Kun Broser kan
> godkende. Agenter **kan ikke self-approve**.

---

## Påkrævede godkendelser (navngivne roller)

Alle roller skal være **mennesker** (ikke agent/CI/bot). Navn + dato + audit-id
skal registreres.

| # | Rolle | Ansvar | Signatur / audit |
|---|--------|--------|------------------|
| 1 | **Broser (privacy-godkender)** | Endelig PASS/FAIL på hele pakken; skriver immutable audit-event | Påkrævet |
| 2 | **DPA / juridisk reviewer** | Bekræfter underskrevet DPA med processoren | Påkrævet |
| 3 | **Residens-reviewer** | Bekræfter godkendt EU-region / processing route | Påkrævet |
| 4 | **Retention-ejer** | Bekræfter slette-/retention-politik for inference I/O | Påkrævet |

**Forbudt:** agent, Cursor Cloud Agent, CI-job, bot eller “system” som godkender.
Self-approval af den, der oprettede draft-PR’en, er ikke gyldig Broser-godkendelse.

---

## DPA / residens / retention — tjekliste

Markér hvert punkt. **Alle** skal være PASS for at samlet gate kan åbnes.

### A. Destination

| ID | Krav | PASS | FAIL |
|----|------|------|------|
| `private_project` | Målprojekt/-endpoint er **privat** (ikke offentligt Universe til træning/deling) | ☐ | ☐ |
| `eu_route_documented` | Godkendt **EU data-processing route** er dokumenteret (processor, region, formål, retsgrundlag) | ☐ | ☐ |

### B. DPA

| ID | Krav | PASS | FAIL |
|----|------|------|------|
| `dpa_signed` | Underskreven **DPA** (databehandleraftale) med processoren findes og er arkiveret | ☐ | ☐ |

### C. Residens

| ID | Krav | PASS | FAIL |
|----|------|------|------|
| `residency_reviewed` | **Residens-review** bestået — data forbliver i godkendt EU-region | ☐ | ☐ |

### D. Retention

| ID | Krav | PASS | FAIL |
|----|------|------|------|
| `retention_policy_set` | **Retention-politik** angivet (hvornår slettes inference-input/output) | ☐ | ☐ |

### E. Menneskelig godkendelse

| ID | Krav | PASS | FAIL |
|----|------|------|------|
| `human_approver` | Navngiven Broser-godkender registreret (ikke agent) | ☐ | ☐ |
| `privacy_audit_event` | Immutable audit-event id skrevet (fx `privacy.gate.passed`) | ☐ | ☐ |

---

## Eksplicitte PASS / FAIL-gates

### Samlet resultat

| Resultat | Betingelse | Konsekvens |
|----------|------------|------------|
| **PASS** | Alle ID’er ovenfor er PASS **og** Broser har skrevet audit-event | Custom SHADOW_ONLY billedupload må overvejes (stadig uden active routing) |
| **FAIL / CLOSED** | Ét eller flere ID’er mangler, er FAIL, eller godkender er agent/self | **Ingen** billedtrafik til custom Roboflow-endpoints |

### Hard FAIL (øjeblikkelig blokering)

- Offentligt Universe-projekt som destination
- Manglende eller ugyldig DPA
- Residens uden for godkendt EU-route
- Manglende retention-politik
- Manglende navngiven Broser-godkender eller audit-event
- Agent / bot forsøger at “godkende”
- Forsøg på at sætte `approved_for_active_routing: true` uden separat promotion-pakke

### Base64 er ikke en privacy-kontrol

At sende billedet som **base64** i request-body ændrer **ikke** processor,
residens eller DPA-status. Gate gælder for **enhver** billedoverførsel.

---

## SHADOW_ONLY · billedtrafik

| Regel | Status |
|-------|--------|
| SHADOW_ONLY parallel inference **må ikke** sende billeder, før denne gate er PASS | **Bindende** |
| Registry/config for shadow-workflow må eksistere uden billedupload | Tilladt |
| `deployment_state: shadow_only` | Forventet |
| `approved_for_active_routing` | **Skal forblive `false`** (åbnes ikke af denne pakke) |
| Produktions-pins / thresholds / patientcopy / retention i drift | **Uændret** af denne pakke |

Kode-guard (fail-closed):

- `lib/scanner/privacy-gate.ts` → `getPrivacyGateStatus()` / `isPrivacyGateOpen()` /
  `maySendImagesToCustomRoboflow()` / `mayRunShadowOnlyImageInference()`
- `lib/scanner/shadow-inference.ts` → `runShadowEval()` springer over med
  `skip_reason: "privacy_gate"` indtil PASS; kræver også
  `PRAXIS_SHADOW_EVAL_ENABLED` (**default OFF**)
- `approved_for_active_routing` forbliver `false`

Uden Broser-env + navngiven menneskelig godkender returnerer helpers **false**
(gate lukket). Agent-/bot-navne i `human_approver` er automatisk FAIL.

---

## Agenter må ikke self-approve

Agenter og automatisering **må**:

- opdatere denne tjekliste som draft,
- pege på huller,
- tilføje tests der beviser fail-closed.

Agenter **må ikke**:

- sætte PASS på egne vegne,
- udfylde `human_approver` med agent-/bot-navn,
- enable shadow billedflag eller åbne privacy-env i produktion,
- merge, deploy eller sætte `approved_for_active_routing`.

---

## Broser registrering (udfyldes ved PASS)

```
Dato:
Broser-godkender (fulde navn):
DPA-reviewer:
Residens-reviewer:
Retention-ejer:
Audit-event id:
Processor / region:
Retention-reference:
Samlet resultat: PASS / FAIL
```

Efter PASS: opdatér kun de aftalte privacy-env-flag (se `lib/scanner/privacy-gate.ts`)
under Broser-kontrol. **Aktiv routing** kræver separat promotion jf.
`model-governance.md` — ikke denne pakke.
