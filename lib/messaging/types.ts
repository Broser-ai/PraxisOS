import type { MessageChannel, OutboxCategory } from "@/lib/integrations/types";

export type {
  MessageChannel,
  OutboxCategory,
  OutboxMessage,
  OutboxStatus,
} from "@/lib/integrations/types";

export type EnqueueInput = {
  tenant: string;
  channel?: MessageChannel;
  category: Exclude<OutboxCategory, "notification">;
  toPhone?: string;
  toEmail?: string;
  recipientName: string;
  bookingId?: string;
  clientId?: string;
  vars: Record<string, string>;
  scheduledAt?: Date;
};

export type EnqueueRawInput = {
  tenant: string;
  channel: Exclude<MessageChannel, "nemsms">;
  toPhone?: string;
  toEmail?: string;
  recipientName: string;
  body: string;
  bookingId?: string;
  clientId?: string;
  scheduledAt?: Date;
};
