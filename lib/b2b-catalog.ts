// Offentlig B2B-katalog · spejler det der allerede findes i PraxisOS
// (sidebar, /review, lib/modules.ts) — ikke ønsketænkning.

export type B2bCategoryId =
  | "klinik"
  | "klient"
  | "betaling"
  | "klinisk"
  | "ai"
  | "compliance"
  | "drift"
  | "platform";

export type B2bCategory = {
  id: B2bCategoryId;
  label: string;
};

/** Status ift. produktet i repo’et i dag */
export type B2bStatus = "live" | "prototype";

export type B2bFeature = {
  slug: string;
  categoryId: B2bCategoryId;
  title: string;
  summary: string;
  body: string[];
  bullets: string[];
  /** Sti i PraxisOS staff/tenant-UI — det der allerede er bygget */
  demoHref: string;
  status: B2bStatus;
  /** Modul-id fra lib/modules.ts når det findes */
  moduleId?: string;
  planHint?: string;
};

export const B2B_CATEGORIES: B2bCategory[] = [
  { id: "klinik", label: "Klinikdrift" },
  { id: "klient", label: "Klient & booking" },
  { id: "betaling", label: "Betaling & klippekort" },
  { id: "klinisk", label: "Klinisk & fod-scan" },
  { id: "ai", label: "AI-agenter" },
  { id: "compliance", label: "DK · compliance" },
  { id: "drift", label: "Drift & licens" },
  { id: "platform", label: "API & integration" },
];

/**
 * Kort = rigtige skærme/moduler Michael allerede kan klikke i /review.
 * Hold listen ærlig: det er det, der er i produktet — ikke en kopi af konkurrentens wishlist.
 */
export const B2B_FEATURES: B2bFeature[] = [
  // —— Klinikdrift (staff UI) ——
  {
    slug: "overblik",
    categoryId: "klinik",
    title: "Overblik",
    summary: "Dagens klinik i ét view — bookinger, belægning og næste handlinger.",
    body: [
      "Staff-dashboardet samler dagens flow, så du ikke hopper mellem systemer.",
      "Findes allerede under Overblik i PraxisOS.",
    ],
    bullets: ["Dagsplan", "Status på aftaler", "Hurtige genveje", "Staff-UI"],
    demoHref: "/dashboard",
    status: "live",
    planHint: "Inkl. i Practice",
  },
  {
    slug: "kalender",
    categoryId: "klinik",
    title: "Kalender",
    summary: "Klinikkalender til behandlere — dag/uge og bookinger i samme flow.",
    body: [
      "Kalenderen er kerne i klinikdriften: tider, behandlere og aftaler ét sted.",
      "Allerede live i PraxisOS under Kalender.",
    ],
    bullets: ["Behandler-kalender", "Bookinger synlige", "Koplet til online booking", "Staff-UI"],
    demoHref: "/kalender",
    status: "live",
    moduleId: "core-booking",
    planHint: "Inkl. i Practice",
  },
  {
    slug: "klienter",
    categoryId: "klinik",
    title: "Klienter & journal",
    summary: "Klientkartotek med journal, samtykke og historik — bygget til sundhedsdata.",
    body: [
      "Klientlisten og journalsiden er allerede i produktet. Herfra går du videre til AR/CV-journal og forløb.",
    ],
    bullets: ["Klient-DB", "Journal", "GDPR Art. 9-klar", "Søgning & historik"],
    demoHref: "/klienter",
    status: "live",
    moduleId: "core-clients",
    planHint: "Inkl. i Practice",
  },
  {
    slug: "bookings",
    categoryId: "klinik",
    title: "Bookings",
    summary: "Liste over aftaler — status, detaljer og opfølgning.",
    body: [
      "Bookings-modulet viser alle aftaler på tværs af dagen. Koblet til kalender, betaling og journal.",
    ],
    bullets: ["Aftaleliste", "Detaljeside pr. booking", "Status", "Kobling til klient"],
    demoHref: "/bookings",
    status: "live",
    moduleId: "core-booking",
    planHint: "Inkl. i Practice",
  },
  {
    slug: "ydelser",
    categoryId: "klinik",
    title: "Ydelses-katalog",
    summary: "Rediger behandlinger, priser og varighed pr. klinik (tenant).",
    body: [
      "Hver klinik har sit eget katalog — som by Pilar allerede kører med fodbehandlinger, mani og tillæg.",
    ],
    bullets: ["Priser & varighed", "Tillægsydelser", "Per tenant", "API-synk til booking"],
    demoHref: "/admin/services",
    status: "live",
    planHint: "Inkl. i Practice",
  },
  {
    slug: "behandlere",
    categoryId: "klinik",
    title: "Behandlere & roller",
    summary: "Staff-management — flere behandlere, roller og vagter.",
    body: [
      "Opret behandlere med rettigheder. Klar til klinikker med mere end én stol.",
    ],
    bullets: ["Flere logins", "Roller", "Vagter", "Per-seat licens"],
    demoHref: "/admin/staff",
    status: "live",
    planHint: "Per behandler",
  },

  // —— Klient & booking (customer-facing) ——
  {
    slug: "online-booking",
    categoryId: "klient",
    title: "Online booking",
    summary: "Klienter booker direkte — white-label under dit brand eller embed på dit site.",
    body: [
      "To modes findes allerede: hostet tenant-frontend (/t/din-klinik) og headless embed på egen hjemmeside.",
      "by Pilar kører det i produktion.",
    ],
    bullets: ["Hostet booking-side", "Embed-widget", "White-label brand", "Ledige tider via API"],
    demoHref: "/t/bypilar/book",
    status: "live",
    moduleId: "core-booking",
    planHint: "Inkl. i Practice",
  },
  {
    slug: "website-embed",
    categoryId: "klient",
    title: "Embed på eget site",
    summary: "Én script-linje på din hjemmeside — PraxisOS som backend, dit brand udadtil.",
    body: [
      "Mode A i review: mock af klinik-site med PraxisOS-embed. Samme model som WordPress på bypilar.dk.",
    ],
    bullets: ["Script-embed", "Modal booking", "Dit design", "REST bagved"],
    demoHref: "/demo/bypilar-website",
    status: "live",
    planHint: "Inkl. i Practice",
  },
  {
    slug: "patient-portal",
    categoryId: "klient",
    title: "Patient-portal · Min side",
    summary: "Klient ser næste tid, journal og kontakt — MitID-klar login.",
    body: [
      "Portal under tenant-brand. Patienten logger ind og ser egne data — ikke klinik-admin.",
    ],
    bullets: ["Næste aftale", "Journal-adgang", "MitID-flow", "White-label"],
    demoHref: "/t/bypilar/portal",
    status: "live",
    moduleId: "compliance-mitid",
    planHint: "Inkl. i Practice",
  },
  {
    slug: "white-label",
    categoryId: "klient",
    title: "White-label multi-tenant",
    summary: "Samme kodebase, mange klinikker — hvert brand får egen frontend.",
    body: [
      "Dokumenteret i review med bypilar + Nordlys. Du køber licens; dine kunder ser aldrig PraxisOS-navnet.",
    ],
    bullets: ["Flere tenants", "Eget brand", "Fælles platform", "License-matrix"],
    demoHref: "/t/nordlys",
    status: "live",
    planHint: "Practice / Clinic",
  },

  // —— Betaling ——
  {
    slug: "praxisos-pay",
    categoryId: "betaling",
    title: "PraxisOS Pay",
    summary: "Egen betalingsmotor — MobilePay, kort, risk/trust og settlement.",
    body: [
      "Betaling er et første-klasses modul i PraxisOS — ikke bare en Stripe-knap. Risk-scoring og MitID step-up er med i designet.",
    ],
    bullets: ["Online & i klinik", "Risk · Trust", "Settlement", "Refunds"],
    demoHref: "/admin/payments",
    status: "live",
    moduleId: "core-payments",
    planHint: "Inkl. · tx-gebyr",
  },
  {
    slug: "klippekort-gavekort",
    categoryId: "betaling",
    title: "Klippekort & gavekort",
    summary: "Sælg og indløs klippekort/gavekort — katalog, balance og kunde-flow.",
    body: [
      "Admin-katalog plus kunde-sider under tenant (klippekort/gavekort). by Pilar bruger det allerede.",
    ],
    bullets: ["Voucher-katalog", "Balance-tracking", "Online køb", "Indløsning ved booking"],
    demoHref: "/admin/vouchers",
    status: "live",
    moduleId: "growth-vouchers",
    planHint: "Inkl. i Practice",
  },
  {
    slug: "plan-fakturering",
    categoryId: "betaling",
    title: "Plan & licensfakturering",
    summary: "Styr clinic-licens, seats og fakturaer i control plane.",
    body: [
      "Operatør-siden til planer — det B2B-laget sidder ovenpå når en fodplejer køber PraxisOS.",
    ],
    bullets: ["License tiers", "Seats", "Invoices", "Upgrade-flow"],
    demoHref: "/admin/plan",
    status: "live",
    planHint: "Operatør",
  },

  // —— Klinisk ——
  {
    slug: "ai-scribe",
    categoryId: "klinisk",
    title: "AI Scribe · Niels",
    summary: "Ambient samtale → SOAP-journal. Du godkender altid før det gemmes.",
    body: [
      "Niels-pipeline: audio → transkription → NER → SOAP → ICD-10. Allerede i staff-UI og som deep-dive.",
    ],
    bullets: ["SOAP-udkast", "ICD-10-forslag", "Behandler-godkendelse", "EU-hostet flow"],
    demoHref: "/scribe",
    status: "live",
    moduleId: "ai-niels",
    planHint: "AI-plan / tilkøb",
  },
  {
    slug: "ar-journal",
    categoryId: "klinisk",
    title: "AR/CV-journal",
    summary: "Foto-progression og klinisk dokumentation i klientjournalen.",
    body: [
      "AR/CV-journal er koblet på klientkortet — før/efter og kliniske målinger over tid.",
    ],
    bullets: ["Foto-progression", "Time-series", "Koblet til klient", "Klinik-modul"],
    demoHref: "/klienter/mette",
    status: "prototype",
    moduleId: "clinical-ar-journal",
    planHint: "Aesthetic / tilkøb",
  },
  {
    slug: "fod-scan",
    categoryId: "klinisk",
    title: "Fod-scan · Del Pilar Nexus",
    summary: "ARIA + S-Agent: segmentering, pathology, 3D-lift, MonoMSK med quality gate.",
    body: [
      "Del Pilar Nexus orkestrerer klinisk fod-scan. Quality gate afgør om output er klinisk brugbart. AI-fund er forslag.",
    ],
    bullets: ["Kamera/upload", "Roboflow + Replicate", "Quality gate", "Journal via ARIA"],
    demoHref: "/scan",
    status: "live",
    moduleId: "clinical-foot-scan",
    planHint: "Physical AI-modul / tilvalg",
  },

  // —— AI ——
  {
    slug: "aria-agent",
    categoryId: "ai",
    title: "Aria · AI-receptionist",
    summary: "Agent der tager imod, booker og eskalerer — chat/voice/SMS-klar.",
    body: [
      "Aria er en navngiven agent i teamet. Staff kan åbne AI-agent-skærmen og se flows.",
    ],
    bullets: ["Booking-hjælp", "Eskalering", "24/7-klar", "Humaniseret"],
    demoHref: "/agent",
    status: "live",
    moduleId: "ai-aria",
    planHint: "AI-plan / tilkøb",
  },
  {
    slug: "samlet-chat",
    categoryId: "ai",
    title: "Samlet chat · team",
    summary: "Skriv én besked — routet automatisk til den rette agent.",
    body: [
      "Chat-hubben samler Aria, Niels og de øvrige agenter, så klinikken ikke skal huske ni indgange.",
    ],
    bullets: ["Auto-routing", "Agent-team", "Staff-chat", "Én indgang"],
    demoHref: "/chat",
    status: "live",
    planHint: "AI-plan",
  },
  {
    slug: "agent-team",
    categoryId: "ai",
    title: "Agent-team · 9 agenter",
    summary: "Aria, Niels, Sigrid, Magnus, Frej, Vega, Bjørn, Liv, Atlas — med roller og grænser.",
    body: [
      "Control plane for hele agent-holdet: status, pipelines og aktivering via marketplace.",
    ],
    bullets: ["9 navngivne agenter", "Pipelines", "Marketplace-aktivering", "Human-in-the-loop"],
    demoHref: "/admin/agents",
    status: "live",
    planHint: "AI / modulært",
  },

  // —— Compliance ——
  {
    slug: "mitid",
    categoryId: "compliance",
    title: "MitID",
    summary: "Login for patient og kliniker — NSIS-klar eID-fundament.",
    body: [
      "MitID-flows findes i login og portal. Del af DK-compliance-stakken.",
    ],
    bullets: ["Patient-login", "Kliniker-login", "CPR match-klar", "Step-up"],
    demoHref: "/login/mitid",
    status: "live",
    moduleId: "compliance-mitid",
    planHint: "Inkl. / compliance",
  },
  {
    slug: "nemsms",
    categoryId: "compliance",
    title: "NemSMS",
    summary: "Officiel sundheds-SMS — påmindelser via godkendt afsender.",
    body: [
      "NemSMS-admin er på plads i control plane til kritiske borgermeddelelser.",
    ],
    bullets: ["Påmindelser", "KOMBIT-klar afsender", "Audit", "Klinik-konfig"],
    demoHref: "/admin/nemsms",
    status: "live",
    moduleId: "compliance-nemsms",
    planHint: "Compliance-modul",
  },
  {
    slug: "tilskud",
    categoryId: "compliance",
    title: "Tilskud & «danmark»",
    summary: "Tilskudsordninger, eligibility og indberetning — Sigrid-engine bagved.",
    body: [
      "Tilskudssiden + Sigrids 9-trins engine er bygget til sygesikring, kommunal støtte og forsikring.",
    ],
    bullets: ["Eligibility", "Sygesikring «danmark»", "Kommunal støtte", "Settlement-flow"],
    demoHref: "/admin/subsidies",
    status: "live",
    moduleId: "compliance-subsidies",
    planHint: "Compliance-modul",
  },
  {
    slug: "indberetning",
    categoryId: "compliance",
    title: "Indberetning",
    summary: "EDI · MedCom XML · KOMBIT — rapportering uden manuel dobbeltarbejde.",
    body: [
      "Indberetnings-UI ligger klar til de formater sundhedsvæsenet forventer.",
    ],
    bullets: ["EDI", "MedCom XML", "KOMBIT API", "Periode-rapporter"],
    demoHref: "/admin/reporting",
    status: "live",
    planHint: "Compliance",
  },
  {
    slug: "medcom",
    categoryId: "compliance",
    title: "MedCom",
    summary: "Henvisninger, epikriser og afregning via Sundhedsdatanettet.",
    body: [
      "MedCom-modulet er i control plane — klar til faggrupper der er aktiveret.",
    ],
    bullets: ["Henvisninger", "Epikriser", "Afregning", "Sikker kanal"],
    demoHref: "/admin/medcom",
    status: "prototype",
    moduleId: "compliance-medcom",
    planHint: "Compliance-modul",
  },
  {
    slug: "sundhed-dk",
    categoryId: "compliance",
    title: "Sundhed.dk + FMK",
    summary: "Federation / SSO og FMK-bro — trustaftale-spor i produktet.",
    body: [
      "Sundhed.dk-siden dokumenterer federation og FMK. Status: i gang / aftaleafhængig.",
    ],
    bullets: ["SSO-klar", "FMK-bro", "Trustaftale", "National deling"],
    demoHref: "/admin/sundhed-dk",
    status: "prototype",
    moduleId: "compliance-sundhed-dk",
    planHint: "Enterprise / aftale",
  },
  {
    slug: "sikkerhed",
    categoryId: "compliance",
    title: "Sikkerhed & adgang",
    summary: "Sessioner, login-forsøg, audit-log og Frej compliance-engine.",
    body: [
      "Sikkerhedssiden + Frejs pipeline dækker PraxisRisk, Trust og anomaly — GDPR Art. 9-spor.",
    ],
    bullets: ["Audit-log", "Brute-force", "Sessioner", "Frej-engine"],
    demoHref: "/admin/security",
    status: "live",
    moduleId: "ops-security",
    planHint: "Inkl. i Practice",
  },

  // —— Drift ——
  {
    slug: "ruteplanlaegning",
    categoryId: "drift",
    title: "Ruteplanlægning · hjemmebesøg",
    summary: "Udekørende fodpleje — rute til privat, plejehjem og erhverv.",
    body: [
      "Ruteplanlægning er bygget til klinikker der kører ude. Adresse/DAWA indgår i DK-stakken.",
    ],
    bullets: ["Rute-kalender", "Hjemmebesøg", "Plejehjem / erhverv", "Separat fra klinikdag"],
    demoHref: "/felt",
    status: "live",
    moduleId: "ops-field",
    planHint: "Tilvalg",
  },
  {
    slug: "tenants-licens",
    categoryId: "drift",
    title: "Tenants · Broser only",
    summary: "Operatør-view: aktive klinikker og licens. Kun Broser — ikke synlig for kunden.",
    body: [
      "Tenants er din control plane. Klinik-kunder ser det ikke.",
    ],
    bullets: ["Multi-tenant", "Kun Broser", "License-matrix", "Control plane"],
    demoHref: "/admin/tenants",
    status: "live",
    planHint: "Broser",
  },
  {
    slug: "marketplace",
    categoryId: "drift",
    title: "Modul-tilvalg",
    summary: "Klinikken vælger tilvalg selv — Pay, NemSMS, webshop, indberetning m.m.",
    body: [
      "Modul-tilvalg gør PraxisOS modulært: kerne er obligatorisk, resten tilvælges.",
    ],
    bullets: ["Tilvalg", "Kerne inkluderet", "Aktiverings-wizard", "Afhængigheder"],
    demoHref: "/admin/marketplace",
    status: "live",
    moduleId: undefined,
    planHint: "Tilvalg",
  },

  // —— Platform ——
  {
    slug: "universal-api",
    categoryId: "platform",
    title: "Universal API",
    summary: "REST til services, availability, bookings, klienter — klar til eget site.",
    body: [
      "API-keys, endpoints og eksempler ligger under Universal API. Samme endpoints bypilar.dk bruger.",
    ],
    bullets: ["Services & availability", "Bookings", "API-keys", "Webhooks-klar"],
    demoHref: "/admin/api",
    status: "live",
    moduleId: "platform-api",
    planHint: "Platform",
  },
  {
    slug: "mcp-server",
    categoryId: "platform",
    title: "MCP-server",
    summary: "Claude Code & Cursor kan styre PraxisOS — tools eksponeret.",
    body: [
      "MCP gør platformen agent-klar udadtil: udviklere og AI-værktøjer kan operere sikkert mod jeres API.",
    ],
    bullets: ["MCP tools", "Agent-klar", "Dev-integration", "Control plane"],
    demoHref: "/admin/mcp",
    status: "live",
    moduleId: "platform-api",
    planHint: "Platform",
  },
  {
    slug: "dk-data",
    categoryId: "platform",
    title: "DK Data · DAWA / CVR / MitID",
    summary: "Offentlige DK-kilder samlet — adresse, virksomhed, eID.",
    body: [
      "DK Data-siden samler de offentlige integrationer med juridisk grundlag — ikke et efterthought.",
    ],
    bullets: ["DAWA", "CVR", "MitID", "CPR-klar spor"],
    demoHref: "/admin/dk-data",
    status: "live",
    planHint: "Inkl. i platform",
  },
  {
    slug: "database-eu",
    categoryId: "platform",
    title: "Database · Supabase EU",
    summary: "EU-data, RLS multi-tenant, migrations — klar til Postgres i produktion.",
    body: [
      "Data-region EU er en del af pitch’et til klinikker. Schema og RLS er på plads i produktet.",
    ],
    bullets: ["EU-region", "RLS multi-tenant", "Migrations", "pgvector-klar"],
    demoHref: "/admin/database",
    status: "live",
    planHint: "Inkl.",
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
