// F20 · remaining agents auth holes (workflows GET was open).
// status/run/approvals already gated in F5; workflows GET now owner/support.

import { describe, expect, it } from "vitest";
import { encodeSession, SESSION_COOKIE, type Role } from "@/lib/auth";
import { GET as workflowsGet } from "@/app/api/agents/workflows/route";
import { GET as statusGet } from "@/app/api/agents/status/route";
import { POST as runPost } from "@/app/api/agents/run/route";

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
const support = { accountId: "acc_support", tenant: "bypilar", role: "support" as Role };
const practitioner = {
  accountId: "acc_sofie",
  tenant: "bypilar",
  role: "practitioner" as Role,
};
const reception = {
  accountId: "acc_emil_reception",
  tenant: "bypilar",
  role: "reception" as Role,
};

describe("F20 · GET /api/agents/workflows staff-gated", () => {
  it("rejects unauthenticated → 401", async () => {
    const res = await workflowsGet(new Request("http://localhost/api/agents/workflows"));
    expect(res.status).toBe(401);
  });

  it("rejects practitioner → 403 (owner/support only)", async () => {
    const res = await workflowsGet(
      sessionReq("http://localhost/api/agents/workflows", practitioner),
    );
    expect(res.status).toBe(403);
  });

  it("rejects reception → 403", async () => {
    const res = await workflowsGet(
      sessionReq("http://localhost/api/agents/workflows", reception),
    );
    expect(res.status).toBe(403);
  });

  it("owner → 200 with workflows list", async () => {
    const res = await workflowsGet(
      sessionReq("http://localhost/api/agents/workflows", owner),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.workflows)).toBe(true);
  });

  it("support → 200", async () => {
    const res = await workflowsGet(
      sessionReq("http://localhost/api/agents/workflows", support),
    );
    expect(res.status).toBe(200);
  });
});

describe("F20 · status/run remain gated (regression)", () => {
  it("GET status unauthenticated → 401", async () => {
    const res = await statusGet(new Request("http://localhost/api/agents/status"));
    expect(res.status).toBe(401);
  });

  it("POST run unauthenticated → 401", async () => {
    const res = await runPost(
      new Request("http://localhost/api/agents/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hi" }),
      }),
    );
    expect(res.status).toBe(401);
  });
});
