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

/**
 * Deliver one outbox row.
 * - mock: always succeeds (dev / no KOMBIT keys)
 * - live without keys: fails closed with clear error (does not pretend sent)
 * - live with keys: HTTP POST stub to NEMSMS_BASE_URL (real contract TBD with KOMBIT)
 */
export async function deliverOutboxMessage(msg: OutboxMessage): Promise<SendResult> {
  if (messagingMode() === "mock" || !nemsmsConfigured()) {
    if (messagingMode() === "live" && !nemsmsConfigured()) {
      return {
        ok: false,
        errorCode: "NEMSMS_NOT_CONFIGURED",
        provider: "none",
      };
    }
    return {
      ok: true,
      providerRef: `mock_${msg.id}`,
      provider: "mock",
    };
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
