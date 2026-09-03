import { describe, expect, it } from "vitest";
import {
  authorizeTenantRequest,
  requireTenantAccess,
} from "@/lib/request-auth";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";

function sessionReq(headers: Record<string, string> = {}): Request {
  const token = encodeSession({
    accountId: "acc_pilar",
    tenant: "bypilar",
    role: "owner",
    loggedInAt: new Date().toISOString(),
  });
  return new Request("http://localhost/api", {
    headers: {
      cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
      ...headers,
    },
  });
}

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api", { headers });
}

describe("authorizeTenantRequest", () => {
  it("allows matching session cookie tenant", () => {
    const r = authorizeTenantRequest(sessionReq(), "bypilar");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe("session");
  });

  it("blocks session tenant mismatch (non-support)", () => {
    const token = encodeSession({
      accountId: "acc_nadia",
      tenant: "nordlys",
      role: "owner",
      loggedInAt: new Date().toISOString(),
    });
    const r = authorizeTenantRequest(
      req({ cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` }),
      "bypilar",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("allows support across tenants", () => {
    const token = encodeSession({
      accountId: "acc_emil_support",
      tenant: "bypilar",
      role: "support",
      loggedInAt: new Date().toISOString(),
    });
    const r = authorizeTenantRequest(
      req({ cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` }),
      "nordlys",
    );
    expect(r.ok).toBe(true);
  });

  it("accepts verified bearer for tenant", () => {
    const r = authorizeTenantRequest(
      req({
        authorization: "Bearer sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47",
      }),
      "bypilar",
      "read:clients",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe("api_key");
  });

  it("rejects unverified bearer prefix", () => {
    const r = authorizeTenantRequest(
      req({ authorization: "Bearer sk_test_ui" }),
      "bypilar",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("rejects spoofed x-praxis headers without cookie", () => {
    const r = authorizeTenantRequest(
      req({
        "x-praxis-tenant": "bypilar",
        "x-praxis-role": "owner",
        "x-praxis-account": "acc_pilar",
      }),
      "bypilar",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });
});

describe("requireTenantAccess", () => {
  it("enforces journal permission for session", () => {
    const token = encodeSession({
      accountId: "acc_emil_reception",
      tenant: "bypilar",
      role: "reception",
      loggedInAt: new Date().toISOString(),
    });
    const r = requireTenantAccess(
      req({ cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}` }),
      "bypilar",
      { permissions: ["journal"] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.body.error).toBe("insufficient_role");
  });
});
