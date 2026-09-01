> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.


# Pre-Submission Meeting Request · PraxisOS Clinical Decision Support Software

**Til:** Presafe DK · Notified Body 2696
**Vedr.:** Anmodning om pre-submission meeting for Class IIa Software as Medical Device (SaMD)
**Fra:** Michael Ambrosius · ReNew-DK ApS (CVR: [udfyldes]) · CEO
**Dato:** [Sprint 1 · uge 1]
**Kontakt:** ma@keap.me · [telefon]

---

Kære Presafe-team,

Vi anmoder hermed om et pre-submission meeting angående CE-mærkning af PraxisOS, et cloud-baseret klinisk beslutningsstøtte-software til podiatriske klinikker. Vi vurderer produktet som **Class IIa Software as Medical Device** under MDR 2017/745 · MDCG 2019-11 Rev.1 (2023) · Rule 11.

Vi tilstræber en pragmatisk gennemførelse med en realistisk klinisk-evidens-plan og ønsker at afklare produktets korrekte klassifikation samt jeres kapacitet før vi indleder klinisk evaluation.

## 1. Producent

| Felt | Værdi |
|------|-------|
| Legal manufacturer | ReNew-DK ApS |
| CVR | [udfyldes] |
| Adresse | [Danmark] |
| PRRC (Person Responsible for Regulatory Compliance) | [udpeges — engagement pending] |
| Kontaktperson pre-submission | Michael Ambrosius, CEO |

## 2. Produktnavn og version

**PraxisOS Clinical Decision Support** (klinisk delmængde) — bestående af følgende komponenter:

- **AI-Scribe (Niels)** — genererer SOAP-note-udkast fra klinisk konsultation
- **Clinical Scanner** — VLM-baseret analyse af 3D-fod-scan med finding-detektion (calluses, ulcera, hallux valgus, verrucae, dermatologiske anomalier)
- **Neural Configurator** — genererer 16-parameter ortopædisk indlægs-parametrisering baseret på scanner-findings + biofysisk inversion
- **Patient Coach (Liv)** — asynchron rådgivning til klienter i behandlingsforløb

**Non-medical komponenter (Class 0, uden for scope for denne ansøgning):** booking (Aria), tilskudsberegning (Sigrid), fakturering (Vega), rute-optimering (Bjørn), marketing (Magnus), platform-engineering (Atlas), compliance-agent (Frej).

## 3. Intended Use / Purpose Statement

**Intended Use:** PraxisOS Clinical Decision Support er beregnet til at understøtte autoriserede sundhedspersoner (fodterapeuter, ortopædkirurger, almen praksis-læger) i:

1. **Dokumentation** af klinisk konsultation via ambient AI-transskription og struktureret SOAP-udkast, som klinikeren gennemgår, redigerer og godkender inden persistering i patientjournalen.
2. **Detektion** af potentielle dermatologiske og biomekaniske abnormaliteter i fod-billeder og 3D-scans, herunder callus, hyperkeratose, ulcera, hallux valgus, pes planus, verrucae — som klinisk-beslutningsstøtte, ikke som autonom diagnose.
3. **Parametrisering** af ortopædiske indlæg (16-vektor) baseret på detekterede anomalier og biofysisk analyse, som forslag til den behandlende ortopæd-tekniker/CPed, som validerer og modificerer inden ordination.
4. **Klient-coaching** mellem konsultationer via asynkron chat med evidens-baserede fodplejeråd (uden medicinsk rådgivning).

**Intended Users:** Autoriserede sundhedspersoner i EU (podiatriske klinikker, hospitalsambulatorier, private praksisser). Ikke beregnet til direct-to-consumer brug uden sundhedspersons involvering.

**Intended Patient Population:** Voksne (18+) med foot-related symptomatik, herunder patienter med diabetes mellitus (særligt IWGDF risk 1-3), plantar fasciitis, hallux valgus, dermatologiske fodproblemer, samt biomekaniske funktionsforstyrrelser der berettiger ortopædisk indlæg.

**Contraindications:** Ikke beregnet til:
- Pædiatriske patienter (under 18 år)
- Akutte kirurgiske vurderinger (fx traumer, akut infektion, kritisk lem-iskemi som kræver akut revaskularisering)
- Charcot-fod-diagnostik uden supplerende røntgen/MR
- Diabetiske fodsår (aktive) — kræver total contact cast + kirurgisk offloading; softwaren afviser at generere ortopædisk indlæg for aktive DFU'er
- Malignitetsvurdering (melanoma-mistanke → obligatorisk henvisning til dermatolog)

## 4. Foreslået klassifikation

**Class IIa · MDR 2017/745, Annex VIII, Rule 11**

Argumentation: Softwaren "provides information which is used to take decisions with diagnosis or therapeutic purposes" (MDCG 2019-11 Rev.1 §5.2), specifikt:

- ICD-10-kandidater i SOAP-udkast (Niels)
- Escalation-flag på scanner-findings (Scanner)
- Ortopædisk indlægs-parametrisering (Configurator)

Ingen af de kliniske output er "used to make decisions that may cause death or an irreversible deterioration of a person's state of health" (som ville udløse Class III), da:

- Alle output er markeret `ai_generated=true` og kræver eksplicit klinisk godkendelse via typed initials + accept/reject flow inden persistering
- Ingen autonom medicinsk beslutning (INV-CS-7 håndhævet i software)
- Aktive DFU'er, malignitetsmistanke og akut iskemi udløser tvungen henvisning uden autonom vurdering

**Parallel-track:** Softwaren er også et AI-system under EU AI Act. Vi følger begge tracks parallelt og planlægger harmonisering af risk management (ISO 14971 + AI Act Art. 9) og logging (Art. 12) via en enkelt QMS-instans.

## 5. Teknisk arkitektur (kort)

- **Frontend:** Next.js 16 · React 19 · TypeScript 5.7 · Tailwind 4
- **Backend:** Supabase (Postgres 17 + pgvector + RLS) · region EU-West (Ireland)
- **Deployment:** Vercel · region Frankfurt (fra1)
- **LLM/VLM inference:** Anthropic Claude Sonnet 4.7 via AWS Bedrock EU-region (data-residency-clean)
- **Voice plane (Sprint 2):** LiveKit self-hosted EU-North-1 · Deepgram Nova-3 Medical (da-DK streaming)
- **Multi-tenant isolation:** Postgres Row-Level Security · cross-tenant leak strukturelt umuligt
- **PII-håndtering:** CPR-numre lagres kun som SHA-256 hash + masked (`XXXXXX-1234`) · aldrig som råtekst i AI-context

## 6. Klinisk evidens-plan

**Retrospektiv fase (Sprint 1-4):**
- 200 anonymiserede scans fra pilot-klinik (by Pilar, CVR 43947079)
- Concordance-analyse mod blinded panel af 5-7 danske fodterapeuter (kappa ≥ 0.75 target)
- Bias-analyse stratificeret pr. Fitzpatrick I-VI, IWGDF risk 0-3, aldersgrupper og sprog-baggrund

**Prospektiv fase (post-CE-mark trial-tilladelse):**
- 500-patient multi-center studie ved Bispebjerg Motion & Gait Lab + 2-3 pilot-klinikker
- Primære endpoints: dokumentations-tidsreduktion, findings-concordance, patient-safety-events
- Sekundære endpoints: Sygesikringen-afregnings-cycletime, klient-outcome (FFI, FAAM ved orthotic-brug)

**Shadow-mode:** Alle Class-IIa-komponenter kører i shadow mode (praktikeren ser ikke output) i mindst 6 måneder inden go-live, per Duke Sepsis Watch playbook (Sendak npj Digital Medicine 2020).

## 7. QMS status

- **ISO 13485:2016** — QMS scaffold under opbygning · target certificering Q4 2026
- **IEC 62304:2006+A1:2015** — Software lifecycle-plan skrevet · SOUP-inventar under kompilering
- **ISO 14971:2019** — Risk file skeleton påbegyndt · vil harmonisere med AI Act Art. 9
- **IEC 82304-1** — Health software lifecycle · vurderes i pre-submission
- **ISO 27001** — Ikke certificeret endnu · Supabase + Vercel + AWS er alle SOC2 / ISO 27001-certificerede sub-processors
- **GDPR + Sundhedsloven §42a-d** — DPIA under udarbejdelse · datalog aftalt med Datatilsynet-format

## 8. Ønsket dagsorden for pre-submission meeting

1. **Klassifikations-validering** — bekræftelse af Class IIa Rule 11 for de fire kliniske komponenter
2. **Notified Body kapacitet** — jeres nuværende sagsbehandlingstid (uger til første audit)
3. **Klinisk evaluation** — jeres krav til retrospektiv vs prospektiv evidens for AI-baseret SaMD i vores kategori
4. **QMS-audit gate** — timing af ISO 13485-audit ift. teknisk fil-review
5. **AI Act harmonisering** — jeres erfaring med parallel MDR + AI Act-track
6. **Post-market surveillance** — jeres forventninger til drift-monitorering og periodic safety update reports (PSUR) for AI-modeller med model-drift-risiko
7. **Budget + tidslinje** — realistiske estimater for engagement gennem CE-mark (vi forventer 14-22 måneder, €430-700k jf. Corti-precedent for OHCA-detection)

## 9. Ønsket møde-format

- **Format:** Teams-møde eller fysisk møde i København efter jeres præference
- **Varighed:** 60-90 minutter
- **Deltagere fra os:** Michael Ambrosius (CEO), [PRRC når engaget], [Klinisk konsulent når engaget]
- **Fortrolighed:** Vi accepterer jeres standard NDA · alt materiale kan deles under NDA før mødet

## 10. Bilag (vedhæftes ved formel ansøgning)

- [A] Software Architecture Overview
- [B] Intended Use + Contraindications (fuld version)
- [C] Preliminary Risk Analysis (ISO 14971 skeleton)
- [D] Clinical Evaluation Plan (MEDDEV 2.7/1 rev.4 outline)
- [E] SOUP Inventory (langchain, three.js, react-three-fiber, anthropic-sdk, replicate, supabase, zod, drei, culori, deepgram-sdk, livekit-server-sdk — alle klassificeret efter IEC 62304 §5.3.4)
- [F] Data Protection Impact Assessment (DPIA) draft
- [G] Manufacturer's Declaration of Conformity — draft
- [H] Post-Market Surveillance Plan — draft

---

Vi imødeser jeres tilbagemelding om første ledige tidsslot. Vi er fleksible og kan møde inden for 2 uger fra bekræftelse.

Med venlig hilsen,

**Michael Ambrosius**
CEO, ReNew-DK ApS
ma@keap.me
[telefon]

---

*Dette dokument er genereret som draft — Michael skal underskrive og udfylde de resterende felter ([CVR], [telefon], [adresse]) samt engagere PRRC + klinisk konsulent inden afsendelse. Bilag A-H udarbejdes i Sprint 1-2 parallelt med Presafe-processen.*
