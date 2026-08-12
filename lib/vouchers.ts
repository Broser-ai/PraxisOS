// Klippekort + gavekort · PraxisOS Vouchers
//
// Klippekort = forudbetalt bundt af sessioner til samme ydelse (rabat på 10-20%)
// Gavekort   = forudbetalt DKK-beløb, brugbart til hvad som helst (3 års udløb iht. dansk lov)
//
// Begge er "vouchers" med fælles audit-log + tokenisering, men har forskellige redemption-regler.

import { BYPILAR_CLIP_PACKAGES } from "@/lib/bypilar-catalog";

export type VoucherKind = "clip" | "gift";

export type VoucherStatus = "active" | "depleted" | "expired" | "cancelled" | "refunded";

export type Voucher = {
  id: string;            // vou_xxxxxxxxxxxx
  code: string;          // 12-cifret human-readable redemption code (fx GIFT-3K7M-9P2L)
  kind: VoucherKind;
  tenant: string;
  status: VoucherStatus;

  // Klippekort-specifikt
  serviceId?: string;    // hvilken ydelse · null for gavekort
  serviceName?: string;
  sessionsTotal?: number;
  sessionsRemaining?: number;

  // Gavekort-specifikt
  balanceOere?: number;     // resterende balance i øre · null for klippekort
  originalBalanceOere?: number;

  // Fælles
  priceKr: number;          // hvad blev betalt (med rabat)
  faceValueKr: number;      // hvad det er værd (uden rabat)
  discountPct: number;
  vatRateBp: number;        // moms-procent (typisk 2500 = 25%)
  buyer: { name: string; email: string };
  recipient?: { name: string; email: string };
  message?: string;         // hilsen ved gavekort
  issuedAt: string;
  expiresAt: string;
  redemptions: Redemption[];
};

export type Redemption = {
  at: string;
  bookingId: string;
  serviceName: string;
  // Klippekort: -1 session. Gavekort: -X øre.
  sessionsUsed?: number;
  amountUsedOere?: number;
};

// -----------------------------------------------------------------------------
// SEED · bypilar har et par eksisterende vouchers
// -----------------------------------------------------------------------------

const today = new Date();
const iso = (offset: number) => { const d = new Date(today); d.setDate(d.getDate() + offset); return d.toISOString(); };

export const vouchers: Voucher[] = [
  {
    id: "vou_clip001",
    code: "CLIP-FOD8-A4K2",
    kind: "clip",
    tenant: "bypilar",
    status: "active",
    serviceId: "fod-std",
    serviceName: "Almindelig fodbehandling",
    sessionsTotal: 10,
    sessionsRemaining: 7,
    priceKr: 2700,
    faceValueKr: 3000,
    discountPct: 10,
    vatRateBp: 2500,
    buyer: { name: "Mette Lindqvist", email: "mette.l@example.com" },
    issuedAt: iso(-90),
    expiresAt: iso(275), // 12 måneder
    redemptions: [
      { at: iso(-85), bookingId: "bk_p1", serviceName: "Fodbehandling", sessionsUsed: 1 },
      { at: iso(-58), bookingId: "bk_x1", serviceName: "Fodbehandling", sessionsUsed: 1 },
      { at: iso(-30), bookingId: "bk_x2", serviceName: "Fodbehandling", sessionsUsed: 1 },
    ],
  },
  {
    id: "vou_clip002",
    code: "CLIP-LUX5-M3W7",
    kind: "clip",
    tenant: "bypilar",
    status: "active",
    serviceId: "fod-lux",
    serviceName: "Luksus fodbehandling",
    sessionsTotal: 5,
    sessionsRemaining: 5,
    priceKr: 2470,
    faceValueKr: 2975,
    discountPct: 17,
    vatRateBp: 2500,
    buyer: { name: "Clara Winther", email: "clara.w@example.com" },
    issuedAt: iso(-10),
    expiresAt: iso(355),
    redemptions: [],
  },
  {
    id: "vou_gift001",
    code: "GIFT-9P2L-3K7M",
    kind: "gift",
    tenant: "bypilar",
    status: "active",
    balanceOere: 50000,           // 500 kr tilbage
    originalBalanceOere: 100000,  // af oprindeligt 1.000 kr
    priceKr: 1000,
    faceValueKr: 1000,
    discountPct: 0,
    vatRateBp: 2500,
    buyer: { name: "Jonas Brandt", email: "jonas@brandt.dk" },
    recipient: { name: "Lise Brandt", email: "lise.b@example.com" },
    message: "Tillykke med fødselsdagen, mor — håber du nyder det. ❤️ Jonas",
    issuedAt: iso(-65),
    expiresAt: iso(1030), // 3 år iht. dansk lov
    redemptions: [
      { at: iso(-12), bookingId: "bk_y1", serviceName: "Manicure", amountUsedOere: 23900 },
      { at: iso(-12), bookingId: "bk_y1", serviceName: "Manicure · tip", amountUsedOere: 26100 },
    ],
  },
  {
    id: "vou_gift002",
    code: "GIFT-Q4R8-7T1Z",
    kind: "gift",
    tenant: "bypilar",
    status: "active",
    balanceOere: 200000,
    originalBalanceOere: 200000,
    priceKr: 2000,
    faceValueKr: 2000,
    discountPct: 0,
    vatRateBp: 2500,
    buyer: { name: "Per Sørensen", email: "per.s@example.com" },
    recipient: { name: "Helle Sørensen", email: "helle.s@example.com" },
    message: "Tak for alt, kære. Skat.",
    issuedAt: iso(-3),
    expiresAt: iso(1092),
    redemptions: [],
  },
];

// -----------------------------------------------------------------------------
// Standard-pakker (klippekort-templates) klinikker kan tilbyde
// -----------------------------------------------------------------------------

export type ClipPackage = {
  id: string;
  tenant: string;
  serviceId: string;
  serviceName: string;
  sessions: number;
  discountPct: number;
  faceValueKr: number;
  priceKr: number;
  expiryMonths: number;
  highlighted?: boolean;
};

export const clipPackages: ClipPackage[] = [
  ...BYPILAR_CLIP_PACKAGES,
];

// -----------------------------------------------------------------------------
// Hjælpefunktioner
// -----------------------------------------------------------------------------

export function genCode(kind: VoucherKind): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ234567";
  const pick = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${kind === "clip" ? "CLIP" : "GIFT"}-${pick(4)}-${pick(4)}`;
}

export function fmtBalance(v: Voucher): string {
  if (v.kind === "clip") return `${v.sessionsRemaining} / ${v.sessionsTotal} sessioner`;
  return `${((v.balanceOere ?? 0) / 100).toFixed(2)} kr`;
}

export function findVoucherByCode(code: string, tenant?: string): Voucher | undefined {
  return vouchers.find((v) => v.code === code.toUpperCase() && (!tenant || v.tenant === tenant));
}

export function listVouchers(opts?: { tenant?: string; kind?: VoucherKind; status?: VoucherStatus }): Voucher[] {
  return vouchers.filter((v) => {
    if (opts?.tenant && v.tenant !== opts.tenant) return false;
    if (opts?.kind && v.kind !== opts.kind) return false;
    if (opts?.status && v.status !== opts.status) return false;
    return true;
  });
}

export function listClipPackages(tenant: string): ClipPackage[] {
  return clipPackages.filter((p) => p.tenant === tenant);
}
