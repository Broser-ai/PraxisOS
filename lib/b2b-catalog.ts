// Offentlig B2B-katalog · fodplejere der køber PraxisOS-licens
// Bygger oven på lib/modules.ts men grupperet til salgsside (à la terapeutbooking.dk/funktioner).

import { CATEGORIES, MODULES, type Module } from "@/lib/modules";

export type B2bFeatureGroup = {
  id: string;
  label: string;
  description: string;
  moduleIds: string[];
};

/** Salgsgrupper målrettet fodpleje / fodterapeut-klinikker */
export const B2B_FEATURE_GROUPS: B2bFeatureGroup[] = [
  {
    id: "kerne",
    label: "Kerne · klinikdrift",
    description: "Booking, klienter, journal og betaling — det du skal bruge for at køre klinikken.",
    moduleIds: ["core-booking", "core-clients", "core-payments"],
  },
  {
    id: "klient",
    label: "Klientoplevelse",
    description: "Online booking, klippekort, gavekort og påmindelser der får kalenderen fyldt.",
    moduleIds: ["growth-vouchers", "core-booking", "compliance-nemsms"],
  },
  {
    id: "sikkerhed",
    label: "Sikkerhed & GDPR",
    description: "MitID, samtykke, audit og sikker kommunikation — bygget til sundhedsdata.",
    moduleIds: ["compliance-mitid", "ops-security", "compliance-nemsms"],
  },
  {
    id: "sundhed",
    label: "Sundhedsvæsen & forsikring",
    description: "Sygesikring «danmark», MedCom og indberetning uden manuel dobbeltarbejde.",
    moduleIds: ["compliance-subsidies", "compliance-medcom", "compliance-sundhed-dk"],
  },
  {
    id: "ai",
    label: "AI-agenter",
    description: "Reception, journal-scribe og no-show — agenter med navn, stemme og klare grænser.",
    moduleIds: ["ai-aria", "ai-niels", "ai-magnus", "ai-liv"],
  },
  {
    id: "drift",
    label: "Drift & felt",
    description: "Flere behandlere, hjemmebesøg og overblik over klinikken i tal.",
    moduleIds: ["ops-field", "ops-finance", "clinical-foot-scan"],
  },
  {
    id: "platform",
    label: "Website & API",
    description: "White-label på din egen hjemmeside, embed-booking og åbent API.",
    moduleIds: ["platform-api", "core-booking"],
  },
];

export const B2B_HIGHLIGHTS = [
  {
    title: "Online booking",
    body: "Klienter booker direkte i din kalender — på din hjemmeside eller via PraxisOS-booking.",
  },
  {
    title: "Klippekort & gavekort",
    body: "Sælg og indløs klippekort til fodbehandling uden ekstra systemer.",
  },
  {
    title: "Hjemmebesøg",
    body: "Felt-kalender til udekørende behandling hos privat, plejehjem og erhverv.",
  },
  {
    title: "DK-stack fra dag ét",
    body: "MitID, NemSMS, MedCom, DAWA og CVR — uden at hyre en udvikler.",
  },
  {
    title: "Dit brand udadtil",
    body: "Kunder ser din klinik (fx by Pilar) — ikke vores backend-navn.",
  },
  {
    title: "AI når du er klar",
    body: "Tilkøb Aria, journal-scribe og no-show når driften er på plads.",
  },
] as const;

export function modulesForGroup(group: B2bFeatureGroup): Module[] {
  const seen = new Set<string>();
  const list: Module[] = [];
  for (const id of group.moduleIds) {
    if (seen.has(id)) continue;
    const m = MODULES.find((x) => x.id === id);
    if (m) {
      seen.add(id);
      list.push(m);
    }
  }
  return list;
}

export function formatModulePrice(m: Module): string {
  if (m.pricingModel === "free" || (m.priceMonthly === 0 && m.pricePerSeat === 0)) {
    return "Inkl. i plan";
  }
  if (m.pricingModel === "flat") {
    return `${m.priceMonthly.toLocaleString("da-DK")} kr/md`;
  }
  if (m.pricingModel === "per_seat") {
    return `${m.pricePerSeat.toLocaleString("da-DK")} kr/behandler/md`;
  }
  return "Efter forbrug";
}

export { CATEGORIES, MODULES };
