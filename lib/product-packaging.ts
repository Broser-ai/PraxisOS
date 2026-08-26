/**
 * PraxisOS · produkt-pakke (udkast)
 *
 * Kundevendt: kun det klinikken skal vælge imellem.
 * Platform/API: styres af Broser — aldrig synligt for kunden.
 * Fod-scan: pause indtil kvalitet er godkendt.
 */

export type Visibility = "core" | "addon" | "paused" | "internal";

export type PackagingItem = {
  id: string;
  name: string;
  summary: string;
  /** core = altid med · addon = tilvalg · paused = skjult/inaktiv · internal = kun Broser */
  visibility: Visibility;
  href?: string;
  /** Underpunkter kunden kan til- eller fravælge inden for modulet */
  options?: { id: string; name: string; summary: string; defaultOn?: boolean }[];
  note?: string;
};

/** Obligatorisk kerne — altid inkluderet i licens */
export const CORE_PACK: PackagingItem[] = [
  {
    id: "overblik",
    name: "Overblik",
    summary: "Dagens klinik i ét view — bookinger, belægning, næste handlinger.",
    visibility: "core",
    href: "/dashboard",
  },
  {
    id: "kalender",
    name: "Kalender",
    summary: "Behandler-kalender · dag/uge · bookinger i samme flow.",
    visibility: "core",
    href: "/kalender",
  },
  {
    id: "klienter",
    name: "Klienter",
    summary: "Klientkartotek med journal, samtykke og historik.",
    visibility: "core",
    href: "/klienter",
  },
  {
    id: "bookings",
    name: "Bookings",
    summary: "Alle aftaler · status · ombooking · venteliste.",
    visibility: "core",
    href: "/bookings",
  },
  {
    id: "ai-agent",
    name: "AI-agent",
    summary: "AI-agent i kernen. Klinikken vælger hvilke agenter der skal være aktive.",
    visibility: "core",
    href: "/agent",
    options: [
      {
        id: "agent-aria",
        name: "Aria · receptionist",
        summary: "Booking, ombooking, aflysning · chat/SMS.",
        defaultOn: true,
      },
      {
        id: "agent-magnus",
        name: "Magnus · marketing",
        summary: "Recall, reviews, genbooking i klinikkens stemme.",
        defaultOn: false,
      },
      {
        id: "agent-liv",
        name: "Liv · patient-coach",
        summary: "Check-ins mellem aftaler · fastholdelse i forløb.",
        defaultOn: false,
      },
      {
        id: "agent-bjorn",
        name: "Bjørn · felt",
        summary: "Koordinering af hjemmebesøg (kræver Ruteplanlægning).",
        defaultOn: false,
      },
    ],
    note: "Tilvalgskriterier: vælg 1–N agenter. Aria anbefales som standard.",
  },
  {
    id: "ai-diktering",
    name: "AI-diktering",
    summary: "Niels · ambient samtale → SOAP-udkast (behandler godkender altid).",
    visibility: "core",
    href: "/scribe",
  },
  {
    id: "samlet-chat",
    name: "Samlet chat",
    summary: "Én chat der router til den rette agent/team-medlem.",
    visibility: "core",
    href: "/chat",
  },
];

/** Tilvalg — kunden kan aktivere */
export const ADDON_PACK: PackagingItem[] = [
  {
    id: "praxisos-pay",
    name: "PraxisOS Pay",
    summary: "Patientbetaling: MobilePay, Dankort, kort, wallets. Settlement til NemKonto.",
    visibility: "addon",
    href: "/admin/payments",
  },
  {
    id: "nemsms",
    name: "NemSMS",
    summary: "Officiel sundheds-SMS via Sundhedsdatanettet · påmindelser og beskeder.",
    visibility: "addon",
    href: "/admin/nemsms",
  },
  {
    id: "webshop",
    name: "Webshop · produkter & klippekort",
    summary: "Sælg cremer/udstyr + klippekort/gavekort i samme shop-modul.",
    visibility: "addon",
    href: "/admin/vouchers",
    options: [
      {
        id: "shop-products",
        name: "Produktkatalog",
        summary: "Creme, udstyr og øvrige varer.",
        defaultOn: true,
      },
      {
        id: "shop-klippekort",
        name: "Klippekort",
        summary: "Forudbetalte session-pakker med rabat.",
        defaultOn: true,
      },
      {
        id: "shop-gavekort",
        name: "Gavekort",
        summary: "DKK-gavekort med lovpligtigt udløb.",
        defaultOn: true,
      },
    ],
  },
  {
    id: "indberetning",
    name: "Indberetning & DK-integrationer",
    summary: "Samlet modul for afregning og nationale koblinger. Underpunkter tilvælges.",
    visibility: "addon",
    href: "/admin/reporting",
    options: [
      {
        id: "indb-tilskud",
        name: "Tilskudsordninger",
        summary: "Sygesikring, kommunal støtte, forsikring · beregning + indberetning.",
        defaultOn: true,
      },
      {
        id: "indb-medcom",
        name: "MedCom",
        summary: "Henvisninger, epikriser, elektronisk afregning.",
        defaultOn: false,
      },
      {
        id: "indb-sundhed",
        name: "Sundhed.dk",
        summary: "Federation / SSO · FMK (kræver trustaftale).",
        defaultOn: false,
      },
      {
        id: "indb-dk-data",
        name: "DK Data",
        summary: "DAWA, CVR, MitID-broker m.m. til klinik-flow.",
        defaultOn: false,
      },
    ],
    note: "Kunden ser ét modul «Indberetning» og krydser underpunkter af. Broser håndterer API-opsætning.",
  },
  {
    id: "ruteplanlaegning",
    name: "Ruteplanlægning",
    summary: "Hjemmebesøg · rute · offline mobil.",
    visibility: "addon",
    href: "/felt",
  },
  {
    id: "ar-journal",
    name: "AR/CV-journal",
    summary: "Foto-progression og klinisk billeddokumentation.",
    visibility: "addon",
    href: "/klienter/mette",
  },
];

/** Pause — ikke aktiv for kunder endnu */
export const PAUSED_PACK: PackagingItem[] = [
  {
    id: "fod-scan",
    name: "Fod-scan · Physical AI",
    summary: "3D fod-scanning. Kvalitet ikke godkendt endnu — deaktiveret.",
    visibility: "paused",
    href: "/scan",
    note: "Intern R&D. Skal ligne og måle en rigtig fod før aktivering.",
  },
];

/**
 * Intern platform — aldrig synlig i kundens marketplace/signup.
 * Broser styrer API, MCP, database, connectors og tenants.
 */
export const INTERNAL_PACK: PackagingItem[] = [
  {
    id: "platform-tenants",
    name: "Tenants",
    summary: "Multi-klinik control plane — kun dig (Broser). Kunden ser det ikke.",
    visibility: "internal",
    href: "/admin/tenants",
  },
  {
    id: "platform-api",
    name: "Universal API",
    summary: "REST, keys, webhooks — kun Broser.",
    visibility: "internal",
    href: "/admin/api",
  },
  {
    id: "platform-mcp",
    name: "MCP-server",
    summary: "Cursor/Claude-tools — kun Broser.",
    visibility: "internal",
    href: "/admin/mcp",
  },
  {
    id: "platform-db",
    name: "Database · Supabase",
    summary: "Infra — kun Broser.",
    visibility: "internal",
    href: "/admin/database",
  },
  {
    id: "platform-health",
    name: "System-status",
    summary: "Driftsoverblik — kun Broser.",
    visibility: "internal",
    href: "/admin/health",
  },
  {
    id: "platform-atlas",
    name: "Atlas · platform",
    summary: "Intern platform-agent — kun Broser.",
    visibility: "internal",
  },
];

export function customerVisibleItems(): PackagingItem[] {
  return [...CORE_PACK, ...ADDON_PACK];
}

export function isCustomerVisible(visibility: Visibility): boolean {
  return visibility === "core" || visibility === "addon";
}
