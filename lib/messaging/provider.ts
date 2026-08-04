import type { OutboxMessage } from "@/lib/integrations/types";

export type SendResult =
  | { ok: true; providerRef: string; provider: OutboxMessage["provider"] }
  | { ok: false; errorCode: string; provider: OutboxMessage["provider"] };

export function messagingMode(): "mock" | "live" {
  const mode = (process.env.MESSAGING_MODE ?? "mock").toLowerCase();
  if (mode === "live") return "live";
  return "mock";
}

export function nemsmsConfigured(): boolean {
  return Boolean(
    process.env.NEMSMS_API_KEY &&
      process.env.NEMSMS_BASE_URL &&
      process.env.NEMSMS_SENDER_ID,
  );
}

/** Cheap/self-host SMS gateway (Android SMS Gateway, GatewayAPI-compatible REST, etc.). */
export function smsGatewayConfigured(): boolean {
  return Boolean(process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_API_KEY);
}

/**
 * Deliver one outbox row.
 * - mock: always succeeds
 * - channel sms → SMS_GATEWAY_* when live
 * - channel nemsms → NEMSMS_* when live
 * - live without keys: fail closed
 */
export async function deliverOutboxMessage(msg: OutboxMessage): Promise<SendResult> {
  if (messagingMode() === "mock") {
    return {
      ok: true,
      providerRef: `mock_${msg.id}`,
      provider: "mock",
    };
  }

  if (msg.channel === "email") {
    // Email provider not wired yet — keep queued failure explicit in live.
    return { ok: false, errorCode: "EMAIL_PROVIDER_NOT_CONFIGURED", provider: "none" };
  }

  if (msg.channel === "sms") {
    if (!smsGatewayConfigured()) {
      return { ok: false, errorCode: "SMS_GATEWAY_NOT_CONFIGURED", provider: "none" };
    }
    const base = process.env.SMS_GATEWAY_URL!.replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${process.env.SMS_GATEWAY_API_KEY}`,
        },
        body: JSON.stringify({
          phoneNumbers: [msg.toPhone],
          message: msg.body,
          deviceActive: true,
        }),
      });
      if (!res.ok) {
        return { ok: false, errorCode: `SMS_GATEWAY_HTTP_${res.status}`, provider: "sms_gateway" };
      }
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      return {
        ok: true,
        providerRef: json.id ?? `sms_${msg.id}`,
        provider: "sms_gateway",
      };
    } catch {
      return { ok: false, errorCode: "SMS_GATEWAY_NETWORK", provider: "sms_gateway" };
    }
  }

  // nemsms
  if (!nemsmsConfigured()) {
    return { ok: false, errorCode: "NEMSMS_NOT_CONFIGURED", provider: "none" };
  }

  const base = process.env.NEMSMS_BASE_URL!.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.NEMSMS_API_KEY}`,
        "x-sender-id": process.env.NEMSMS_SENDER_ID ?? "",
      },
      body: JSON.stringify({
        to: msg.toPhone,
        body: msg.body,
        category: msg.category,
        clientRef: msg.id,
        tenant: msg.tenant,
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        errorCode: `NEMSMS_HTTP_${res.status}`,
        provider: "nemsms_http",
      };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return {
      ok: true,
      providerRef: json.id ?? `nemsms_${msg.id}`,
      provider: "nemsms_http",
    };
  } catch {
    return {
      ok: false,
      errorCode: "NEMSMS_NETWORK",
      provider: "nemsms_http",
    };
  }
}
