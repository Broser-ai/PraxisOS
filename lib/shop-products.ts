// PraxisOS · webshop-katalog
// To kanaler: consumer (klinik-brand, fx by Pilar) og b2b (PraxisOS / engros til klinikker).
// Seed-priser er startkatalog — redigeres i /admin/products.

export type ShopChannel = "consumer" | "b2b";

export type ProductCategory =
  | "creme"
  | "olie"
  | "udstyr"
  | "forbrug"
  | "pakke";

export type ShopProduct = {
  id: string;
  /** Tenant der ejer forbruger-kataloget · null = platform B2B */
  tenant: string | null;
  channels: ShopChannel[];
  category: ProductCategory;
  name: string;
  shortName: string;
  summary: string;
  description: string;
  /** Forbrugerpris DKK */
  priceKr: number;
  /** B2B/engrospris DKK — hvis sat og kanal er b2b */
  b2bPriceKr?: number;
  /** Min. antal ved B2B-køb */
  b2bMinQty?: number;
  unit: string;
  stock: number;
  highlighted?: boolean;
  active: boolean;
  tags: string[];
};

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  creme: "Creme & balm",
  olie: "Olie & serum",
  udstyr: "Udstyr",
  forbrug: "Forbrugsmateriale",
  pakke: "Pakker",
};

export const SHOP_PRODUCTS: ShopProduct[] = [
  // ——— by Pilar · forbruger ———
  {
    id: "bp-urea-creme",
    tenant: "bypilar",
    channels: ["consumer"],
    category: "creme",
    name: "Urea fodcreme 15%",
    shortName: "Urea 15%",
    summary: "Daglig plejecreme til tørre og revnede fødder.",
    description:
      "Blødgørende creme med 15% urea. Anbefales efter fodbehandling. 100 ml tube.",
    priceKr: 149,
    unit: "100 ml",
    stock: 48,
    highlighted: true,
    active: true,
    tags: ["hjemmepleje", "efter behandling"],
  },
  {
    id: "bp-urea-forte",
    tenant: "bypilar",
    channels: ["consumer"],
    category: "creme",
    name: "Urea forte 25%",
    shortName: "Urea 25%",
    summary: "Intensiv creme til hård hud og fortykkede partier.",
    description:
      "Til natbrug på hæle og trykpunkter. 75 ml. Brug efter vejledning fra din behandler.",
    priceKr: 179,
    unit: "75 ml",
    stock: 32,
    active: true,
    tags: ["hård hud"],
  },
  {
    id: "bp-negleolie",
    tenant: "bypilar",
    channels: ["consumer"],
    category: "olie",
    name: "Negle- & kutikulaolie",
    shortName: "Negleolie",
    summary: "Plejer neglebånd og negleplade mellem besøg.",
    description: "Naturlig olieblanding i pen-applikator. 8 ml.",
    priceKr: 129,
    unit: "8 ml",
    stock: 60,
    active: true,
    tags: ["negle"],
  },
  {
    id: "bp-fodfil",
    tenant: "bypilar",
    channels: ["consumer"],
    category: "udstyr",
    name: "Keramisk fodfil",
    shortName: "Fodfil",
    summary: "Skånsom fil til hjemmebrug mellem behandlinger.",
    description: "Dobbeltgrov keramikflade. Kan vaskes. Ikke til diabetiske fødder uden aftale.",
    priceKr: 89,
    unit: "stk",
    stock: 40,
    active: true,
    tags: ["hjemmepleje"],
  },
  {
    id: "bp-plejepakke",
    tenant: "bypilar",
    channels: ["consumer"],
    category: "pakke",
    name: "Hjemmepleje-pakke",
    shortName: "Plejepakke",
    summary: "Urea 15% + negleolie + fodfil — samlet rabat.",
    description: "Den pakke vi anbefaler efter første fodbehandling.",
    priceKr: 299,
    unit: "pakke",
    stock: 25,
    highlighted: true,
    active: true,
    tags: ["pakke", "anbefalet"],
  },
  {
    id: "bp-massagebalm",
    tenant: "bypilar",
    channels: ["consumer"],
    category: "creme",
    name: "Afslappende fodbalm",
    shortName: "Fodbalm",
    summary: "Let duftende balm til aftenpleje.",
    description: "50 ml. Pebermynte og shea. Ikke medicinsk behandling.",
    priceKr: 119,
    unit: "50 ml",
    stock: 35,
    active: true,
    tags: ["velvære"],
  },

  // ——— B2B · engros til klinikker (PraxisOS-shop) ———
  {
    id: "b2b-urea15-karton",
    tenant: null,
    channels: ["b2b"],
    category: "creme",
    name: "Urea 15% · klinik-karton (12×100 ml)",
    shortName: "Urea 15% ×12",
    summary: "Engros til videresalg eller klinikbrug.",
    description: "12 tuber á 100 ml. Neutral emballage — sæt eget label på hvis ønsket.",
    priceKr: 1188,
    b2bPriceKr: 980,
    b2bMinQty: 1,
    unit: "karton",
    stock: 80,
    highlighted: true,
    active: true,
    tags: ["engros", "videresalg"],
  },
  {
    id: "b2b-urea25-karton",
    tenant: null,
    channels: ["b2b"],
    category: "creme",
    name: "Urea 25% · klinik-karton (12×75 ml)",
    shortName: "Urea 25% ×12",
    summary: "Forte-creme til klinik og udsalg.",
    description: "12 tuber á 75 ml. Egnet til hård hud-forløb.",
    priceKr: 1428,
    b2bPriceKr: 1180,
    b2bMinQty: 1,
    unit: "karton",
    stock: 55,
    active: true,
    tags: ["engros"],
  },
  {
    id: "b2b-negleolie-box",
    tenant: null,
    channels: ["b2b"],
    category: "olie",
    name: "Negleolie · displaybox (24 stk)",
    shortName: "Negleolie ×24",
    summary: "Klar til disk / reception.",
    description: "24 pen-applikatorer + display. Anbefalet udsalgspris 129 kr.",
    priceKr: 1896,
    b2bPriceKr: 1450,
    b2bMinQty: 1,
    unit: "box",
    stock: 40,
    active: true,
    tags: ["engros", "display"],
  },
  {
    id: "b2b-engangsfil",
    tenant: null,
    channels: ["b2b"],
    category: "forbrug",
    name: "Engangs fodfile · 100 stk",
    shortName: "Engangsfile",
    summary: "Hygiejniske engangsfile til klinik.",
    description: "Dobbeltgrov. Pose á 100. CE-mærket forbrugsmateriale.",
    priceKr: 320,
    b2bPriceKr: 265,
    b2bMinQty: 1,
    unit: "100 stk",
    stock: 120,
    active: true,
    tags: ["klinik", "hygiejne"],
  },
  {
    id: "b2b-handsker",
    tenant: null,
    channels: ["b2b"],
    category: "forbrug",
    name: "Nitrilhandsker · 200 stk",
    shortName: "Handsker",
    summary: "Pudderfri nitril, str. M (andre str. på forespørgsel).",
    description: "Æske á 200. Blå. Til daglig klinikbrug.",
    priceKr: 149,
    b2bPriceKr: 119,
    b2bMinQty: 2,
    unit: "æske",
    stock: 200,
    active: true,
    tags: ["klinik"],
  },
  {
    id: "b2b-skalpelblade",
    tenant: null,
    channels: ["b2b"],
    category: "forbrug",
    name: "Skalpelblade nr. 15 · 100 stk",
    shortName: "Blade 15",
    summary: "Sterile engangsblade til fodbehandling.",
    description: "Æske á 100. Steril pakket enkeltvis.",
    priceKr: 285,
    b2bPriceKr: 240,
    b2bMinQty: 1,
    unit: "100 stk",
    stock: 90,
    active: true,
    tags: ["klinik", "steril"],
  },
  {
    id: "b2b-fodfil-pro",
    tenant: null,
    channels: ["b2b"],
    category: "udstyr",
    name: "Pro keramisk fodfil · 10 stk",
    shortName: "Pro-fil ×10",
    summary: "Genbrugelig klinikfil — også til videresalg.",
    description: "10 stk. Autoklaverbar håndtag-del. Anbefalet udsalg 89 kr.",
    priceKr: 650,
    b2bPriceKr: 520,
    b2bMinQty: 1,
    unit: "10 stk",
    stock: 35,
    highlighted: true,
    active: true,
    tags: ["udstyr", "videresalg"],
  },
  {
    id: "b2b-lampe",
    tenant: null,
    channels: ["b2b"],
    category: "udstyr",
    name: "LED behandlingslampe",
    shortName: "LED-lampe",
    summary: "Justerbar LED til behandlingsstol.",
    description: "Clamp-mount. 3 lysstyrker. 2 års garanti.",
    priceKr: 1895,
    b2bPriceKr: 1595,
    b2bMinQty: 1,
    unit: "stk",
    stock: 12,
    active: true,
    tags: ["udstyr", "klinik"],
  },
  {
    id: "b2b-startpakke",
    tenant: null,
    channels: ["b2b"],
    category: "pakke",
    name: "Klinik startpakke · forbrug",
    shortName: "Startpakke",
    summary: "Handsker, blade, engangsfile og urea-karton — klar til åbning.",
    description: "Samlet engrospris med rabat vs. enkeltkøb.",
    priceKr: 2490,
    b2bPriceKr: 1990,
    b2bMinQty: 1,
    unit: "pakke",
    stock: 20,
    highlighted: true,
    active: true,
    tags: ["pakke", "ny klinik"],
  },
];

export function unitPrice(product: ShopProduct, channel: ShopChannel): number {
  if (channel === "b2b" && product.b2bPriceKr != null) return product.b2bPriceKr;
  return product.priceKr;
}

export function listProducts(opts: {
  channel: ShopChannel;
  tenant?: string;
  category?: ProductCategory | "alle";
}): ShopProduct[] {
  return SHOP_PRODUCTS.filter((p) => {
    if (!p.active) return false;
    if (!p.channels.includes(opts.channel)) return false;
    if (opts.channel === "consumer") {
      if (!opts.tenant || p.tenant !== opts.tenant) return false;
    } else if (p.tenant != null) {
      return false;
    }
    if (opts.category && opts.category !== "alle" && p.category !== opts.category) {
      return false;
    }
    return true;
  });
}

export function getProduct(id: string): ShopProduct | undefined {
  return SHOP_PRODUCTS.find((p) => p.id === id);
}

export function formatKr(n: number): string {
  return `${n.toLocaleString("da-DK")} kr`;
}
