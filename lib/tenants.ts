// Tenant-fundamentet for multi-tenant PraxisOS.
// Fil-baseret seed nu — swappes til Supabase i Fase 0/1.

import { bypilarAllServices } from "@/lib/bypilar-catalog";

export type Mode = "headless" | "full" | "hybrid";
export type ModuleKey =
  | "booking"
  | "journal"
  | "payments"
  | "messaging"
  | "ai_aria"
  | "ai_scribe"
  | "ai_noshow"
  | "ar_journal"
  | "body_scan"
  | "field_service"
  | "marketplace";

export type Tenant = {
  slug: string;
  legalName: string;
  brand: {
    name: string;
    tagline: string;
    primary: string; // hex
    secondary: string;
    paper: string;
    ink: string;
    accent: string;
    fontDisplay: string;
    fontSans: string;
  };
  domains: string[];
  mode: Mode;
  locale: string;
  timezone: string;
  currency: "DKK" | "EUR" | "SEK" | "NOK";
  /** Trial-tenant der får alle moduler gratis indtil videre. by Pilar er pilot-kunde. */
  trial?: { unlimited: true; reason: string; since: string };
  license: {
    plan: string;
    modules: ModuleKey[];
    seats: number;
    status: "active" | "trial" | "suspended";
    expiresAt: string;
  };
  contact: {
    address: string;
    phone: string;
    email: string;
    cvr?: string;
  };
  services: Service[];
  stats?: { clients: number; rating: number; yearsOperating: number };
};

export type ServiceAddOn = {
  id: string;
  name: string;
  /** Godkendt tillægspris. Udelades når pris ikke er godkendt. */
  priceKr?: number;
  durationMin?: number;
  /** false = vises, men opkræves ikke (mangler godkendt pris / review). */
  chargeable: boolean;
  reviewNote?: string;
};

export type Service = {
  id: string;
  name: string;
  /** Kort teaser til cards. Fallback: description. */
  shortDescription?: string;
  description: string;
  /** Udelades når varighed ikke er godkendt i kataloget (må ikke gættes). */
  durationMin?: number;
  priceKr: number;
  category: "Negle" | "Fod" | "Æstetik" | "Konsultation" | "Fod-scan";
  modality: ("Klinik" | "Hjemmebesøg" | "Video")[];
  /** default true — inactive services skjules i offentlig API/booking. */
  active?: boolean;
  bookable?: boolean;
  addOns?: ServiceAddOn[];
  reviewNotes?: string[];
};

const ALL_MODULES: ModuleKey[] = [
  "booking", "journal", "payments", "messaging",
  "ai_aria", "ai_scribe", "ai_noshow",
  "ar_journal", "body_scan", "field_service", "marketplace",
];

// -------------------------------------------------------------
// SEED · Bypilar (Aarhus) — fodpleje / fodterapeut · pilot-kunde
// Katalog: lib/bypilar-catalog.ts (single source of truth)
// -------------------------------------------------------------
const bypilar: Tenant = {
  slug: "bypilar",
  legalName: "by Pilar",
  brand: {
    name: "by Pilar",
    tagline: "Fodpleje & fodterapeut · Aarhus",
    primary: "#1b1a17",
    secondary: "#7a6a55",
    paper: "#f5efe6",
    ink: "#1b1a17",
    accent: "#8a6a3d",
    fontDisplay: "Fraunces",
    fontSans: "Hanken Grotesk",
  },
  domains: ["bypilar.dk", "www.bypilar.dk", "booking.bypilar.dk", "app.bypilar.dk", "bypilar.praxis.app"],
  mode: "hybrid", // headless API til deres website + full admin
  locale: "da-DK",
  timezone: "Europe/Copenhagen",
  currency: "DKK",
  trial: {
    unlimited: true,
    reason: "Pilot-kunde — by Pilar er allerede i luften og kører gratis indtil PraxisOS er commerciel.",
    since: "2026-06-15",
  },
  license: {
    plan: "Trial · alt inkluderet · gratis",
    modules: ALL_MODULES,
    seats: 5,
    status: "trial",
    expiresAt: "2099-12-31",
  },
  contact: {
    address: "Aarhus, Danmark",
    phone: "+45 93 95 20 41",
    email: "hej@bypilar.dk",
    cvr: "43947079",
  },
  stats: { clients: 2400, rating: 4.9, yearsOperating: 7 },
  services: bypilarAllServices(),
};

/** Aktive offentlige services (booking/API/website). */
export function getActiveServices(t: Tenant): Service[] {
  return t.services.filter((s) => s.active !== false);
}

// -------------------------------------------------------------
// SEED · Nordlys Klinik (vores fiktive demo-tenant)
// -------------------------------------------------------------
const nordlys: Tenant = {
  slug: "nordlys",
  legalName: "Nordlys Klinik ApS",
  brand: {
    name: "Nordlys Klinik",
    tagline: "Hud · æstetik · klinisk dermatologi",
    primary: "#1b1a17",
    secondary: "#2f4a7c",
    paper: "#f7f3ec",
    ink: "#1b1a17",
    accent: "#2f4a7c",
    fontDisplay: "Fraunces",
    fontSans: "Hanken Grotesk",
  },
  domains: ["nordlys.praxis.app"],
  mode: "full",
  locale: "da-DK",
  timezone: "Europe/Copenhagen",
  currency: "DKK",
  license: {
    plan: "Aesthetic Pro",
    modules: ALL_MODULES.filter((m) => m !== "body_scan"),
    seats: 4,
    status: "active",
    expiresAt: "2027-12-31",
  },
  contact: {
    address: "København K, Danmark",
    phone: "+45 70 70 12 34",
    email: "klinik@nordlys.dk",
    cvr: "12345678",
  },
  stats: { clients: 1180, rating: 4.8, yearsOperating: 3 },
  services: [
    { id: "hudanalyse",  name: "Hudanalyse · AR-scan",  durationMin: 45, priceKr: 695, category: "Æstetik", modality: ["Klinik"], description: "Detaljeret AR hud-analyse med behandlings-plan." },
    { id: "filler",      name: "Filler",                 durationMin: 45, priceKr: 2495, category: "Æstetik", modality: ["Klinik"], description: "Hyaluronsyre-filler." },
    { id: "botox",       name: "Botox-konsultation",     durationMin: 30, priceKr: 0, category: "Konsultation", modality: ["Klinik", "Video"], description: "Gratis konsultation." },
    { id: "acne-forløb", name: "Acne-forløb · 8 sessioner", durationMin: 30, priceKr: 4995, category: "Æstetik", modality: ["Klinik"], description: "Protokol-baseret behandling over 8 uger." },
  ],
};

// -------------------------------------------------------------
// "DB" — fil-baseret nu, swappes til Supabase senere
// -------------------------------------------------------------
const TENANTS: Tenant[] = [bypilar, nordlys];

export function listTenants(): Tenant[] {
  return TENANTS;
}

export function getTenant(slug: string): Tenant | undefined {
  return TENANTS.find((t) => t.slug === slug);
}

export function getTenantByDomain(host: string): Tenant | undefined {
  const h = host.toLowerCase().split(":")[0];
  return TENANTS.find((t) => t.domains.some((d) => h === d || h.endsWith("." + d)));
}

// Module gate — bruges af UI og API til at vise 402/403 hvis ikke licenseret
export function hasModule(t: Tenant, m: ModuleKey): boolean {
  return t.license.modules.includes(m);
}

export const MODULE_LABELS: Record<ModuleKey, string> = {
  booking: "Booking",
  journal: "Journal",
  payments: "Betaling",
  messaging: "Kommunikation",
  ai_aria: "Aria · AI-receptionist",
  ai_scribe: "AI Scribe",
  ai_noshow: "No-show prediktor",
  ar_journal: "AR/CV journal",
  body_scan: "Physical AI · Fod-scan",
  field_service: "Felt-service",
  marketplace: "App marketplace",
};
