import { describe, expect, it } from "vitest";
import { authorizeTenantRequest } from "@/lib/request-auth";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api", { headers });
}

describe("authorizeTenantRequest", () => {
  it("allows matching session tenant", () => {
    const r = authorizeTenantRequest(
      req({
        "x-praxis-tenant": "bypilar",
        "x-praxis-role": "owner",
        "x-praxis-account": "acc_pilar",
      }),
      "bypilar",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe("session");
  });

  it("blocks session tenant mismatch (non-support)", () => {
    const r = authorizeTenantRequest(
      req({
        "x-praxis-tenant": "nordlys",
        "x-praxis-role": "owner",
      }),
      "bypilar",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("allows support across tenants", () => {
    const r = authorizeTenantRequest(
      req({
        "x-praxis-tenant": "bypilar",
        "x-praxis-role": "support",
      }),
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
});
