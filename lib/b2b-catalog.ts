// Offentlig B2B-katalog · fodplejere der køber PraxisOS-licens
// Layout inspireret af terapeutbooking.dk/funktioner (faner + kort).

export type B2bCategoryId =
  | "kerne"
  | "klient"
  | "betaling"
  | "tilbud"
  | "team"
  | "sikkerhed"
  | "sundhed"
  | "ai"
  | "integrationer";

export type B2bCategory = {
  id: B2bCategoryId;
  label: string;
};

export type B2bFeature = {
  slug: string;
  categoryId: B2bCategoryId;
  title: string;
  summary: string;
  /** Detaljeside */
  body: string[];
  bullets: string[];
  planHint?: string;
};

export const B2B_CATEGORIES: B2bCategory[] = [
  { id: "kerne", label: "Kernefunktionalitet" },
  { id: "klient", label: "Klient & kalender" },
  { id: "betaling", label: "Regnskab & betaling" },
  { id: "tilbud", label: "Klienttilbud" },
  { id: "team", label: "Flere behandlere" },
  { id: "sikkerhed", label: "Sikkerhed" },
  { id: "sundhed", label: "Sundhedsvæsen & forsikring" },
  { id: "ai", label: "AI & automation" },
  { id: "integrationer", label: "Integrationer" },
];

export const B2B_FEATURES: B2bFeature[] = [
  // —— Kerne ——
  {
    slug: "online-booking",
    categoryId: "kerne",
    title: "Online booking",
    summary: "Lad dine klienter booke en tid direkte i din kalender — på din egen hjemmeside.",
    body: [
      "Klienter vælger behandling, behandler og tid uden at ringe. PraxisOS synkroniserer med din klinikkalender og viser kun ledige slots.",
      "Du kan indlejre booking på din klinik-hjemmeside, så kunderne ser dit brand — ikke vores.",
    ],
    bullets: [
      "Embed på egen hjemmeside",
      "Behandlinger, tillæg og varighed",
      "SMS- og e-mail-påmindelser",
      "Venteliste ved fulde dage",
    ],
    planHint: "Inkl. i Practice",
  },
  {
    slug: "journaler",
    categoryId: "kerne",
    title: "Journaler",
    summary: "Opret klientjournaler med tekst, billeder, filer og samtykke — bygget til sundhedsdata.",
    body: [
      "Journalen følger klienten på tværs af besøg. Du får skabeloner til fodpleje, foto-dokumentation og fuld audit.",
    ],
    bullets: ["SOAP / fritekst", "Foto & filer", "GDPR Art. 9-samtykke", "E-signering"],
    planHint: "Inkl. i Practice",
  },
  {
    slug: "email-sms",
    categoryId: "kerne",
    title: "E-mail og SMS",
    summary: "Påmindelser, bekræftelser og opfølgning — tilpasset din klinik.",
    body: [
      "Automatiske beskeder før og efter behandling. Brug NemSMS til kritiske beskeder, eller almindelig SMS/e-mail til marketing.",
    ],
    bullets: ["Bookingbekræftelse", "Påmindelse før tid", "No-show opfølgning", "Skabeloner du selv redigerer"],
    planHint: "Inkl. · forbrug på SMS",
  },
  {
    slug: "online-betaling",
    categoryId: "kerne",
    title: "Online betaling",
    summary: "Modtag betaling ved booking eller i klinikken — MobilePay, kort og mere.",
    body: [
      "Klienter kan betale online ved booking, eller du tager betaling i klinikken. Settlement til NemKonto.",
    ],
    bullets: ["MobilePay & kort", "Auth-only / capture ved fremmøde", "Refund ved aflysning", "Daglig settlement"],
    planHint: "Inkl. · tx-gebyr",
  },
  {
    slug: "fakturering",
    categoryId: "kerne",
    title: "Fakturering",
    summary: "Nem administration af betaling fra klienter — og senere forsikring/ydelser.",
    body: [
      "Hold styr på betalte, ubetalte og delvist betalte ydelser. Klar til eksport til dit regnskabssystem.",
    ],
    bullets: ["Klientbetalinger", "Klippekort-forbrug", "Eksport til bogføring", "Oversigt per periode"],
    planHint: "Inkl. i Practice",
  },
  {
    slug: "statistik",
    categoryId: "kerne",
    title: "Statistik",
    summary: "Nemt overblik over din klinik i tal — belægning, omsætning og no-shows.",
    body: [
      "Se hvordan ugen går: bookede tider, aflysninger, populære behandlinger og omsætning.",
    ],
    bullets: ["Belægning", "Omsætning", "No-show rate", "Top-behandlinger"],
    planHint: "Inkl. i Practice",
  },

  // —— Klient & kalender ——
  {
    slug: "aftalestatus",
    categoryId: "klient",
    title: "Aftalestatus",
    summary: "Sæt status på aftaler — ankommet, udeblevet, aflyst — så overblikket er klart.",
    body: ["Marker fremmøde og no-show direkte i kalenderen. Status driver påmindelser og statistik."],
    bullets: ["Ankommet / udeblevet", "Aflyst af klient / klinik", "Synlig i dagsplan", "Driver no-show-tal"],
  },
  {
    slug: "ekstra-felter",
    categoryId: "klient",
    title: "Ekstra felter",
    summary: "Tilføj egne felter til klienter og booking — tilpasset din fodplejepraksis.",
    body: ["Samle de oplysninger du faktisk bruger: diabetes, medicin, særlige hensyn, skostørrelse m.m."],
    bullets: ["Klientfelter", "Bookingfelter", "Synlige i journal", "Valgfrie / påkrævede"],
  },
  {
    slug: "klient-tags",
    categoryId: "klient",
    title: "Klient-tags",
    summary: "Organisér klienter med tags til overblik og målrettet kommunikation.",
    body: ["Tag fx «plejehjem», «diabetes», «VIP» eller «hjemmebesøg» — filtrér og skriv til segmenter."],
    bullets: ["Fri tagging", "Filtrér i klientliste", "Segmenteret SMS/e-mail", "Hurtig søgning"],
  },
  {
    slug: "venteliste",
    categoryId: "klient",
    title: "Venteliste",
    summary: "Lad klienter stå på venteliste og få tilbudt tider ved aflysninger.",
    body: ["Når en tid bliver ledig, kan PraxisOS tilbyde den videre — færre huller i kalenderen."],
    bullets: ["Tilmelding ved fuld dag", "Auto-tilbud ved aflysning", "Prioritet efter oprettelse", "SMS-besked"],
  },
  {
    slug: "tillægsydelser",
    categoryId: "klient",
    title: "Tillægsydelser",
    summary: "Tilføj tillæg til primær behandling — fx lak, aftagning eller ekstra tid.",
    body: ["Klienter vælger tillæg i booking-flowet. Pris og varighed lægges automatisk oveni."],
    bullets: ["Koblet til hovedydelse", "Pris + varighed", "Synlig i faktura", "Nem prisstyring"],
  },
  {
    slug: "sporgeskemaer",
    categoryId: "klient",
    title: "Spørgeskemaer",
    summary: "Send spørgeskema før eller efter behandling — automatisk eller manuelt.",
    body: ["Indhent helbredsoplysninger før første besøg, eller saml feedback efter behandlingen."],
    bullets: ["Skabeloner", "Automatisk udsendelse", "Svar i klientkort", "Statistik over svar"],
  },

  // —— Betaling ——
  {
    slug: "abonnementer",
    categoryId: "betaling",
    title: "Abonnementer",
    summary: "Sæt ugentlige, månedlige eller årlige abonnementer op med automatisk betaling.",
    body: ["Ideelt til faste klienter og medlemskab. Automatisk fornyelse og oversigt over aktive abonnementer."],
    bullets: ["Fast interval", "Auto-betaling", "Pause / opsig", "Oversigt i klinikken"],
    planHint: "Tilkøb",
  },
  {
    slug: "ratebetaling",
    categoryId: "betaling",
    title: "Ratebetaling",
    summary: "Send automatisk ratebetalinger til klienter når en større ydelse oprettes.",
    body: ["Fordel større beløb over flere rater — praktisk ved længere forløb eller pakker."],
    bullets: ["Flere rater", "Automatiske opkrævninger", "Status per rate", "Påmindelse ved restance"],
    planHint: "Tilkøb",
  },
  {
    slug: "rapporter",
    categoryId: "betaling",
    title: "Rapporter",
    summary: "Modtag daglige, ugentlige eller månedlige oversigtstal til bogføring.",
    body: ["Eksporter omsætning, betalinger og klippekort-forbrug til dit regnskab."],
    bullets: ["Periode-rapporter", "CSV / eksport", "Per behandler", "Per ydelse"],
  },
  {
    slug: "kontakter-betalere",
    categoryId: "betaling",
    title: "Kontakter og betalere",
    summary: "Administrér og fakturér sundhedskontakter og forsikringer — når integrationen er aktiv.",
    body: [
      "Hold styr på hvem der betaler: klient, pårørende eller forsikring. Klar til «danmark» og lignende flows.",
    ],
    bullets: ["Flere betalere", "Forsikringskontakt", "Samlet oversigt", "Kobling til ydelser"],
  },

  // —— Tilbud ——
  {
    slug: "klippekort",
    categoryId: "tilbud",
    title: "Klippekort",
    summary: "Tilbyd klippekort med automatisk indløsning, oversigt og fuld fleksibilitet.",
    body: [
      "Sælg klippekort til fodbehandlinger. Klienter indløser ved booking eller i klinikken — du ser restklip hele tiden.",
    ],
    bullets: ["Salg online & i klinik", "Auto-indløsning", "Restklip synligt", "Udløbsdato valgfri"],
    planHint: "Inkl. i Practice",
  },
  {
    slug: "gavekort",
    categoryId: "tilbud",
    title: "Gavekort",
    summary: "Design og sælg gavekort — fuldt overblik over aktive og indløste.",
    body: ["Klienter køber gavekort online. Modtager får kode eller link — du styrer beløb og gyldighed."],
    bullets: ["Online køb", "Valgfrit beløb", "Indløsning i booking", "Status aktiv/brugt"],
    planHint: "Inkl. i Practice",
  },
  {
    slug: "rabatkoder",
    categoryId: "tilbud",
    title: "Rabatkoder",
    summary: "Opret rabatkoder som beløb eller procent — med valgfri udløbsdato.",
    body: ["Brug koder til kampagner, samarbejdspartnere eller genbooking."],
    bullets: ["Fast beløb / procent", "Udløbsdato", "Brugsgrænse", "Sporing per kode"],
  },
  {
    slug: "foedselsdagsnotifikationer",
    categoryId: "tilbud",
    title: "Fødselsdagsnotifikationer",
    summary: "Tilpas kommunikation eller tilbud på klienters fødselsdag — også automatisk.",
    body: ["Automatisk hilsen eller rabatkode på fødselsdagen. Holder relationen varm uden manuelt arbejde."],
    bullets: ["Auto-udsendelse", "Skabelon-tekst", "Valgfri rabat", "Opt-out respekteres"],
  },

  // —— Team ——
  {
    slug: "medarbejdere",
    categoryId: "team",
    title: "Medarbejdere",
    summary: "Opret flere behandlere i klinikken og angiv rettigheder per rolle.",
    body: ["Hver behandler får egen kalender og login. Du styrer hvem der ser journal, betaling og indstillinger."],
    bullets: ["Flere logins", "Roller & rettigheder", "Egen kalender", "Fælles klientbase"],
    planHint: "Per behandler",
  },
  {
    slug: "ressourcestyring",
    categoryId: "team",
    title: "Ressourcestyring",
    summary: "Undgå dobbeltbookinger af rum og udstyr — bloker på tværs af kalendere.",
    body: ["Book rum, stole eller scanner samtidigt med behandleren, så konflikter fanges før de opstår."],
    bullets: ["Rum & udstyr", "Konflikt-advarsel", "Tværs af behandlere", "Synligt i kalender"],
  },
  {
    slug: "hjemmebesoeg",
    categoryId: "team",
    title: "Hjemmebesøg / felt",
    summary: "Kalender og rute til udekørende fodpleje hos privat, plejehjem og erhverv.",
    body: ["Felt-kalender til hjemmebesøg. Adresse via DAWA, tid til transport og oversigt over dagens rute."],
    bullets: ["Felt-kalender", "Adresseopslag", "Plejehjem / erhverv", "Separat fra klinikdage"],
    planHint: "Tilkøb Felt",
  },
  {
    slug: "indlejere",
    categoryId: "team",
    title: "Indlejere",
    summary: "Opret indlejere med eget login, individuelle rettigheder og egne rapporter.",
    body: ["Når du lejer en stol ud, kan indlejeren arbejde i eget setup uden at se hele klinikkens data."],
    bullets: ["Eget login", "Afgrænset adgang", "Egne rapporter", "Fælles eller separat kalender"],
    planHint: "Clinic-plan",
  },

  // —— Sikkerhed ——
  {
    slug: "mitid",
    categoryId: "sikkerhed",
    title: "MitID",
    summary: "Sikker login og step-up ved følsomme handlinger — bygget til DK.",
    body: ["Brug MitID til medarbejder-login og til ekstra bekræftelse ved kritiske betalinger eller journaladgang."],
    bullets: ["Login", "Step-up", "Audit-spor", "DK-standard"],
  },
  {
    slug: "gdpr-samtykke",
    categoryId: "sikkerhed",
    title: "GDPR & samtykke",
    summary: "Samtykke, sletning og dokumentation — klar til tilsyn.",
    body: ["Art. 9-samtykke til sundhedsdata, oversigt over samtykker og processer til indsigt/sletning."],
    bullets: ["Art. 9", "Samtykke-log", "Ret til indsigt", "Slette-flow"],
  },
  {
    slug: "audit-sikkerhed",
    categoryId: "sikkerhed",
    title: "Audit & adgang",
    summary: "Se hvem der har læst eller ændret hvad — med rollebaseret adgang.",
    body: ["Fuld audit-log på journal og klientdata. Kun de rigtige roller ser det rigtige."],
    bullets: ["Audit-log", "Roller", "IP / tidspunkt", "Eksport ved behov"],
  },

  // —— Sundhed ——
  {
    slug: "sygesikring-danmark",
    categoryId: "sundhed",
    title: "Sygeforsikringen «danmark»",
    summary: "Forbind til Sygeforsikringen «danmark» for automatisk indberetning — når din ydelse er dækket.",
    body: [
      "PraxisOS er forberedt til indberetning til «danmark». Tilgængelighed afhænger af din autorisation og aftale.",
    ],
    bullets: ["Automatisk indberetning", "Status på krav", "Kobling til ydelse", "Rapportering"],
    planHint: "Compliance-modul",
  },
  {
    slug: "medcom",
    categoryId: "sundhed",
    title: "MedCom",
    summary: "MedCom-korrespondance med sundhedsvæsenet — når din faggruppe er aktiveret.",
    body: [
      "Send og modtag MedCom-beskeder. Rullet ud progressivt efter faggruppe og aftale.",
    ],
    bullets: ["Korrespondance", "Sikker kanal", "Journal-kobling", "Statusspor"],
    planHint: "Compliance-modul",
  },
  {
    slug: "sundhed-dk",
    categoryId: "sundhed",
    title: "Sundhed.dk",
    summary: "Forberedelse til sundhed.dk-integration — data hvor patienten forventer det.",
    body: ["Roadmap-modul til deling via nationale sundhedsplatforme, når krav og aftaler er på plads."],
    bullets: ["National deling", "Patientoverblik", "Compliance-first", "Efter aftale"],
    planHint: "Enterprise / aftale",
  },

  // —— AI ——
  {
    slug: "aria-reception",
    categoryId: "ai",
    title: "Aria · reception",
    summary: "AI-receptionist der tager imod, booker og svarer — med klare grænser.",
    body: ["Aria håndterer almindelige henvendelser og booking. Komplekse sager sendes til dig."],
    bullets: ["Booking-hjælp", "FAQ", "Eskalering til dig", "Dansk stemme/tekst"],
    planHint: "AI-plan / tilkøb",
  },
  {
    slug: "journal-scribe",
    categoryId: "ai",
    title: "Journal-scribe",
    summary: "AI der foreslår journaltekst efter behandling — du godkender altid.",
    body: ["Spar tid på dokumentation. Scribe foreslår udkast; du retter og underskriver."],
    bullets: ["Udkast fra note/optagelse", "Du godkender", "Skabeloner", "Audit på ændringer"],
    planHint: "AI-plan / tilkøb",
  },
  {
    slug: "no-show",
    categoryId: "ai",
    title: "No-show agent",
    summary: "Reducer udeblivelser med smarte påmindelser og genbooking.",
    body: ["Agenten prioriterer risikable aftaler og foreslår opfølgning — uden at spamme alle."],
    bullets: ["Risiko-scoring", "Målrettede reminders", "Genbooking", "Statistik"],
    planHint: "AI-plan / tilkøb",
  },

  // —— Integrationer ——
  {
    slug: "website-embed",
    categoryId: "integrationer",
    title: "Website & embed",
    summary: "Booking, priser og klippekort på din egen hjemmeside — white-label.",
    body: [
      "Indlejring på WordPress eller anden site. Kunderne ser kun dit klinikbrand.",
    ],
    bullets: ["Embed-widget", "White-label", "WordPress-klar", "Dit domæne"],
  },
  {
    slug: "aabent-api",
    categoryId: "integrationer",
    title: "Åbent API",
    summary: "Byg egne integrationer og udveksl data på tværs af systemer.",
    body: [
      "REST/MCP-endpoints til booking, klienter og ydelser. Til klinikker og partnere der vil bygge ovenpå PraxisOS.",
    ],
    bullets: ["Booking & klienter", "API-nøgler", "Webhooks (roadmap)", "Dokumentation"],
    planHint: "Platform",
  },
  {
    slug: "dawa-cvr",
    categoryId: "integrationer",
    title: "DAWA & CVR",
    summary: "Adresseopslag og virksomhedsdata fra officielle DK-registre.",
    body: ["Autoudfyld adresser ved hjemmebesøg og hent CVR-data ved oprettelse af klinik."],
    bullets: ["DAWA autocomplete", "CVR-opslag", "Færre tastefejl", "Inkl. i platform"],
  },
  {
    slug: "kalender-sync",
    categoryId: "integrationer",
    title: "Kalender-sync",
    summary: "Synkronisér med eksterne kalendere, så du undgår dobbeltbookinger.",
    body: ["Hold PraxisOS og din øvrige kalender i sync — især nyttigt med flere behandlere."],
    bullets: ["To-vejs sync (roadmap)", "Bloker optagede tider", "Per behandler", "Privatliv-respekt"],
  },
];

export function featureBySlug(slug: string): B2bFeature | undefined {
  return B2B_FEATURES.find((f) => f.slug === slug);
}

export function featuresForCategory(categoryId: B2bCategoryId | "alle"): B2bFeature[] {
  if (categoryId === "alle") return B2B_FEATURES;
  return B2B_FEATURES.filter((f) => f.categoryId === categoryId);
}

export function categoryLabel(id: B2bCategoryId): string {
  return B2B_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
