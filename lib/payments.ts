// PraxisOS Pay · vores egen betalings-engine
//
// Multi-tenant ledger + risk-engine + event-system + settlement.
// Betalingsmetoder vi understøtter: MobilePay, Dankort, kort, wallets, BNPL, SEPA, Vipps, Swish.
//
// Arkitektur:
//   1. Payment Intents       — auth, capture, refund, void
//   2. PraxisRisk            — vores eget no-show + fraud-score (genbruger ML fra Aria)
//   3. PraxisTrust 2         — egen step-up verifikation (MitID-baseret eller 2FA)
//   4. Event-bus             — interne payment.* events, andre moduler abonnerer
//   5. Settlement-engine     — daglig clearing pr. tenant + payout
//   6. Tokenisering          — saved methods til klippekort/abonnement

export type PaymentMethod =
  | "mobilepay"   // Danmark · ~95% har det
  | "dankort"
  | "card"
  | "applepay"
  | "googlepay"
  | "klarna"
  | "sepa"
  | "vipps"
  | "swish";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  mobilepay: "MobilePay",
  dankort:   "Dankort",
  card:      "Kort (Visa / MC / Amex)",
  applepay:  "Apple Pay",
  googlepay: "Google Pay",
  klarna:    "Klarna · betal i rater",
  sepa:      "SEPA · direkte debit",
  vipps:     "Vipps",
  swish:     "Swish",
};

export const PAYMENT_METHOD_ICON: Record<PaymentMethod, string> = {
  mobilepay: "#5A78FF",
  dankort:   "#C50C0C",
  card:      "#1b1a17",
  applepay:  "#000000",
  googlepay: "#4285F4",
  klarna:    "#FFA8CD",
  sepa:      "#003399",
  vipps:     "#FF5B24",
  swish:     "#F2A627",
};

export type PaymentStatus =
  | "pending"        // venter på godkendelse
  | "authorized"     // reserveret, ikke trukket
  | "captured"       // trukket
  | "settled"        // udbetalt til klinik
  | "refunded"
  | "failed"
  | "cancelled";

export type PaymentMode = "prepay" | "auth_only" | "in_clinic";

export const TENANT_PAYMENT_CONFIG: Record<string, {
  enabledMethods: PaymentMethod[];
  defaultMethod: PaymentMethod;
  paymentMode: PaymentMode;
  currency: string;
  // Vi-er-platformen — hver tenant er en sub-ledger hos os
  payLedgerId: string;
  feeRateBp: number;     // basispoint vi tager (100bp = 1%)
  fixedFeeOere: number;  // øre pr. transaktion
  payoutDelayDays: number;
  riskThreshold: number; // PraxisRisk score (0-100) hvor vi step-up'er
}> = {
  bypilar: {
    enabledMethods: ["mobilepay", "dankort", "card", "applepay", "klarna"],
    defaultMethod: "mobilepay",
    paymentMode: "auth_only", // reservér ved booking, capture ved fremmøde
    currency: "DKK",
    payLedgerId: "pay_ldg_bypilar_trial",
    feeRateBp: 0,        // trial · PraxisOS opkræver 0 platform-fee
    fixedFeeOere: 0,
    payoutDelayDays: 2,
    riskThreshold: 35,
  },
  nordlys: {
    enabledMethods: ["mobilepay", "card", "applepay", "googlepay", "klarna"],
    defaultMethod: "card",
    paymentMode: "prepay",
    currency: "DKK",
    payLedgerId: "pay_ldg_nordlys_001",
    feeRateBp: 145,
    fixedFeeOere: 50,
    payoutDelayDays: 2,
    riskThreshold: 30,
  },
};

export type Payment = {
  id: string;           // pay_xxxxxxxxxxxx
  intentId: string;     // pi_xxxxxxxxxxxx
  bookingId: string;
  tenant: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amountKr: number;
  feeKr: number;
  netToTenantKr: number;
  currency: string;
  createdAt: string;
  capturedAt?: string;
  settledAt?: string;
  refundedAt?: string;
  trust?: { result: "frictionless" | "step_up" | "exempt"; method: "mitid" | "biometric" | "otp" };
  risk?: { score: number; signals: string[]; decision: "approve" | "challenge" | "decline" };
};

export function calcFee(amountKr: number, tenant: string): { feeKr: number; netKr: number } {
  const cfg = TENANT_PAYMENT_CONFIG[tenant] ?? TENANT_PAYMENT_CONFIG.bypilar;
  const rateFee = (amountKr * cfg.feeRateBp) / 10000;
  const fixedFee = cfg.fixedFeeOere / 100;
  const feeKr = Math.round((rateFee + fixedFee) * 100) / 100;
  return { feeKr, netKr: Math.round((amountKr - feeKr) * 100) / 100 };
}

// PraxisOS interne event-typer — andre moduler kan abonnere (journal, marketing, Aria)
export const PRAXIS_PAY_EVENTS = {
  "payment.intent_created":  "Intent oprettet · venter på verifikation",
  "payment.authorized":      "Betaling reserveret · midler holdt",
  "payment.captured":        "Beløb trukket fra klientens konto",
  "payment.capture_failed":  "Capture mislykkedes · escalation til support",
  "payment.refunded":        "Tilbagebetalt · trigger journal-note",
  "payment.cancelled":       "Annulleret · trigger Aria genbookings-flow",
  "payment.disputed":        "Klient bestred betaling · sag åbnet",
  "settlement.batch_ready":  "Daglig clearing færdig · pr. tenant",
  "settlement.payout_sent":  "Udbetaling sendt til klinikkens NemKonto",
  "risk.high_score":         "PraxisRisk >70 · manual review-kø",
  "trust.step_up_required":  "MitID step-up nødvendig",
};

// PraxisRisk · eget scoring-system der genbruger no-show prediktion
export function computeRiskScore(opts: {
  amountKr: number;
  clientNoShowRisk?: number;
  paymentMethod: PaymentMethod;
  isNewClient: boolean;
  isRecurring: boolean;
}): { score: number; signals: string[]; decision: "approve" | "challenge" | "decline" } {
  let score = 5;
  const signals: string[] = [];

  if (opts.amountKr > 2000) { score += 8; signals.push("højt beløb"); }
  if (opts.amountKr > 5000) { score += 12; signals.push("meget højt beløb"); }
  if (opts.isNewClient)     { score += 18; signals.push("ny klient"); }
  if (opts.clientNoShowRisk && opts.clientNoShowRisk > 40) {
    score += Math.round(opts.clientNoShowRisk * 0.4);
    signals.push("forhøjet no-show-historik");
  }
  if (opts.paymentMethod === "klarna" && opts.amountKr > 3000) {
    score += 6; signals.push("BNPL stor sum");
  }
  if (opts.isRecurring) { score -= 10; signals.push("kendt mønster"); }

  score = Math.max(0, Math.min(100, score));
  const decision =
    score >= 70 ? "decline" :
    score >= 35 ? "challenge" :
    "approve";

  return { score, signals, decision };
}

// PraxisTrust 2 — step-up verifikation (vores 3DS-erstatning)
export const TRUST_METHODS = {
  mitid:     { label: "MitID · NemID-app",       latency: "~6s" },
  biometric: { label: "Touch ID / Face ID",       latency: "~1s" },
  otp:       { label: "SMS engangskode",          latency: "~4s" },
};
