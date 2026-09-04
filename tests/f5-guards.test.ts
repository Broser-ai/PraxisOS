// F5 · bird/scan secrets/license/tenant-setup/agents status|run|approvals guards
// All were previously unauthenticated (open SMS gateway, secret writes, license
// changes, automation-leak, journal-sign/marketing-SMS approvals). Now require
// a verified staff session + role. Secret writes + license changes also audit.

import { describe, expect, it, beforeEach } from "vitest";
import { encodeSession, SESSION_COOKIE, type Role } from "@/lib/auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { POST as birdSend } from "@/app/api/bird/send/route";
import { GET as birdConfigGet, POST as birdConfigPost } from "@/app/api/bird/config/route";
import { GET as scanConfigGet, POST as scanConfigPost } from "@/app/api/scan/config/route";
import { POST as scanProcessPost } from "@/app/api/v1/scan/process/route";
import { POST as agentsRunPost } from "@/app/api/agents/run/route";
import { GET as agentsStatusGet } from "@/app/api/agents/status/route";
import { GET as approvalsGet, POST as approvalsPost } from "@/app/api/agents/approvals/route";
import { POST as tenantSetupPost } from "@/app/api/tenant/setup/route";
import { GET as licenseGet, POST as licensePost } from "@/app/api/license/route";

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

function anonReq(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(url, { ...init, headers });
}

const owner = { accountId: "acc_pilar", tenant: "bypilar", role: "owner" as Role };
const reception = { accountId: "acc_emil_reception", tenant: "bypilar", role: "reception" as Role };
const nordlysOwner = { accountId: "acc_nadia", tenant: "nordlys", role: "owner" as Role };

describe("F5 · bird/send", () => {
  it("rejects unauthenticated → 401", async () => {
    const res = await birdSend(
      anonReq("http://localhost/api/bird/send", {
        method: "POST",
        body: JSON.stringify({ to: "+4512345678", text: "hi" }),
      }) as any,
    );
    expect(res.status).toBe(401);
  });

  it("reception transactional passes auth → 503 when Bird unconfigured", async () => {
    const res = await birdSend(
      sessionReq("http://localhost/api/bird/send", reception, {
        method: "POST",
        body: JSON.stringify({ to: "+4512345678", text: "hi" }),
      }) as any,
    );
    expect(res.status).toBe(503);
  });
});

describe("F5 · bird/config secret write", () => {
  it("GET stays public readiness → 200", async () => {
    const res = await birdConfigGet(
      new Request("http://localhost/api/bird/config"),
    );
    expect(res.status).toBe(200);
  });

  it("POST rejects unauthenticated → 401", async () => {
    const res = await birdConfigPost(
      anonReq("http://localhost/api/bird/config", {
        method: "POST",
        body: JSON.stringify({ BIRD_API_KEY: "x" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST rejects reception → 403 insufficient_role", async () => {
    const res = await birdConfigPost(
      sessionReq("http://localhost/api/bird/config", reception, {
        method: "POST",
        body: JSON.stringify({ BIRD_API_KEY: "x" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("POST owner empty body → 400 no_fields (auth passed)", async () => {
    const res = await birdConfigPost(
      sessionReq("http://localhost/api/bird/config", owner, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("F5 · scan/config secret write", () => {
  it("GET stays public readiness → 200", async () => {
    const res = await scanConfigGet(
      new Request("http://localhost/api/scan/config"),
    );
    expect(res.status).toBe(200);
  });

  it("POST rejects unauthenticated → 401", async () => {
    const res = await scanConfigPost(
      anonReq("http://localhost/api/scan/config", {
        method: "POST",
        body: JSON.stringify({ ROBOFLOW_API_KEY: "x" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST rejects reception → 403", async () => {
    const res = await scanConfigPost(
      sessionReq("http://localhost/api/scan/config", reception, {
        method: "POST",
        body: JSON.stringify({ ROBOFLOW_API_KEY: "x" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("POST owner empty body → 400 no_fields (auth passed)", async () => {
    const res = await scanConfigPost(
      sessionReq("http://localhost/api/scan/config", owner, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("F5 · scan/process clinical scan", () => {
  it("POST rejects unauthenticated → 401", async () => {
    const res = await scanProcessPost(
      anonReq("http://localhost/api/v1/scan/process", {
        method: "POST",
        body: JSON.stringify({ imageUrl: "https://example.com/x.jpg" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST rejects reception → 403 (role gate before nexus)", async () => {
    const res = await scanProcessPost(
      sessionReq("http://localhost/api/v1/scan/process", reception, {
        method: "POST",
        body: JSON.stringify({ imageUrl: "https://example.com/x.jpg" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("F5 · agents/run", () => {
  it("POST rejects unauthenticated → 401", async () => {
    const res = await agentsRunPost(
      anonReq("http://localhost/api/agents/run", {
        method: "POST",
        body: JSON.stringify({ message: "hi" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST rejects reception → 403 (role gate before runAgent)", async () => {
    const res = await agentsRunPost(
      sessionReq("http://localhost/api/agents/run", reception, {
        method: "POST",
        body: JSON.stringify({ message: "hi" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("F5 · agents/status", () => {
  it("GET rejects unauthenticated → 401", async () => {
    const res = await agentsStatusGet(
      anonReq("http://localhost/api/agents/status"),
    );
    expect(res.status).toBe(401);
  });

  it("GET rejects reception → 403", async () => {
    const res = await agentsStatusGet(
      sessionReq("http://localhost/api/agents/status", reception),
    );
    expect(res.status).toBe(403);
  });

  it("GET owner → 200", async () => {
    const res = await agentsStatusGet(
      sessionReq("http://localhost/api/agents/status", owner),
    );
    expect(res.status).toBe(200);
  });
});

describe("F5 · agents/approvals", () => {
  it("GET rejects unauthenticated → 401", async () => {
    const res = await approvalsGet(anonReq("http://localhost/api/agents/approvals"));
    expect(res.status).toBe(401);
  });

  it("GET rejects reception → 403", async () => {
    const res = await approvalsGet(
      sessionReq("http://localhost/api/agents/approvals", reception),
    );
    expect(res.status).toBe(403);
  });

  it("GET owner → 200", async () => {
    const res = await approvalsGet(
      sessionReq("http://localhost/api/agents/approvals", owner),
    );
    expect(res.status).toBe(200);
  });

  it("POST rejects unauthenticated → 401", async () => {
    const res = await approvalsPost(
      anonReq("http://localhost/api/agents/approvals", {
        method: "POST",
        body: JSON.stringify({ id: "ap_x", decision: "approved" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST rejects reception → 403", async () => {
    const res = await approvalsPost(
      sessionReq("http://localhost/api/agents/approvals", reception, {
        method: "POST",
        body: JSON.stringify({ id: "ap_x", decision: "approved" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("F5 · tenant/setup", () => {
  it("POST rejects unauthenticated → 401", async () => {
    const res = await tenantSetupPost(
      anonReq("http://localhost/api/tenant/setup", {
        method: "POST",
        body: JSON.stringify({ tenant: "bypilar" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST rejects reception → 403", async () => {
    const res = await tenantSetupPost(
      sessionReq("http://localhost/api/tenant/setup", reception, {
        method: "POST",
        body: JSON.stringify({ tenant: "bypilar" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("POST cross-tenant owner → 403 tenant_mismatch", async () => {
    const res = await tenantSetupPost(
      sessionReq("http://localhost/api/tenant/setup", nordlysOwner, {
        method: "POST",
        body: JSON.stringify({ tenant: "bypilar" }),
      }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("tenant_mismatch");
  });

  it("POST matching owner → 200 success", async () => {
    const res = await tenantSetupPost(
      sessionReq("http://localhost/api/tenant/setup", owner, {
        method: "POST",
        body: JSON.stringify({ tenant: "bypilar", setupComplete: true }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});

describe("F5 · license", () => {
  beforeEach(() => {
    _clearMemorySink();
  });

  it("GET rejects unauthenticated → 401", async () => {
    const res = await licenseGet(anonReq("http://localhost/api/license?tenant=bypilar"));
    expect(res.status).toBe(401);
  });

  it("GET rejects reception → 403", async () => {
    const res = await licenseGet(
      sessionReq("http://localhost/api/license?tenant=bypilar", reception),
    );
    expect(res.status).toBe(403);
  });

  it("GET owner → 200", async () => {
    const res = await licenseGet(
      sessionReq("http://localhost/api/license?tenant=bypilar", owner),
    );
    expect(res.status).toBe(200);
  });

  it("POST rejects unauthenticated → 401", async () => {
    const res = await licensePost(
      anonReq("http://localhost/api/license", {
        method: "POST",
        body: JSON.stringify({ tenant: "bypilar", action: "activate" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("POST owner activate emits audit license.changed", async () => {
    const res = await licensePost(
      sessionReq("http://localhost/api/license", owner, {
        method: "POST",
        body: JSON.stringify({ tenant: "bypilar", action: "activate" }),
      }),
    );
    expect(res.status).toBe(200);
    const sink = _readMemorySink();
    expect(sink.some((e) => e.event === "license.changed")).toBe(true);
  });

  it("POST cross-tenant owner → 403 tenant_mismatch", async () => {
    const res = await licensePost(
      sessionReq("http://localhost/api/license", nordlysOwner, {
        method: "POST",
        body: JSON.stringify({ tenant: "bypilar", action: "activate" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
