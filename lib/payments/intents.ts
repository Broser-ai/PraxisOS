import { getIntegrationStore } from "@/lib/integrations/store";
import type { PaymentIntentRecord } from "@/lib/integrations/types";
import {
  calcFee,
  computeRiskScore,
  TENANT_PAYMENT_CONFIG,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/payments";

export type { PaymentIntentRecord };

function newId(): string {
  return `pi_${Math.random().toString(36).slice(2, 14)}`;
}

export function paymentsMode(): "mock" | "live" {
  const mode = (process.env.PAYMENTS_MODE ?? "mock").toLowerCase();
  if (mode === "live") return "live";
  return "mock";
}

export function mobilepayConfigured(): boolean {
  return Boolean(
    process.env.MOBILEPAY_CLIENT_ID &&
      process.env.MOBILEPAY_CLIENT_SECRET &&
      (process.env.MOBILEPAY_SUBSCRIPTION_KEY || process.env.MOBILEPAY_API_KEY),
  );
}

export function createPaymentIntent(input: {
  tenant: string;
  amountKr: number;
  method: PaymentMethod;
  bookingId?: string;
  mobilepayPhone?: string;
  returnUrl?: string;
  isNewClient?: boolean;
}): PaymentIntentRecord | { error: string } {
  const cfg = TENANT_PAYMENT_CONFIG[input.tenant];
  if (!cfg) return { error: "tenant_payment_not_configured" };
  if (!cfg.enabledMethods.includes(input.method)) {
    return { error: "method_not_enabled" };
  }
  if (!(input.amountKr > 0)) return { error: "invalid_amount" };

  const risk = computeRiskScore({
    amountKr: input.amountKr,
    paymentMethod: input.method,
    isNewClient: input.isNewClient ?? true,
    isRecurring: false,
  });
  if (risk.decision === "decline") {
    return { error: "risk_declined" };
  }

  const now = new Date().toISOString();
  const provider: PaymentIntentRecord["provider"] =
    paymentsMode() === "live" && input.method === "mobilepay"
      ? mobilepayConfigured()
        ? "mobilepay"
        : "none"
      : "mock";

  const intent: PaymentIntentRecord = {
    id: newId(),
    tenant: input.tenant,
    bookingId: input.bookingId,
    amountKr: input.amountKr,
    currency: "DKK",
    method: input.method,
    status: "pending",
    mode: cfg.paymentMode,
    provider,
    mobilepayPhone: input.mobilepayPhone,
    returnUrl: input.returnUrl,
    createdAt: now,
    updatedAt: now,
  };

  getIntegrationStore().paymentIntents.unshift(intent);
  return intent;
}

export function getPaymentIntent(
  tenant: string,
  id: string,
): PaymentIntentRecord | null {
  return (
    getIntegrationStore().paymentIntents.find(
      (p) => p.tenant === tenant && p.id === id,
    ) ?? null
  );
}

export function listPaymentIntents(
  tenant: string,
  limit = 50,
): PaymentIntentRecord[] {
  return getIntegrationStore()
    .paymentIntents.filter((p) => p.tenant === tenant)
    .slice(0, limit);
}

/**
 * Advance intent in mock mode (or live without MobilePay keys → fail closed).
 * auth_only → authorized; prepay → captured.
 */
export async function completePaymentIntent(input: {
  tenant: string;
  id: string;
}): Promise<PaymentIntentRecord | { error: string }> {
  const intent = getPaymentIntent(input.tenant, input.id);
  if (!intent) return { error: "not_found" };
  if (intent.status !== "pending") return { error: "invalid_status" };

  if (intent.provider === "none") {
    intent.status = "failed";
    intent.updatedAt = new Date().toISOString();
    return { error: "mobilepay_not_configured" };
  }

  if (intent.provider === "mobilepay" && paymentsMode() === "live") {
    // Live MobilePay ePayment create — requires merchant onboarding.
    // Until keys + agreement exist, fail closed rather than fake capture.
    const ok = await tryMobilePayCreatePayment(intent);
    if (!ok.ok) {
      intent.status = "failed";
      intent.updatedAt = new Date().toISOString();
      return { error: ok.error };
    }
    intent.providerRef = ok.ref;
  } else {
    intent.providerRef = `mock_${intent.id}`;
  }

  const now = new Date().toISOString();
  const next: PaymentStatus =
    intent.mode === "prepay" ? "captured" : "authorized";
  intent.status = next;
  intent.updatedAt = now;
  intent.authorizedAt = now;
  if (next === "captured") intent.capturedAt = now;
  return intent;
}

async function tryMobilePayCreatePayment(
  intent: PaymentIntentRecord,
): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  if (!mobilepayConfigured()) {
    return { ok: false, error: "mobilepay_not_configured" };
  }
  const base = (
    process.env.MOBILEPAY_API_BASE ?? "https://api.mobilepay.dk"
  ).replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/payments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.MOBILEPAY_CLIENT_SECRET}`,
        "ocp-apim-subscription-key":
          process.env.MOBILEPAY_SUBSCRIPTION_KEY ??
          process.env.MOBILEPAY_API_KEY ??
          "",
      },
      body: JSON.stringify({
        amount: Math.round(intent.amountKr * 100),
        currency: "DKK",
        reference: intent.id,
        phoneNumber: intent.mobilepayPhone,
        returnUrl: intent.returnUrl,
      }),
    });
    if (!res.ok) return { ok: false, error: `mobilepay_http_${res.status}` };
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, ref: json.id ?? intent.id };
  } catch {
    return { ok: false, error: "mobilepay_network" };
  }
}

export function intentPublicView(intent: PaymentIntentRecord) {
  const { feeKr, netKr } = calcFee(intent.amountKr, intent.tenant);
  return {
    id: intent.id,
    tenant: intent.tenant,
    bookingId: intent.bookingId,
    amountKr: intent.amountKr,
    feeKr,
    netToTenantKr: netKr,
    currency: intent.currency,
    method: intent.method,
    status: intent.status,
    mode: intent.mode,
    provider: intent.provider,
    providerRef: intent.providerRef,
    createdAt: intent.createdAt,
    authorizedAt: intent.authorizedAt,
    capturedAt: intent.capturedAt,
  };
}
