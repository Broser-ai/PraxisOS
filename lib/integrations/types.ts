import type { NemSmsCategory } from "@/lib/nemsms";
import type { PaymentMethod, PaymentStatus } from "@/lib/payments";

export type MessageChannel = "nemsms" | "sms" | "email";

/** NemSMS template categories + free-form notification SMS/email. */
export type OutboxCategory = NemSmsCategory | "notification";

export type OutboxStatus =
  | "pending"
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "cancelled";

export type OutboxMessage = {
  id: string;
  tenant: string;
  channel: MessageChannel;
  category: OutboxCategory;
  toPhone?: string;
  toEmail?: string;
  recipientName: string;
  bookingId?: string;
  clientId?: string;
  body: string;
  status: OutboxStatus;
  provider: "mock" | "nemsms_http" | "sms_gateway" | "none";
  providerRef?: string;
  errorCode?: string;
  costOere: number;
  scheduledAt: string;
  createdAt: string;
  sentAt?: string;
};

export type NotificationChannel = "in_app" | "sms" | "email";

export type NotificationKind =
  | "booking_created"
  | "booking_reminder"
  | "booking_cancelled"
  | "payment_received"
  | "staff_alert"
  | "custom";

export type NotificationStatus = "queued" | "delivered" | "partial" | "failed";

export type NotificationRecord = {
  id: string;
  tenant: string;
  kind: NotificationKind;
  title: string;
  body: string;
  channels: NotificationChannel[];
  status: NotificationStatus;
  audience: "staff" | "client" | "both";
  recipientName?: string;
  toPhone?: string;
  toEmail?: string;
  bookingId?: string;
  clientId?: string;
  accountId?: string;
  readAt?: string;
  outboxIds: string[];
  createdAt: string;
  meta?: Record<string, string>;
};

export type PaymentIntentRecord = {
  id: string;
  tenant: string;
  bookingId?: string;
  amountKr: number;
  currency: "DKK";
  method: PaymentMethod;
  status: PaymentStatus;
  mode: "prepay" | "auth_only" | "in_clinic";
  provider: "mock" | "mobilepay" | "none";
  providerRef?: string;
  mobilepayPhone?: string;
  returnUrl?: string;
  createdAt: string;
  updatedAt: string;
  authorizedAt?: string;
  capturedAt?: string;
};

export type MitidPendingAuth = {
  state: string;
  nonce: string;
  mode: "staff" | "patient";
  returnTo: string;
  createdAt: string;
  expiresAt: string;
};
