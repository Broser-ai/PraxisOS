import { getIntegrationStore } from "@/lib/integrations/store";
import type {
  NotificationChannel,
  NotificationKind,
  NotificationRecord,
} from "@/lib/integrations/types";
import { drainOutbox, enqueueRawMessage } from "@/lib/messaging/outbox";

function newId(): string {
  return `ntf_${Math.random().toString(36).slice(2, 12)}`;
}

export type NotifyInput = {
  tenant: string;
  kind: NotificationKind;
  title: string;
  body: string;
  channels?: NotificationChannel[];
  audience?: "staff" | "client" | "both";
  recipientName?: string;
  toPhone?: string;
  toEmail?: string;
  bookingId?: string;
  clientId?: string;
  accountId?: string;
  meta?: Record<string, string>;
  /** If true, drain due SMS/email immediately after enqueue. */
  flush?: boolean;
};

export async function sendNotification(
  input: NotifyInput,
): Promise<NotificationRecord | { error: string }> {
  if (!input.title.trim() || !input.body.trim()) {
    return { error: "missing_title_or_body" };
  }

  const channels = input.channels?.length
    ? input.channels
    : defaultChannels(input.kind, input.audience ?? "staff");
  const audience = input.audience ?? (channels.includes("in_app") ? "staff" : "client");
  const outboxIds: string[] = [];
  let deliveryFails = 0;
  let deliveryAttempts = 0;

  if (channels.includes("sms")) {
    deliveryAttempts += 1;
    if (!input.toPhone) {
      deliveryFails += 1;
    } else {
      const sms = enqueueRawMessage({
        tenant: input.tenant,
        channel: "sms",
        toPhone: input.toPhone,
        recipientName: input.recipientName ?? "Modtager",
        body: `${input.title}\n${input.body}`.slice(0, 480),
        bookingId: input.bookingId,
        clientId: input.clientId,
      });
      if ("error" in sms) deliveryFails += 1;
      else outboxIds.push(sms.id);
    }
  }

  if (channels.includes("email")) {
    deliveryAttempts += 1;
    if (!input.toEmail) {
      deliveryFails += 1;
    } else {
      const email = enqueueRawMessage({
        tenant: input.tenant,
        channel: "email",
        toEmail: input.toEmail,
        recipientName: input.recipientName ?? "Modtager",
        body: `${input.title}\n\n${input.body}`,
        bookingId: input.bookingId,
        clientId: input.clientId,
      });
      if ("error" in email) deliveryFails += 1;
      else outboxIds.push(email.id);
    }
  }

  if (input.flush && outboxIds.length > 0) {
    await drainOutbox(20);
  }

  const wantsInApp = channels.includes("in_app");
  const status: NotificationRecord["status"] =
    deliveryAttempts > 0 && deliveryFails === deliveryAttempts && !wantsInApp
      ? "failed"
      : deliveryFails > 0
        ? "partial"
        : wantsInApp || outboxIds.length > 0
          ? "delivered"
          : "queued";

  const record: NotificationRecord = {
    id: newId(),
    tenant: input.tenant,
    kind: input.kind,
    title: input.title.trim(),
    body: input.body.trim(),
    channels,
    status: wantsInApp && outboxIds.length === 0 ? "delivered" : status,
    audience,
    recipientName: input.recipientName,
    toPhone: input.toPhone,
    toEmail: input.toEmail,
    bookingId: input.bookingId,
    clientId: input.clientId,
    accountId: input.accountId,
    outboxIds,
    createdAt: new Date().toISOString(),
    meta: input.meta,
  };

  getIntegrationStore().notifications.unshift(record);
  return record;
}

function defaultChannels(
  kind: NotificationKind,
  audience: "staff" | "client" | "both",
): NotificationChannel[] {
  if (audience === "staff") return ["in_app"];
  if (kind === "booking_reminder" || kind === "booking_created") {
    return audience === "both" ? ["in_app", "sms"] : ["sms"];
  }
  if (audience === "both") return ["in_app", "sms"];
  return ["sms"];
}

export function listNotifications(
  tenant: string,
  opts?: { unreadOnly?: boolean; limit?: number },
): NotificationRecord[] {
  let list = getIntegrationStore().notifications.filter((n) => n.tenant === tenant);
  if (opts?.unreadOnly) list = list.filter((n) => !n.readAt && n.channels.includes("in_app"));
  return list.slice(0, opts?.limit ?? 50);
}

export function markNotificationRead(
  tenant: string,
  id: string,
): NotificationRecord | { error: string } {
  const n = getIntegrationStore().notifications.find(
    (x) => x.tenant === tenant && x.id === id,
  );
  if (!n) return { error: "not_found" };
  n.readAt = new Date().toISOString();
  return n;
}
