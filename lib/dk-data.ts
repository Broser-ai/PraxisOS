// DK Data-integrationer · alle dansk-offentlige data-kilder PraxisOS bruger
//
// Vigtig juridisk afgrænsning:
//   - DAWA giver KUN adresse-data, ikke person-data
//   - CPR udleveres IKKE direkte til private SaaS via MitID — kun via CPR Match
//   - Person-data fra CPR-registret kræver hjemmel (typisk sundhedsloven §42a)
//   - Sundhed.dk + FMK kræver formel Trustaftale med Sundhedsdatastyrelsen

export type DataSource = {
  id: string;
  name: string;
  authority: string;             // hvem ejer datakilden
  url: string;
  category: "address" | "identity" | "business" | "health" | "income" | "communication";
  provides: string[];            // hvad vi rent faktisk får
  doesNotProvide: string[];      // afgrænsninger
  authMethod: "open" | "oauth" | "mitid_broker" | "cpr_match" | "trustaftale" | "kombit" | "api_key";
  status: "live" | "stubbed" | "pending" | "missing";
  costNote: string;
  legalBasis: string;
  cacheTtlSec: number;
  rateLimit: string;
  setupTime: string;
  practiceOsBenefit: string;
  iconColor: string;
  responseExample?: string;
};

export const DK_DATA_SOURCES: DataSource[] = [
  {
    id: "dawa",
    name: "DAWA · Danmarks Adressers Web API",
    authority: "Dataforsyningen / Klimadatastyrelsen",
    url: "api.dataforsyningen.dk",
    category: "address",
    provides: [
      "Vejnavne (officielle DK-vejnavne)",
      "Husnumre + etage + dør",
      "Postnummer + by",
      "Kommunekode + DAGI-data",
      "Adresse-autocomplete med fuld validering",
      "Geokoordinater (ETRS89/UTM32 + WGS84)",
    ],
    doesNotProvide: [
      "Person-data (intet navn, intet CPR)",
      "Beboer-information",
      "Adresse-historik (kun nuværende)",
    ],
    authMethod: "open",
    status: "live",
    costNote: "Gratis · ubegrænset brug",
    legalBasis: "Offentlig data · åben datalicens",
    cacheTtlSec: 86400,
    rateLimit: "10 req/sek anbefalet · ingen hård grænse",
    setupTime: "Direkte · ingen registrering",
    practiceOsBenefit: "Auto-validér klient-adresse + hjemmebesøgs-rute · brugt i onboarding-wizard og booking",
    iconColor: "var(--color-signal)",
    responseExample: `[
  {
    "type": "adresse",
    "tekst": "Hovedgaden 4, 8000 Aarhus C",
    "adresse": {
      "vejnavn": "Hovedgaden",
      "husnr": "4",
      "postnr": "8000",
      "postnrnavn": "Aarhus C",
      "kommunekode": "0751"
    }
  }
]`,
  },
  {
    id: "mitid",
    name: "MitID · officiel eID",
    authority: "Digitaliseringsstyrelsen via Signaturgruppen-broker",
    url: "broker.signaturgruppen.dk",
    category: "identity",
    provides: [
      "Verificeret navn (fra MitID-claim)",
      "Fødselsdato",
      "NSIS-niveau (Low / Substantial / High)",
      "Subject-identifier (persistent pseudonym)",
      "Audience-bundet attestation",
    ],
    doesNotProvide: [
      "CPR direkte (for private SaaS — kun via CPR Match)",
      "Adresse (skal hentes via DAWA + CPR-bekræftelse)",
      "Familie-/relations-data",
    ],
    authMethod: "mitid_broker",
    status: "stubbed",
    costNote: "Signaturgruppen-broker · setup-fee + transaktions-pris (≈0,30-1 kr/login)",
    legalBasis: "OpenID Connect · OAuth2 · NSIS-tjenesten",
    cacheTtlSec: 0,
    rateLimit: "Broker-aftale-styret",
    setupTime: "1-2 uger setup · KOMBIT-registrering",
    practiceOsBenefit: "Login for klinikere + patienter · MitID Erhverv til klinikejer · Substantial er default for booking",
    iconColor: "#0061af",
    responseExample: `{
  "sub": "9208-2002-2-123456789",
  "name": "Pilar Mortensen",
  "birthdate": "1985-04-12",
  "nsis_level": "substantial",
  "iss": "https://broker.signaturgruppen.dk"
}`,
  },
  {
    id: "cpr-match",
    name: "CPR Match · privat-SaaS-flow",
    authority: "Signaturgruppen via MitID-broker",
    url: "praxis.app/api/v1/cpr-match",
    category: "identity",
    provides: [
      "CPR (verificeret mod MitID-identitet)",
      "Match-bekræftelse: ja/nej",
    ],
    doesNotProvide: [
      "CPR uden brugerens eksplicit angivelse",
      "Adresse-data direkte (DAWA håndterer det)",
    ],
    authMethod: "cpr_match",
    status: "stubbed",
    costNote: "Inkluderet i MitID-broker-pris",
    legalBasis: "Brugersamtykke + GDPR Art. 6(1)(a) + sundhedsloven",
    cacheTtlSec: 0,
    rateLimit: "Ingen specifik · respekterer MitID-broker",
    setupTime: "Som del af MitID-setup",
    practiceOsBenefit: "Til private SaaS som PraxisOS kan vi IKKE få CPR direkte fra MitID · brugeren taster det, vi verificerer fødsel matcher MitID-claim",
    iconColor: "var(--color-accent)",
  },
  {
    id: "cvr",
    name: "CVR · Erhvervsregistret",
    authority: "Erhvervsstyrelsen",
    url: "cvrapi.dk eller datacvr.virk.dk",
    category: "business",
    provides: [
      "Firmanavn, CVR-nummer",
      "Branche-kode + branchetekst",
      "Adresse + postnummer",
      "Stiftelsesdato + status",
      "Tegningsregel + ejer-info",
      "Produktionsenheder (P-numre)",
    ],
    doesNotProvide: [
      "Privat-person-data",
      "Regnskab (kun summarisk)",
    ],
    authMethod: "open",
    status: "live",
    costNote: "Gratis op til 1.000 req/dag · betalt fra 0,01 kr/req",
    legalBasis: "Offentlig erhvervsdata",
    cacheTtlSec: 86400 * 7,
    rateLimit: "1.000 req/dag gratis · 100k/dag betalt",
    setupTime: "Direkte · ingen registrering",
    practiceOsBenefit: "Auto-udfyld klinikkens CVR-data ved onboarding · validér tenant-info · find tenant-adresse",
    iconColor: "var(--color-amber)",
  },
  {
    id: "sundhed-dk",
    name: "Sundhed.dk · National federation",
    authority: "Sundhedsdatastyrelsen + NSP (National Sundheds-Platform)",
    url: "sundhed.dk · nspop.dk",
    category: "health",
    provides: [
      "SSO mod sundhed.dk (patient + kliniker)",
      "FMK (Fælles Medicinkort) opslag",
      "Min Log opdateringer",
      "LPR3 anonymiseret data (kun forskning)",
    ],
    doesNotProvide: [
      "Adgang uden Trustaftale",
      "Adgang for patienter uden aktiv behandlingsrelation",
    ],
    authMethod: "trustaftale",
    status: "pending",
    costNote: "Gratis efter trustaftale · ca. 6 ugers onboarding",
    legalBasis: "Sundhedsloven §42a (purpose-limitation) · trustaftale med SDS",
    cacheTtlSec: 0,
    rateLimit: "NSP-aftale-styret",
    setupTime: "6 uger · 5 trin (audit, pen-test, signering)",
    practiceOsBenefit: "Klinikere kan slå patient-medicin op · syncer med Min Log · giver patient national journal-adgang",
    iconColor: "var(--color-signal)",
  },
  {
    id: "medcom",
    name: "MedCom · Sundhedsdatanettet",
    authority: "MedCom (selvstændig non-profit organisation)",
    url: "medcom.dk · VANS",
    category: "health",
    provides: [
      "Henvisninger (hen13)",
      "Epikriser (epi05)",
      "Laboratorie-svar",
      "Sygesikringsafregning (afr01)",
      "Korrespondance-meddelelser",
    ],
    doesNotProvide: [
      "Direkte CPR-opslag",
      "Patient-konsultations-data uden behandlingsrelation",
    ],
    authMethod: "kombit",
    status: "stubbed",
    costNote: "Gratis for offentlige + tilskudsberettigede · EAN-routing",
    legalBasis: "Sundhedsdatanettet-protokol · MedCom-standarder",
    cacheTtlSec: 0,
    rateLimit: "Pr. EAN-aftale",
    setupTime: "2-4 uger · EAN-registrering + audit",
    practiceOsBenefit: "Modtag henvisninger fra læger · send epikriser · automatiseret afregning til Region/Sygesikring",
    iconColor: "var(--color-accent)",
  },
  {
    id: "kombit-nemsms",
    name: "NemSMS · KOMBIT",
    authority: "KOMBIT (kommunernes IT-fællesskab) + Digitaliseringsstyrelsen",
    url: "nemsms.dk",
    category: "communication",
    provides: [
      "Officiel sundheds-SMS afsender",
      "KOMBIT-registreret sender-ID",
      "Borger-opt-in-tracking",
      "5 års retention (sundhedsloven)",
    ],
    doesNotProvide: [
      "Marketing-SMS (kun sundheds-relevant)",
      "Internationale SMS",
    ],
    authMethod: "kombit",
    status: "live",
    costNote: "0,50 kr/SMS (afsender betaler) · gratis for borger",
    legalBasis: "Sundhedslov + GDPR opt-in · borger.dk",
    cacheTtlSec: 0,
    rateLimit: "1.000 SMS/dag gratis tier · 10k/dag pro",
    setupTime: "2-3 uger · KOMBIT-godkendelse af sender-ID",
    practiceOsBenefit: "Booking-bekræftelser, påmindelser, recept-notifikationer · ankommer fra godkendt afsender-ID så patienten ved det er ægte",
    iconColor: "#5A78FF",
  },
  {
    id: "eindkomst",
    name: "eIndkomst · Skattestyrelsen",
    authority: "Skattestyrelsen",
    url: "skat.dk · eIndkomst",
    category: "income",
    provides: [
      "Indkomst-data (med samtykke)",
      "Skat-historik",
    ],
    doesNotProvide: [
      "Adgang uden eksplicit borgersamtykke",
      "Realtids-løn",
    ],
    authMethod: "mitid_broker",
    status: "missing",
    costNote: "Gratis efter SKAT-onboarding",
    legalBasis: "Skattekontrolloven + borgersamtykke",
    cacheTtlSec: 0,
    rateLimit: "Pr. SKAT-aftale",
    setupTime: "Måneder · ikke prioriteret",
    practiceOsBenefit: "Kunne bruges til socialt udsatte med kommunalt tilskuds-loft · ikke kerne for nu",
    iconColor: "var(--color-faint)",
  },
];

export const SOURCE_CATEGORIES = [
  { id: "address",      label: "Adresse",       icon: "📍" },
  { id: "identity",     label: "Identitet",     icon: "🆔" },
  { id: "business",     label: "Erhverv",       icon: "🏢" },
  { id: "health",       label: "Sundhedsdata",  icon: "❤️" },
  { id: "income",       label: "Indkomst",      icon: "💰" },
  { id: "communication", label: "Kommunikation", icon: "✉️" },
] as const;

export const STATUS_LABEL = {
  live:    { label: "Live",       color: "var(--color-signal)" },
  stubbed: { label: "Stubbet",     color: "var(--color-accent)" },
  pending: { label: "Under onboarding", color: "var(--color-amber)" },
  missing: { label: "Ikke implementeret", color: "var(--color-faint)" },
} as const;
