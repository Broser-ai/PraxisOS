// PraxisOS · B2B licensplaner — single source of truth
// Bruges af pricing, signup, registerTenant, admin/plan og license-API.

import type { ModuleKey } from "@/lib/tenants";

export type PlanId = "starter" | "practice" | "practice-ai" | "clinic";

export type LicensePlan = {
  id: PlanId;
  name: string;
  /** Visningspris (kr/md) — 0 = trial/gratis */
  priceMonthlyKr: number;
  periodLabel: string;
  tagline: string;
  seats: number;
  modules: ModuleKey[];
  features: string[];
  highlighted?: boolean;
  cta: string;
  /** Enterprise / kontakt */
  customQuote?: boolean;
};

export const PLANS: LicensePlan[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthlyKr: 0,
    periodLabel: "/md · trial 30 dage",
    tagline: "Kerne til solister og pilot.",
    seats: 1,
    modules: ["booking", "journal", "messaging", "ai_aria", "ai_scribe"],
    features: [
      "Overblik · kalender · klienter · bookings",
      "AI-agent (Aria standard)",
      "AI-diktering",
      "Samlet chat",
      "1 behandler-seat",
    ],
    cta: "Start gratis",
  },
  {
    id: "practice",
    name: "Practice",
    priceMonthlyKr: 595,
    periodLabel: "/md",
    tagline: "Kerne + tilvalg til fodplejeklinik.",
    seats: 3,
    modules: ["booking", "journal", "payments", "messaging", "marketplace", "ai_aria", "ai_scribe"],
    features: [
      "Hele kernen",
      "Tilvalg: PraxisOS Pay",
      "Tilvalg: NemSMS",
      "Tilvalg: Webshop · klippekort",
      "Tilvalg: Indberetning (underpunkter)",
      "3 staff-seats",
    ],
    highlighted: true,
    cta: "Vælg Practice",
  },
  {
    id: "practice-ai",
    name: "Practice + AI",
    priceMonthlyKr: 1295,
    periodLabel: "/md",
    tagline: "Kerne med flere AI-agent-tilvalg.",
    seats: 3,
    modules: [
      "booking",
      "journal",
      "payments",
      "messaging",
      "marketplace",
      "ai_aria",
      "ai_scribe",
      "ai_noshow",
    ],
    features: [
      "Alt i Practice",
      "Flere agent-tilvalg (Aria, Magnus, Liv …)",
      "No-show prediktor",
      "Samlet agent-chat",
    ],
    cta: "Vælg Practice + AI",
  },
  {
    id: "clinic",
    name: "Clinic",
    priceMonthlyKr: 2490,
    periodLabel: "/md",
    tagline: "Flere seats + felt. Fod-scan ikke inkluderet (pause).",
    seats: 8,
    modules: [
      "booking",
      "journal",
      "payments",
      "messaging",
      "marketplace",
      "ai_aria",
      "ai_scribe",
      "ai_noshow",
      "field_service",
      "ar_journal",
    ],
    features: [
      "Alt i Practice + AI",
      "Felt-service / hjemmebesøg",
      "AR/CV-journal",
      "8 staff-seats",
      "Fod-scan: pause (ikke aktiv)",
    ],
    cta: "Vælg Clinic",
  },
];

export function getPlan(id: string | undefined | null): LicensePlan {
  return PLANS.find((p) => p.id === id) ?? PLANS.find((p) => p.id === "practice")!;
}

export function isPlanId(id: string): id is PlanId {
  return PLANS.some((p) => p.id === id);
}

export function formatPlanPrice(plan: LicensePlan): string {
  if (plan.customQuote) return "tilbud";
  if (plan.priceMonthlyKr === 0) return "0 kr";
  return `${plan.priceMonthlyKr.toLocaleString("da-DK")} kr`;
}

export function planLabel(plan: LicensePlan, status: "trial" | "active" | "suspended" = "trial"): string {
  if (status === "trial") return `${plan.name} · trial`;
  if (status === "suspended") return `${plan.name} · suspenderet`;
  return plan.name;
}

/** Mock SaaS-licensordrer (B2B) — ikke PraxisOS Pay (patient). */
export type LicenseOrder = {
  id: string;
  tenantSlug: string;
  planId: PlanId;
  amountKr: number;
  status: "trial_started" | "paid" | "cancelled";
  createdAt: string;
  paidAt?: string;
};

const gOrders = globalThis as unknown as { __praxisLicenseOrders?: LicenseOrder[] };
if (!gOrders.__praxisLicenseOrders) {
  gOrders.__praxisLicenseOrders = [];
}
const LICENSE_ORDERS: LicenseOrder[] = gOrders.__praxisLicenseOrders;

export function listLicenseOrders(tenantSlug?: string): LicenseOrder[] {
  return tenantSlug
    ? LICENSE_ORDERS.filter((o) => o.tenantSlug === tenantSlug)
    : [...LICENSE_ORDERS];
}

export function recordLicenseOrder(order: Omit<LicenseOrder, "id" | "createdAt"> & { id?: string }): LicenseOrder {
  const row: LicenseOrder = {
    id: order.id ?? `lic_${Date.now().toString(36)}`,
    tenantSlug: order.tenantSlug,
    planId: order.planId,
    amountKr: order.amountKr,
    status: order.status,
    createdAt: new Date().toISOString(),
    paidAt: order.paidAt,
  };
  LICENSE_ORDERS.unshift(row);
  return row;
}
