import { NEMSMS_CONFIG } from "@/lib/nemsms";
import { deliverOutboxMessage, messagingMode } from "@/lib/messaging/provider";
import { renderTemplate } from "@/lib/messaging/render";
import type { EnqueueInput, OutboxMessage } from "@/lib/messaging/types";
import { getIntegrationStore } from "@/lib/integrations/store";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

export function enqueueMessage(input: EnqueueInput): OutboxMessage | { error: string } {
  const rendered = renderTemplate(input.category, input.vars);
  if (!rendered.allowed) {
    return { error: "category_not_allowed_on_nemsms" };
  }
  if (!input.toPhone && !input.toEmail) {
    return { error: "missing_recipient" };
  }

  const cfg = NEMSMS_CONFIG[input.tenant];
  const costOere = cfg?.costPerSmsOere ?? 50;
  const now = new Date().toISOString();
  const msg: OutboxMessage = {
    id: newId("msg"),
    tenant: input.tenant,
    channel: input.channel ?? "nemsms",
    category: input.category,
    toPhone: input.toPhone,
    toEmail: input.toEmail,
    recipientName: input.recipientName,
    bookingId: input.bookingId,
    clientId: input.clientId,
    body: rendered.body,
    status: "pending",
    provider: messagingMode() === "mock" ? "mock" : nemsmsProviderLabel(),
    costOere,
    scheduledAt: (input.scheduledAt ?? new Date()).toISOString(),
    createdAt: now,
  };

  getIntegrationStore().outbox.unshift(msg);
  return msg;
}

function nemsmsProviderLabel(): OutboxMessage["provider"] {
  return process.env.NEMSMS_API_KEY ? "nemsms_http" : "none";
}

export function listOutbox(tenant: string, limit = 100): OutboxMessage[] {
  return getIntegrationStore()
    .outbox.filter((m) => m.tenant === tenant)
    .slice(0, limit);
}

export function enqueueBookingMessages(input: {
  tenant: string;
  bookingId: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  clinicName: string;
  serviceName: string;
  startsAt: string;
  receiptPath: string;
}): OutboxMessage[] {
  const starts = new Date(input.startsAt);
  const date = starts.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = starts.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const vars = {
    name: input.clientName.split(" ")[0] ?? input.clientName,
    clinic: input.clinicName,
    date,
    time,
    service: input.serviceName,
    link: input.receiptPath,
    address: input.clinicName,
  };

  const created: OutboxMessage[] = [];
  const confirm = enqueueMessage({
    tenant: input.tenant,
    category: "booking_confirm",
    toPhone: input.clientPhone,
    toEmail: input.clientEmail,
    recipientName: input.clientName,
    bookingId: input.bookingId,
    clientId: input.clientId,
    vars,
  });
  if (!("error" in confirm)) created.push(confirm);

  const reminderAt = new Date(starts.getTime() - 24 * 60 * 60 * 1000);
  if (reminderAt.getTime() > Date.now()) {
    const reminder = enqueueMessage({
      tenant: input.tenant,
      category: "reminder_24h",
      toPhone: input.clientPhone,
      toEmail: input.clientEmail,
      recipientName: input.clientName,
      bookingId: input.bookingId,
      clientId: input.clientId,
      vars,
      scheduledAt: reminderAt,
    });
    if (!("error" in reminder)) created.push(reminder);
  }

  return created;
}

/** Process due pending messages. Returns counts. */
export async function drainOutbox(limit = 25): Promise<{
  attempted: number;
  sent: number;
  failed: number;
}> {
  const store = getIntegrationStore();
  const now = Date.now();
  const due = store.outbox
    .filter((m) => m.status === "pending" && new Date(m.scheduledAt).getTime() <= now)
    .slice(0, limit);

  let sent = 0;
  let failed = 0;
  for (const msg of due) {
    msg.status = "sending";
    const result = await deliverOutboxMessage(msg);
    if (result.ok) {
      msg.status = "sent";
      msg.provider = result.provider;
      msg.providerRef = result.providerRef;
      msg.sentAt = new Date().toISOString();
      sent += 1;
    } else {
      msg.status = "failed";
      msg.provider = result.provider;
      msg.errorCode = result.errorCode;
      failed += 1;
    }
  }
  return { attempted: due.length, sent, failed };
}
