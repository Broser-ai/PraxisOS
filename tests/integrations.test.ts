import { afterEach, describe, expect, it } from "vitest";
import { resetIntegrationStoreForTests } from "@/lib/integrations/store";
import {
  drainOutbox,
  enqueueBookingMessages,
  enqueueMessage,
  listOutbox,
} from "@/lib/messaging/outbox";
import {
  createMitidAuthRequest,
  exchangeMitidCode,
  mitidMode,
} from "@/lib/mitid/oidc";
import {
  completePaymentIntent,
  createPaymentIntent,
  paymentsMode,
} from "@/lib/payments/intents";

afterEach(() => {
  resetIntegrationStoreForTests();
});

describe("SMS / NemSMS outbox", () => {
  it("rejects marketing on NemSMS channel", () => {
    const result = enqueueMessage({
      tenant: "bypilar",
      category: "marketing",
      toPhone: "+4512345678",
      recipientName: "Test",
      vars: { name: "Test" },
    });
    expect(result).toEqual({ error: "category_not_allowed_on_nemsms" });
  });

  it("queues booking confirm + drains in mock mode", async () => {
    const starts = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const queued = enqueueBookingMessages({
      tenant: "bypilar",
      bookingId: "bk_test",
      clientId: "cli_test",
      clientName: "Mette Lindqvist",
      clientPhone: "+4511223344",
      clientEmail: "mette@example.com",
      clinicName: "by Pilar",
      serviceName: "Fodpleje",
      startsAt: starts,
      receiptPath: "/r/bk_test",
    });
    expect(queued.length).toBeGreaterThanOrEqual(1);
    expect(queued.some((m) => m.category === "booking_confirm")).toBe(true);

    const drained = await drainOutbox(10);
    expect(drained.sent).toBeGreaterThanOrEqual(1);
    const listed = listOutbox("bypilar");
    expect(listed.some((m) => m.status === "sent")).toBe(true);
  });
});

describe("MitID OIDC scaffold", () => {
  it("defaults to mock mode without broker keys", () => {
    expect(mitidMode()).toBe("mock");
  });

  it("creates state and exchanges mock code", async () => {
    const { state, authorizeUrl, mode } = createMitidAuthRequest({
      mode: "staff",
      returnTo: "/dashboard",
    });
    expect(mode).toBe("mock");
    expect(authorizeUrl).toContain("/login/mitid");
    expect(authorizeUrl).toContain(state);

    const exchanged = await exchangeMitidCode({ code: "mock_ok", state });
    expect(exchanged.ok).toBe(true);
    if (exchanged.ok) {
      expect(exchanged.identity.provider).toBe("mock");
      expect(exchanged.pending.returnTo).toBe("/dashboard");
    }
  });
});

describe("MobilePay / payment intents", () => {
  it("defaults to mock payments mode", () => {
    expect(paymentsMode()).toBe("mock");
  });

  it("creates and completes mobilepay intent in mock mode", async () => {
    const created = createPaymentIntent({
      tenant: "bypilar",
      amountKr: 495,
      method: "mobilepay",
      mobilepayPhone: "+4512345678",
    });
    expect("error" in created).toBe(false);
    if ("error" in created) return;

    const done = await completePaymentIntent({
      tenant: "bypilar",
      id: created.id,
    });
    expect("error" in done).toBe(false);
    if ("error" in done) return;
    expect(["authorized", "captured"]).toContain(done.status);
    expect(done.provider).toBe("mock");
  });
});
