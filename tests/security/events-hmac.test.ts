// Sprint 6 Batch 2 · Events HMAC-in-all-envs
// Verificerer at /api/events POST kræver gyldig HMAC-signatur i ALLE miljøer,
// også når NODE_ENV !== 'production'.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

async function POST(req: Request) {
  const mod = await import("@/app/api/events/route");
  return (mod.POST as any)(req);
}

const SECRET = "demo-secret-key"; // dev/test fallback

function sign(raw: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

function makeReq(body: unknown, sig: string | undefined) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sig) headers["x-praxis-signature"] = sig;
  return new Request("http://localhost:3000/api/events", {
    method: "POST",
    headers,
    body: raw,
  });
}

describe("/api/events HMAC (Sprint 6 B2)", () => {
  const orig = process.env.NODE_ENV;
  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    delete process.env.PRAXIS_EVENTS_SECRET;
  });
  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = orig;
  });

  it("afviser POST uden signatur (401)", async () => {
    const res = await POST(makeReq({ type: "x", tenant: "bypilar" }, undefined));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("missing_signature");
  });

  it("afviser POST med ugyldig signatur i test-miljø (ikke kun prod)", async () => {
    const res = await POST(makeReq({ type: "x", tenant: "bypilar" }, "deadbeef"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("invalid_signature");
  });

  it("accepterer POST med korrekt signatur", async () => {
    const body = JSON.stringify({ type: "booking.created", tenant: "bypilar" });
    const req = new Request("http://localhost:3000/api/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-praxis-signature": sign(body),
      },
      body,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted).toBe(true);
  });
});
