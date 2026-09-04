// F4 · clients + bookings/list auth guards
// Replaces weak local checkAuth with requireTenantAccess (verified session cookie
// OR verifyApiKey Bearer). Asserts cross-tenant isolation and spoofed-header rejection.

import { describe, expect, it, beforeEach } from "vitest";
import { encodeSession, SESSION_COOKIE, type Role } from "@/lib/auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { GET as clientsGet, POST as clientsPost } from "@/app/api/v1/[tenant]/clients/route";
import { GET as bookingsListGet } from "@/app/api/v1/[tenant]/bookings/list/route";

// Verified active secrets from lib/api-keys.ts seed
const BYPILAR_KEY = "sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47"; // scopes: read+write clients/bookings
const NORDLYS_KEY = "sk_live_9d3e5b8a4c12f0e1d2c3b4a5968778"; // scopes: *

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
  return new Request(url, { ...init, headers });
}

function bearerReq(url: string, token: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  return new Request(url, { ...init, headers });
}

describe("GET /api/v1/[tenant]/clients auth", () => {
  it("rejects unauthenticated → 401", async () => {
    const res = await clientsGet(
      new Request("http://localhost/api/v1/bypilar/clients"),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(401);
  });

  it("rejects spoofed x-praxis-tenant without cookie → 401 (not 200)", async () => {
    const res = await clientsGet(
      new Request("http://localhost/api/v1/bypilar/clients", {
        headers: {
          "x-praxis-tenant": "bypilar",
          "x-praxis-role": "owner",
          "x-praxis-account": "acc_fake",
        },
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(401);
  });

  it("rejects cross-tenant session → 403 tenant_mismatch", async () => {
    const res = await clientsGet(
      sessionReq("http://localhost/api/v1/bypilar/clients", {
        accountId: "acc_nadia",
        tenant: "nordlys",
        role: "owner",
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("tenant_mismatch");
  });

  it("rejects cross-tenant Bearer (nordlys key on bypilar) → 401 invalid_token", async () => {
    const res = await clientsGet(
      bearerReq("http://localhost/api/v1/bypilar/clients", NORDLYS_KEY),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("invalid_token");
  });

  it("allows matching session owner → 200", async () => {
    const res = await clientsGet(
      sessionReq("http://localhost/api/v1/bypilar/clients", {
        accountId: "acc_pilar",
        tenant: "bypilar",
        role: "owner",
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
  });

  it("allows reception (has bookings permission) to list clients → 200", async () => {
    const res = await clientsGet(
      sessionReq("http://localhost/api/v1/bypilar/clients", {
        accountId: "acc_emil_reception",
        tenant: "bypilar",
        role: "reception",
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(200);
  });

  it("allows verified Bearer with read:clients scope → 200", async () => {
    const res = await clientsGet(
      bearerReq("http://localhost/api/v1/bypilar/clients", BYPILAR_KEY),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(200);
  });

  it("rejects unverified bearer prefix → 401", async () => {
    const res = await clientsGet(
      bearerReq("http://localhost/api/v1/bypilar/clients", "sk_test_ui"),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/[tenant]/clients auth + audit", () => {
  beforeEach(() => {
    _clearMemorySink();
  });

  it("rejects unauthenticated POST → 401", async () => {
    const res = await clientsPost(
      new Request("http://localhost/api/v1/bypilar/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", email: "test@example.com" }),
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(401);
  });

  it("creates client with owner session + emits audit client.created", async () => {
    const res = await clientsPost(
      sessionReq(
        "http://localhost/api/v1/bypilar/clients",
        { accountId: "acc_pilar", tenant: "bypilar", role: "owner" },
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "F4 Test Client",
            email: "f4-test@example.com",
          }),
        },
      ),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(201);
    const sink = _readMemorySink();
    expect(sink.some((e) => e.event === "client.created")).toBe(true);
  });
});

describe("GET /api/v1/[tenant]/bookings/list auth", () => {
  it("rejects unauthenticated → 401", async () => {
    const res = await bookingsListGet(
      new Request("http://localhost/api/v1/bypilar/bookings/list"),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(401);
  });

  it("rejects spoofed x-praxis-tenant without cookie → 401", async () => {
    const res = await bookingsListGet(
      new Request("http://localhost/api/v1/bypilar/bookings/list", {
        headers: { "x-praxis-tenant": "bypilar", "x-praxis-role": "owner" },
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(401);
  });

  it("rejects cross-tenant session → 403 tenant_mismatch", async () => {
    const res = await bookingsListGet(
      sessionReq("http://localhost/api/v1/bypilar/bookings/list", {
        accountId: "acc_nadia",
        tenant: "nordlys",
        role: "owner",
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("tenant_mismatch");
  });

  it("allows matching session + verified Bearer with read:bookings → 200", async () => {
    const sessionRes = await bookingsListGet(
      sessionReq("http://localhost/api/v1/bypilar/bookings/list", {
        accountId: "acc_emil_reception",
        tenant: "bypilar",
        role: "reception",
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(sessionRes.status).toBe(200);

    const bearerRes = await bookingsListGet(
      bearerReq("http://localhost/api/v1/bypilar/bookings/list", BYPILAR_KEY),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(bearerRes.status).toBe(200);
  });
});
