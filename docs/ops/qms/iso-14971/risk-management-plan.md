> **Archive port (additive)** · Source: Google Drive monorepo checkout `praxisos/` (juli 2026 snapshot). GitHub monorepo remote was 404. Historical / human-track material — **not** live production SoT. Do not treat claims here as current product behavior without verifying against `main` code.
>
> Ported for Michael Ambrosius (Broser) · PraxisOS · no Clerk · no vendor weights · no prod DB flip.


# PraxisOS — Risk Management Plan (ISO 14971)

Status: skeleton — sprint 7. Dette dokument dækker §4–§8 af ISO 14971:2019 for PraxisOS'
kliniske komponenter (scanner-pipeline, orthotic-konfigurator, e-learning-modul,
orchestrator-dispatch). Det skal læses sammen med [`hazard-log.md`](./hazard-log.md), som
indeholder den konkrete risikoregistrering, og [`INV-hazard-map.csv`](./INV-hazard-map.csv),
som forbinder kodens invariant-checks (INV-koder) til de identificerede farer.

## §4 Generelle krav til risikostyringsprocessen

PraxisOS' risikostyringsproces er integreret i udviklingsflowet fremfor at være et
efterfølgende compliance-trin. Hver invariant i koden (`INV-CS-*` for scanner/clinical-safety,
`INV-NC-*` for neural configurator, `INV-EL-*` for e-learning) er den tekniske
implementering af en risikokontrol, og enhver ny invariant, der tilføjes til
`prototype/lib`, skal have en tilsvarende række i `INV-hazard-map.csv` samt en vurderet
hazard i `hazard-log.md` før den kan anses for lukket. Risikostyringsprocessen ejes af
udviklingsteamet i samarbejde med klinisk fagansvarlig og dækker hele produktets livscyklus
fra design gennem produktion til post-market. `inv-known-gaps.json` fungerer som et
ratchet-baseret sporingsdokument: listen over invarianter uden testdækning må aldrig vokse,
kun krympe, hvilket sikrer at risikostyringsprocessen har et håndgribeligt, monotont
fremdriftsmål frem mod sprint 8's mål om nul kendte gaps. Alle risikovurderinger i dette
dokument og i hazard-log skal opdateres, hver gang koden ændrer en invariant, en ny
klinisk funktion introduceres, eller en post-market-hændelse afdækker en hidtil ukendt fare.

## §5 Risikoanalyse

Risikoanalysen tager udgangspunkt i to kilder: den statiske kodeanalyse af invariant-checks
(`grep INV-` over `prototype/lib`) og det levende gap-register i
`prototype/tests/inv-known-gaps.json`. For hver identificeret fare i hazard-log er der
foretaget en analyse af den tilsigtede anvendelse — et klinisk beslutningsstøtte- og
konfigurationssystem til ortopædisk indlægssåle-fremstilling, der involverer AI-genererede
scanner-findings (VLM/MedSAM), automatiseret geometri-eksport til fysisk fremstilling, og en
patientvendt e-learning-komponent, der kan håndtere personhenførbare sundhedsdata inklusive
CPR-numre. Farekæder er sporet fra rodårsag (fx manglende `ai_generated`-flag, manglende
watertight-verifikation, manglende PII-redaktion) til den kliniske eller
databeskyttelsesmæssige konsekvens, som beskrevet i hazard-logs `description`-kolonne.
Otte hazard-klasser er identificeret i denne iteration: silent-stub clinical output,
cross-tenant data-lækage, session-forfalskning, GPU-budgetoverskridelse, timeout uden
audit-spor, VLM-hallucination, MedSAM/mill-adapter-fejl, og klient-CPR i logs. Analysen er
ikke udtømmende — den dækker de farer, der allerede har et modsvar i kodens invariant-lag
eller i det kendte gap-register, og skal udvides efterhånden som nye kliniske
brugsscenarier og AI-komponenter tilføjes systemet.

## §6 Risikoevaluering

Hver hazard i hazard-log er scoret på en severity-skala (1–5, klinisk/databeskyttelsesmæssig
alvorlighed) og en probability-skala (1–5, sandsynlighed for forekomst givet nuværende
mitigation), hvor risikoscore beregnes som produktet af de to. Acceptkriteriet for PraxisOS
i denne fase er: enhver hazard med residualrisiko vurderet til "Medium-Høj" eller derover
skal have en aktiv, sporbar lukningsplan (enten en ny invariant under udvikling eller en
eksplicit post-market-overvågningsforanstaltning) og må ikke forlade sprintet uadresseret.
Hazards, hvor mitigationen findes i kode, men testdækningen mangler — som i dag gælder
INV-CS-13 (pipeline-timeout uden verificeret audit-logning) — er eksplicit markeret som
"Medium-Høj (åben gap)" i hazard-log fremfor at blive nedgraderet på baggrund af en
util-testet antagelse om at koden virker som tiltænkt. Hazards uden en dedikeret,
testbar invariant i kodebasen — i denne iteration cross-tenant data-lækage og
session-forfalskning — er vurderet ud fra indirekte mitigation og er derfor ikke nedskrevet
til "Lav", uanset at ingen konkret hændelse er observeret; fraværet af evidens for et
problem er ikke det samme som evidens for fraværet af risikoen.

## §7 Risikokontrol

Risikokontrolforanstaltningerne i PraxisOS er implementeret som håndhævede invarianter i
kodebasen fremfor som proceduremæssige retningslinjer alene, hvilket giver et højere
kontrolniveau end rent administrative foranstaltninger. Eksempler inkluderer: obligatorisk
Zod-refine på `ai_generated`-feltet, der forhindrer at syntetiske/mock-data forlader
scanner-pipelinen umærket (INV-CS-6); et hårdt GPU-timebudget håndhævet før ressourceforbrug
igangsættes fremfor efter (INV-CS-14); dobbelt watertight-verifikation af 3D-geometri både
før og efter STL-eksport (INV-CS-1, INV-CS-2); og obligatorisk PII-redaktion ved samtlige
identificerede injektionspunkter for klient-kontekst og VLM-output (INV-CS-11, INV-EL-4).
Hvor en risikokontrol i dag alene eksisterer som kodet invariant uden tilhørende automatiseret
test — sporet via `inv-known-gaps.json` — betragtes kontrollen som ikke-verificeret og
indgår ikke i beregningen af residualrisiko, før testdækningen er på plads og koden er
fjernet fra gap-listen. Restrisiko efter implementering af kontrolforanstaltninger er
dokumenteret per hazard i hazard-logs `residual_risk`-kolonne, og hvor en fare mangler en
dedikeret kodekontrol (cross-tenant isolation, session-integritet), er dette eksplicit
noteret som en åben handling for et kommende sprint fremfor at blive skjult bag en generisk
"mitigeret"-status.

## §8 Evaluering af samlet resterende risiko

Den samlede resterende risiko for PraxisOS' kliniske komponenter i denne sprint vurderes som
acceptabel til fortsat intern udvikling og testning, men ikke som fuldt lukket for
produktionsfrigivelse, så længe (a) INV-CS-13 mangler verificeret testdækning for
timeout-audit-logning, og (b) cross-tenant isolation og session-integritet mangler
dedikerede, testbare invarianter i `prototype/lib`. Den samlede risikobalance skal
revurderes ved hvert sprint-review i lyset af fremdriften på `inv-known-gaps.json`
(målsætning: nul kendte gaps ved sprint 8) og ved enhver ændring i hazard-log. Beslutningen
om samlet acceptabilitet er truffet under forudsætning af, at ingen af de i hazard-log
identificerede farer med "Medium-Høj"-restrisiko når produktionsmiljøet, før de tilhørende
lukningsplaner er gennemført og verificeret ved automatiseret test — jf. kravet i §7 om at
kontroller uden testdækning ikke tæller som verificerede i risikoregnskabet.
