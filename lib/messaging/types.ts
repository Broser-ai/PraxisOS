import type { NemSmsCategory } from "@/lib/nemsms";
import type { MessageChannel } from "@/lib/integrations/types";

export type {
  MessageChannel,
  OutboxMessage,
  OutboxStatus,
} from "@/lib/integrations/types";

export type EnqueueInput = {
  tenant: string;
  channel?: MessageChannel;
  category: NemSmsCategory;
  toPhone?: string;
  toEmail?: string;
  recipientName: string;
  bookingId?: string;
  clientId?: string;
  vars: Record<string, string>;
  scheduledAt?: Date;
};
