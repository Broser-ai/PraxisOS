/**
 * by Pilar — autoritativt behandlings- og priskatalog.
 * Single source of truth for PraxisOS (tenant seed, API, booking, klippekort)
 * og WordPress-broen (mu-plugin / theme sync).
 *
 * Varigheder der ikke er godkendt i kataloget sættes til undefined (ikke gættet).
 * Tilvalg uden godkendt pris er chargeable: false (opkræves ikke).
 */

import type { Service, ServiceAddOn } from "@/lib/tenants";

/** Klippekort-template (spejler ClipPackage i lib/vouchers.ts — undgår cirkulær import). */
export type BypilarClipPackage = {
  id: string;
  tenant: "bypilar";
  serviceId: string;
  serviceName: string;
  sessions: number;
  discountPct: number;
  faceValueKr: number;
  priceKr: number;
  expiryMonths: number;
  highlighted?: boolean;
};

/** Review: beskrivelse nævner let massage, samtidig listet som tilvalg uden pris. */
export const BYPILAR_REVIEW_NOTES = [
  "Fodbehandling: teksten nævner let massage i afslutningen, samtidig er 'Let massage' listet som tilvalg uden godkendt pris — opkræves ikke i booking før pris er godkendt.",
] as const;

const addonNeglelak: ServiceAddOn = {
  id: "addon-neglelak",
  name: "Neglelak",
  chargeable: false,
  reviewNote: "Pris for neglelak-tilvalg er ikke godkendt i kataloget — vises uden ekstra opkrævning.",
};

const addonLetMassage: ServiceAddOn = {
  id: "addon-let-massage",
  name: "Let massage",
  chargeable: false,
  reviewNote:
    "Konflikt med hovedtekst (massage nævnes som del af behandling). Ingen godkendt tillægspris — opkræves ikke.",
};

/** Godkendt tilvalgspris: lak på tæer ved anden behandling. */
export const ADDON_LAK_TAEER: ServiceAddOn = {
  id: "addon-lak-taeer",
  name: "Lak på tæer",
  priceKr: 49,
  chargeable: true,
};

export const BYPILAR_SERVICES: Service[] = [
  {
    id: "fod-std",
    name: "Fodbehandling",
    shortDescription: "Velplejede fødder – og lidt tid til dig selv.",
    description:
      "Behandlingen starter med et lunt og blødgørende fodbad. Herefter beskæres og slibes hård hud, eventuelle ligtorne fjernes, og neglene klippes og files. Behandlingen afsluttes med cremepleje og en let massage, så fødderne føles bløde, velplejede og friske.",
    priceKr: 300,
    category: "Fod",
    modality: ["Klinik", "Hjemmebesøg"],
    active: true,
    bookable: true,
    addOns: [addonNeglelak, addonLetMassage, ADDON_LAK_TAEER],
    reviewNotes: [BYPILAR_REVIEW_NOTES[0]],
  },
  {
    id: "fod-ext",
    name: "Udvidet fodbehandling",
    shortDescription: "Når fødderne har brug for lidt mere tid og ekstra omsorg.",
    description:
      "En udvidet behandling til dig, der har behov for mere tid til fødderne. Vi arbejder grundigt med hård hud, nedgroede negle, eventuelle ligtorne samt negle, der klippes og files. Behandlingen tilpasses føddernes behov og afsluttes med cremepleje og massage.",
    priceKr: 400,
    category: "Fod",
    modality: ["Klinik", "Hjemmebesøg"],
    active: true,
    bookable: true,
    addOns: [ADDON_LAK_TAEER],
  },
  {
    id: "fod-lux",
    name: "Luksus fodbehandling",
    shortDescription: "Den ekstra forkælelse til velplejede og trætte fødder.",
    description:
      "Luksus fodbehandlingen bygger videre på den grundige fodbehandling med ekstra fokus på velvære. Efter fodbadet arbejdes der med peeling, og fødderne masseres grundigt. Behandlingen afsluttes med en dybdegående læg- og fodmassage.",
    durationMin: 75,
    priceKr: 595,
    category: "Fod",
    modality: ["Klinik", "Hjemmebesøg"],
    active: true,
    bookable: true,
    addOns: [ADDON_LAK_TAEER],
  },
  {
    id: "mani",
    name: "Manicure",
    shortDescription: "Smukke hænder og velplejede negle.",
    description:
      "Neglebåndene skubbes og plejes, hænder og negle masseres, og neglene files i den ønskede form. Neglene renses og poleres, og behandlingen afsluttes med negleolie.",
    priceKr: 239,
    category: "Negle",
    modality: ["Klinik"],
    active: true,
    bookable: true,
    addOns: [addonNeglelak],
  },
  {
    id: "lak-taeer",
    name: "Lak på tæer",
    shortDescription: "En flot og velplejet afslutning til tåneglene.",
    description:
      "Neglene klargøres og lakeres med den ønskede farve, så fødderne får et smukt og velplejet udtryk.",
    priceKr: 110,
    category: "Negle",
    modality: ["Klinik", "Hjemmebesøg"],
    active: true,
    bookable: true,
  },
  {
    id: "aftag-lak",
    name: "Aftagning af lak",
    shortDescription: "Klargøring af neglene til en ny behandling.",
    description:
      "Eksisterende neglelak fjernes, så neglene er klar til ny lak eller anden neglebehandling.",
    priceKr: 29,
    category: "Negle",
    modality: ["Klinik", "Hjemmebesøg"],
    active: true,
    bookable: true,
  },
  {
    id: "aftag-shellac",
    name: "Aftagning af shellac",
    shortDescription: "Skånsom fjernelse af eksisterende shellac.",
    description:
      "Eksisterende shellac fjernes som forberedelse til en ny behandling.",
    priceKr: 59,
    category: "Negle",
    modality: ["Klinik", "Hjemmebesøg"],
    active: true,
    bookable: true,
  },
];

/** Tidligere offentlige byPilar-services — inactive, må ikke vises offentligt. */
export const BYPILAR_LEGACY_INACTIVE: Service[] = [
  {
    id: "gel-mani",
    name: "Gel manicure",
    description: "Klassisk gel-manicure, holder 3-4 uger.",
    durationMin: 45,
    priceKr: 395,
    category: "Negle",
    modality: ["Klinik"],
    active: false,
    bookable: false,
  },
  {
    id: "nail-art",
    name: "Nail art",
    description: "Personligt design — vi tegner det du drømmer om.",
    durationMin: 60,
    priceKr: 545,
    category: "Negle",
    modality: ["Klinik"],
    active: false,
    bookable: false,
  },
  {
    id: "fod-med",
    name: "Medicinsk fodpleje",
    description: "Til hård hud, ligtorne, nedgroede negle.",
    durationMin: 45,
    priceKr: 495,
    category: "Fod",
    modality: ["Klinik", "Hjemmebesøg"],
    active: false,
    bookable: false,
  },
  {
    id: "fod-lux-legacy",
    name: "Luksus fodpleje",
    description: "Fuld behandling + scrub, maske, lakering.",
    durationMin: 75,
    priceKr: 745,
    category: "Fod",
    modality: ["Klinik", "Hjemmebesøg"],
    active: false,
    bookable: false,
  },
  {
    id: "fod-scan",
    name: "Fod-scan · Physical AI",
    description: "Sub-mm 3D-topologi · plantar pressure · klinisk analyse.",
    durationMin: 30,
    priceKr: 595,
    category: "Fod-scan",
    modality: ["Klinik"],
    active: false,
    bookable: false,
  },
];

export function bypilarPublicServices(): Service[] {
  return BYPILAR_SERVICES.filter((s) => s.active !== false);
}

export function bypilarAllServices(): Service[] {
  return [...BYPILAR_SERVICES, ...BYPILAR_LEGACY_INACTIVE];
}

export const BYPILAR_CLIP_PACKAGES: BypilarClipPackage[] = [
  {
    id: "pkg_fod_std_5",
    tenant: "bypilar",
    serviceId: "fod-std",
    serviceName: "Almindelig fodbehandling",
    sessions: 5,
    discountPct: 10,
    faceValueKr: 1500,
    priceKr: 1350,
    expiryMonths: 12,
  },
  {
    id: "pkg_fod_std_10",
    tenant: "bypilar",
    serviceId: "fod-std",
    serviceName: "Almindelig fodbehandling",
    sessions: 10,
    discountPct: 10,
    faceValueKr: 3000,
    priceKr: 2700,
    expiryMonths: 12,
    highlighted: true,
  },
  {
    id: "pkg_fod_ext_5",
    tenant: "bypilar",
    serviceId: "fod-ext",
    serviceName: "Udvidet fodbehandling",
    sessions: 5,
    discountPct: 10,
    faceValueKr: 2000,
    priceKr: 1800,
    expiryMonths: 12,
  },
  {
    id: "pkg_fod_ext_10",
    tenant: "bypilar",
    serviceId: "fod-ext",
    serviceName: "Udvidet fodbehandling",
    sessions: 10,
    discountPct: 20,
    faceValueKr: 4000,
    priceKr: 3200,
    expiryMonths: 12,
  },
  {
    id: "pkg_fod_lux_5",
    tenant: "bypilar",
    serviceId: "fod-lux",
    serviceName: "Luksus fodbehandling",
    sessions: 5,
    discountPct: 17,
    faceValueKr: 2975,
    priceKr: 2470,
    expiryMonths: 12,
  },
  {
    id: "pkg_fod_lux_10",
    tenant: "bypilar",
    serviceId: "fod-lux",
    serviceName: "Luksus fodbehandling",
    sessions: 10,
    discountPct: 26,
    faceValueKr: 5950,
    priceKr: 4390,
    expiryMonths: 12,
    highlighted: true,
  },
];
