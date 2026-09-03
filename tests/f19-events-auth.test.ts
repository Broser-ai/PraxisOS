// F19 · GET /api/events staff-gated; POST remains HMAC-signed.

import { describe, expect, it } from "vitest";
import { encodeSession, SESSION_COOKIE, type Role } from "@/lib/auth";
import { GET as eventsGet, POST as eventsPost } from "@/app/api/events/route";
import { signEventPayload } from "@/lib/event-bus";

function cookieHeader(session: {
  accountId: string;
  tenant: string;
  role: Role;
}): string {
  const token = encodeSession({
    ...session,
    loggedInAt: new Date().toISOString(),
  });
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}`;
}

function sessionReq(
  url: string,
  session: { accountId: string; tenant: string; role: Role },
  init?: RequestInit,
): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", cookieHeader(session));
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(url, { ...init, headers });
}

const owner = { accountId: "acc_pilar", tenant: "bypilar", role: "owner" as Role };
const reception = {
  accountId: "acc_emil_reception",
  tenant: "bypilar",
  role: "reception" as Role,
};
const practitioner = {
  accountId: "acc_sofie",
  tenant: "bypilar",
  role: "practitioner" as Role,
};

describe("F19 · GET /api/events staff-gated", () => {
  it("rejects unauthenticated → 401", async () => {
    const res = await eventsGet(new Request("http://localhost/api/events"));
    expect(res.status).toBe(401);
  });

  it("rejects reception → 403 insufficient_role", async () => {
    const res = await eventsGet(
      sessionReq("http://localhost/api/events?tenant=bypilar", reception),
    );
    expect(res.status).toBe(403);
  });

  it("owner → 200 with events payload", async () => {
    const res = await eventsGet(
      sessionReq("http://localhost/api/events?tenant=bypilar&limit=10", owner),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.count).toBe("number");
    expect(Array.isArray(json.events)).toBe(true);
  });

  it("practitioner → 200", async () => {
    const res = await eventsGet(
      sessionReq("http://localhost/api/events", practitioner),
    );
    expect(res.status).toBe(200);
  });
});

describe("F19 · POST /api/events HMAC unchanged", () => {
  it("missing signature → 401", async () => {
    const body = JSON.stringify({ type: "test.ping", tenant: "bypilar", data: {} });
    const res = await eventsPost(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("missing_signature");
  });

  it("valid HMAC signature → 200 accepted (non-prod)", async () => {
    const body = JSON.stringify({
      type: "test.ping",
      tenant: "bypilar",
      data: { from: "f19" },
    });
    const sig = signEventPayload(body);
    const res = await eventsPost(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-praxis-signature": sig,
        },
        body,
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted).toBe(true);
    expect(json.id).toBeTruthy();
  });
});
