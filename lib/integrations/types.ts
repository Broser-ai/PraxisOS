import type { NemSmsCategory } from "@/lib/nemsms";
import type { PaymentMethod, PaymentStatus } from "@/lib/payments";

export type MessageChannel = "nemsms" | "sms" | "email";

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
  category: NemSmsCategory;
  toPhone?: string;
  toEmail?: string;
  recipientName: string;
  bookingId?: string;
  clientId?: string;
  body: string;
  status: OutboxStatus;
  provider: "mock" | "nemsms_http" | "none";
  providerRef?: string;
  errorCode?: string;
  costOere: number;
  scheduledAt: string;
  createdAt: string;
  sentAt?: string;
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
