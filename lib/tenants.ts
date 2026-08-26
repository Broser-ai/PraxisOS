import type { PlanId } from "@/lib/plans";
import { getPlan, planLabel, recordLicenseOrder } from "@/lib/plans";

// Tenant-fundamentet for multi-tenant PraxisOS.
// Fil-baseret seed nu — swappes til Supabase i Fase 0/1.

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
    /** Plan-id (starter | practice | practice-ai | clinic) eller legacy label */
    planId: PlanId | string;
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
  /** Owner e-mail fra signup */
  ownerEmail?: string;
  setupComplete?: boolean;
};

export type Service = {
  id: string;
  name: string;
  durationMin: number;
  priceKr: number;
  description: string;
  category: "Negle" | "Fod" | "Æstetik" | "Konsultation" | "Fod-scan";
  modality: ("Klinik" | "Hjemmebesøg" | "Video")[];
};

const ALL_MODULES: ModuleKey[] = [
  "booking", "journal", "payments", "messaging",
  "ai_aria", "ai_scribe", "ai_noshow",
  "ar_journal", "body_scan", "field_service", "marketplace",
];

// -------------------------------------------------------------
// SEED · Bypilar (Aarhus, negle + fodpleje) — pilot-kunde
// -------------------------------------------------------------
const bypilar: Tenant = {
  slug: "bypilar",
  legalName: "by Pilar",
  brand: {
    name: "by Pilar",
    tagline: "Negle- og fodpleje · Aarhus",
    primary: "#1b1a17",
    secondary: "#7a6a55",
    paper: "#f5efe6",
    ink: "#1b1a17",
    accent: "#8a6a3d",
    fontDisplay: "Fraunces",
    fontSans: "Hanken Grotesk",
  },
  domains: ["bypilar.dk", "booking.bypilar.dk", "bypilar.praxis.app"],
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
    planId: "clinic",
    plan: "Trial · alt inkluderet · gratis",
    modules: ALL_MODULES,
    seats: 5,
    status: "trial",
    expiresAt: "2099-12-31",
  },
  setupComplete: true,
  contact: {
    address: "Aarhus, Danmark",
    phone: "+45 93 95 20 41",
    email: "hej@bypilar.dk",
    cvr: "43947079",
  },
  stats: { clients: 2400, rating: 4.9, yearsOperating: 7 },
  services: [
    { id: "gel-mani",   name: "Gel manicure",        durationMin: 45, priceKr: 395, category: "Negle", modality: ["Klinik"], description: "Klassisk gel-manicure, holder 3-4 uger." },
    { id: "nail-art",   name: "Nail art",            durationMin: 60, priceKr: 545, category: "Negle", modality: ["Klinik"], description: "Personligt design — vi tegner det du drømmer om." },
    { id: "fod-med",    name: "Medicinsk fodpleje",  durationMin: 45, priceKr: 495, category: "Fod",   modality: ["Klinik", "Hjemmebesøg"], description: "Til hård hud, ligtorne, nedgroede negle." },
    { id: "fod-lux",    name: "Luksus fodpleje",     durationMin: 75, priceKr: 745, category: "Fod",   modality: ["Klinik", "Hjemmebesøg"], description: "Fuld behandling + scrub, maske, lakering." },
    { id: "fod-scan",   name: "Fod-scan · Physical AI", durationMin: 30, priceKr: 595, category: "Fod-scan", modality: ["Klinik"], description: "Sub-mm 3D-topologi · plantar pressure · klinisk analyse." },
  ],
};

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
    planId: "practice-ai",
    plan: "Aesthetic Pro",
    modules: ALL_MODULES.filter((m) => m !== "body_scan"),
    seats: 4,
    status: "active",
    expiresAt: "2027-12-31",
  },
  setupComplete: true,
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
// globalThis så signup API + RSC deler samme mock-lager i Next/Turbopack
// -------------------------------------------------------------
const g = globalThis as unknown as { __praxisTenants?: Tenant[] };
if (!g.__praxisTenants) {
  g.__praxisTenants = [bypilar, nordlys];
}
const TENANTS: Tenant[] = g.__praxisTenants;

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

export type SignupInput = {
  slug: string;
  legalName: string;
  cvr: string;
  address: string;
  email: string;
  phone: string;
  contactName: string;
  plan: string;
};

/** Opretter en tenant i mock-mode. I prod kalder /api/signup Supabase service_role i stedet. */
export function registerTenant(input: SignupInput): Tenant | { error: string } {
  const slug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
  if (!slug) return { error: "invalid_slug" };
  if (getTenant(slug)) return { error: "slug_taken" };

  const plan = getPlan(input.plan);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const tenant: Tenant = {
    slug,
    legalName: input.legalName,
    brand: {
      name: input.legalName,
      tagline: "Fodpleje · PraxisOS",
      primary: "#1b1a17",
      secondary: "#7a6a55",
      paper: "#f5efe6",
      ink: "#1b1a17",
      accent: "#8a6a3d",
      fontDisplay: "Fraunces",
      fontSans: "Hanken Grotesk",
    },
    domains: [`${slug}.praxis.app`],
    mode: "full",
    locale: "da-DK",
    timezone: "Europe/Copenhagen",
    currency: "DKK",
    license: {
      planId: plan.id,
      plan: planLabel(plan, "trial"),
      modules: [...plan.modules],
      seats: plan.seats,
      status: "trial",
      expiresAt,
    },
    contact: {
      address: input.address || "Danmark",
      phone: input.phone,
      email: input.email,
      cvr: input.cvr,
    },
    ownerEmail: input.email,
    setupComplete: false,
    services: [
      {
        id: "fod-std",
        name: "Standard fodbehandling",
        durationMin: 45,
        priceKr: 300,
        category: "Fod",
        modality: ["Klinik"],
        description: "Klassisk fodbehandling.",
      },
      {
        id: "konsultation",
        name: "Konsultation",
        durationMin: 30,
        priceKr: 0,
        category: "Konsultation",
        modality: ["Klinik", "Video"],
        description: "Første konsultation.",
      },
    ],
  };

  TENANTS.push(tenant);
  recordLicenseOrder({
    tenantSlug: slug,
    planId: plan.id,
    amountKr: 0,
    status: "trial_started",
  });
  return tenant;
}

/** Skift plan / aktiver betalt licens (mock B2B billing). */
export function setTenantPlan(
  slug: string,
  planId: string,
  opts?: { activate?: boolean; seats?: number },
): Tenant | { error: string } {
  const t = getTenant(slug);
  if (!t) return { error: "not_found" };
  const plan = getPlan(planId);
  t.license.planId = plan.id;
  t.license.modules = [...plan.modules];
  t.license.seats = opts?.seats ?? plan.seats;
  if (opts?.activate) {
    t.license.status = "active";
    t.license.plan = planLabel(plan, "active");
    t.license.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    recordLicenseOrder({
      tenantSlug: slug,
      planId: plan.id,
      amountKr: plan.priceMonthlyKr,
      status: "paid",
      paidAt: new Date().toISOString(),
    });
  } else {
    t.license.plan = planLabel(plan, t.license.status === "active" ? "active" : "trial");
  }
  return t;
}

export function activateTenantLicense(slug: string): Tenant | { error: string } {
  const t = getTenant(slug);
  if (!t) return { error: "not_found" };
  const planId = typeof t.license.planId === "string" ? t.license.planId : "practice";
  return setTenantPlan(slug, planId, { activate: true });
}

export function updateTenantSetup(
  slug: string,
  patch: {
    brandName?: string;
    tagline?: string;
    services?: Service[];
    setupComplete?: boolean;
  },
): Tenant | { error: string } {
  const t = getTenant(slug);
  if (!t) return { error: "not_found" };
  if (patch.brandName) t.brand.name = patch.brandName;
  if (patch.tagline) t.brand.tagline = patch.tagline;
  if (patch.services) t.services = patch.services;
  if (patch.setupComplete != null) t.setupComplete = patch.setupComplete;
  return t;
}

// Module gate — bruges af UI og API til at vise 402/403 hvis ikke licenseret
export function hasModule(t: Tenant, m: ModuleKey): boolean {
  if (t.trial?.unlimited) return true;
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
