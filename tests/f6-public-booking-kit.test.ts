// F6 · public booking kit (CORS allowlist + rate-limit) WITHOUT login.
// by Pilar embed booking must stay 201 without praxis_session. Protected by
// per-tenant origin allowlist + per-IP+tenant rate-limit instead of login.

import { describe, expect, it, beforeEach } from "vitest";
import { POST as bookingsPost, OPTIONS as bookingsOptions } from "@/app/api/v1/[tenant]/bookings/route";
import { GET as lookupGet } from "@/app/api/v1/[tenant]/lookup/route";
import { GET as voucherGet } from "@/app/api/v1/[tenant]/voucher/route";
import {
  bookingAllowedOrigin,
  bookingRateLimit,
  _resetBookingRateLimitForTests,
} from "@/lib/public-booking-kit";

function bookingPayload() {
  return {
    serviceId: "fod-med",
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    client: { name: "F6 Patient", email: `f6-${Date.now()}@example.com`, phone: "+4512345678" },
  };
}

function ctx(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

describe("F6 · bookingAllowedOrigin allowlist", () => {
  it("echoes allowlisted tenant domain origin", () => {
    const req = new Request("http://localhost/api/v1/bypilar/bookings", {
      headers: { origin: "https://bypilar.dk" },
    });
    expect(bookingAllowedOrigin(req, "bypilar")).toBe("https://bypilar.dk");
  });

  it("echoes subdomain of allowlisted tenant domain", () => {
    const req = new Request("http://localhost/api/v1/bypilar/bookings", {
      headers: { origin: "https://booking.bypilar.dk" },
    });
    expect(bookingAllowedOrigin(req, "bypilar")).toBe("https://booking.bypilar.dk");
  });

  it("returns null for non-allowlisted origin (no ACAO header)", () => {
    const req = new Request("http://localhost/api/v1/bypilar/bookings", {
      headers: { origin: "https://evil.example.com" },
    });
    expect(bookingAllowedOrigin(req, "bypilar")).toBeNull();
  });

  it("returns null when no Origin/Referer (same-origin / curl)", () => {
    const req = new Request("http://localhost/api/v1/bypilar/bookings");
    expect(bookingAllowedOrigin(req, "bypilar")).toBeNull();
  });

  it("honors PRAXIS_BOOKING_CORS_ORIGINS env allowlist", () => {
    const prev = process.env.PRAXIS_BOOKING_CORS_ORIGINS;
    process.env.PRAXIS_BOOKING_CORS_ORIGINS = "https://embed.partner.dk";
    try {
      const req = new Request("http://localhost/api/v1/bypilar/bookings", {
        headers: { origin: "https://embed.partner.dk" },
      });
      expect(bookingAllowedOrigin(req, "bypilar")).toBe("https://embed.partner.dk");
    } finally {
      if (prev === undefined) delete process.env.PRAXIS_BOOKING_CORS_ORIGINS;
      else process.env.PRAXIS_BOOKING_CORS_ORIGINS = prev;
    }
  });
});

describe("F6 · bookingRateLimit", () => {
  beforeEach(() => {
    _resetBookingRateLimitForTests();
  });

  it("allows up to the default limit then 429s", () => {
    for (let i = 0; i < 30; i++) {
      expect(bookingRateLimit("1.2.3.4", "bypilar").ok).toBe(true);
    }
    const over = bookingRateLimit("1.2.3.4", "bypilar");
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.status).toBe(429);
  });

  it("isolates by IP + tenant", () => {
    for (let i = 0; i < 30; i++) bookingRateLimit("1.2.3.4", "bypilar");
    expect(bookingRateLimit("1.2.3.4", "bypilar").ok).toBe(false);
    // different IP fresh
    expect(bookingRateLimit("9.9.9.9", "bypilar").ok).toBe(true);
    // different tenant fresh
    expect(bookingRateLimit("1.2.3.4", "nordlys").ok).toBe(true);
  });
});

describe("F6 · public booking POST intact (no login)", () => {
  beforeEach(() => {
    _resetBookingRateLimitForTests();
  });

  it("returns 201 without cookie (by Pilar embed regression)", async () => {
    const req = new Request("http://localhost/api/v1/bypilar/bookings", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://bypilar.dk" },
      body: JSON.stringify(bookingPayload()),
    });
    const res = await bookingsPost(req, ctx("bypilar"));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBeTruthy();
    // allowlisted origin echoed
    expect(res.headers.get("access-control-allow-origin")).toBe("https://bypilar.dk");
  });

  it("still 201 without Origin (curl smoke) but no ACAO header", async () => {
    const req = new Request("http://localhost/api/v1/bypilar/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bookingPayload()),
    });
    const res = await bookingsPost(req, ctx("bypilar"));
    expect(res.status).toBe(201);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rate-limits abusive booking POST → 429 with retry-after", async () => {
    let lastStatus = 0;
    for (let i = 0; i < 32; i++) {
      const req = new Request("http://localhost/api/v1/bypilar/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(bookingPayload()),
      });
      const res = await bookingsPost(req, ctx("bypilar"));
      lastStatus = res.status;
      if (res.status === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  it("OPTIONS echoes allowlisted origin", async () => {
    const req = new Request("http://localhost/api/v1/bypilar/bookings", {
      method: "OPTIONS",
      headers: { origin: "https://bypilar.dk" },
    });
    const res = await bookingsOptions(req, ctx("bypilar"));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://bypilar.dk");
  });
});

describe("F6 · lookup + voucher rate-limited without login", () => {
  beforeEach(() => {
    _resetBookingRateLimitForTests();
  });

  it("lookup returns known:false for unknown email without login", async () => {
    const req = new Request(
      "http://localhost/api/v1/bypilar/lookup?email=unknown@example.com&service=fod-med",
      { headers: { origin: "https://bypilar.dk" } },
    );
    const res = await lookupGet(req, ctx("bypilar"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.known).toBe(false);
  });

  it("lookup rate-limits → 429", async () => {
    let last = 0;
    for (let i = 0; i < 32; i++) {
      const req = new Request(
        "http://localhost/api/v1/bypilar/lookup?email=unknown@example.com&service=fod-med",
      );
      const res = await lookupGet(req, ctx("bypilar"));
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });

  it("voucher returns 404 for unknown code without login", async () => {
    const req = new Request(
      "http://localhost/api/v1/bypilar/voucher?code=NOPE-0000-0000&service=fod-med",
      { headers: { origin: "https://bypilar.dk" } },
    );
    const res = await voucherGet(req, ctx("bypilar"));
    expect(res.status).toBe(404);
  });
});
