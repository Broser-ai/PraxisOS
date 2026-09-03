import { describe, expect, it, beforeEach } from "vitest";
import {
  authorizeTenantRequest,
  requireTenantAccess,
  requireJournalAccess,
  requireRole,
  sessionFromRequest,
} from "@/lib/request-auth";
import { encodeSession, SESSION_COOKIE, type Role } from "@/lib/auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { GET as journalListGet, POST as journalListPost } from "@/app/api/journal/route";
import { GET as journalGet, PATCH as journalPatch } from "@/app/api/journal/[id]/route";
import { POST as journalSign } from "@/app/api/journal/[id]/sign/route";
import { GET as authMe } from "@/app/api/auth/me/route";
import { listJournal } from "@/lib/journal";

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

describe("authorizeTenantRequest (cookie-first)", () => {
  it("allows matching session cookie tenant", () => {
    const r = authorizeTenantRequest(
      sessionReq("http://localhost/api", {
        accountId: "acc_pilar",
        tenant: "bypilar",
        role: "owner",
      }),
      "bypilar",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe("session");
  });

  it("blocks session tenant mismatch (non-support)", () => {
    const r = authorizeTenantRequest(
      sessionReq("http://localhost/api", {
        accountId: "acc_nadia",
        tenant: "nordlys",
        role: "owner",
      }),
      "bypilar",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.body.error).toBe("tenant_mismatch");
    }
  });

  it("allows support across tenants via cookie", () => {
    const r = authorizeTenantRequest(
      sessionReq("http://localhost/api", {
        accountId: "acc_emil_support",
        tenant: "bypilar",
        role: "support",
      }),
      "nordlys",
    );
    expect(r.ok).toBe(true);
  });

  it("rejects spoofed x-praxis-tenant without cookie (401)", () => {
    const r = authorizeTenantRequest(
      new Request("http://localhost/api", {
        headers: {
          "x-praxis-tenant": "nordlys",
          "x-praxis-role": "owner",
        },
      }),
      "nordlys",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("accepts verified bearer for tenant", () => {
    const r = authorizeTenantRequest(
      new Request("http://localhost/api", {
        headers: {
          authorization: "Bearer sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47",
        },
      }),
      "bypilar",
      "read:clients",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe("api_key");
  });

  it("rejects unverified bearer prefix", () => {
    const r = authorizeTenantRequest(
      new Request("http://localhost/api", {
        headers: { authorization: "Bearer sk_test_ui" },
      }),
      "bypilar",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });
});

describe("requireTenantAccess / role enforcement", () => {
  it("reception lacks journal permission", () => {
    const r = requireTenantAccess(
      sessionReq("http://localhost/api", {
        accountId: "acc_emil_reception",
        tenant: "bypilar",
        role: "reception",
      }),
      "bypilar",
      { permissions: ["journal"], roles: ["owner", "practitioner", "support"] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.body.error).toBe("insufficient_role");
    }
  });

  it("practitioner has journal permission", () => {
    const r = requireTenantAccess(
      sessionReq("http://localhost/api", {
        accountId: "acc_sofie",
        tenant: "bypilar",
        role: "practitioner",
      }),
      "bypilar",
      { permissions: ["journal"], roles: ["owner", "practitioner", "support"] },
    );
    expect(r.ok).toBe(true);
  });

  it("requireRole blocks reception from sign roles", () => {
    const auth = authorizeTenantRequest(
      sessionReq("http://localhost/api", {
        accountId: "acc_emil_reception",
        tenant: "bypilar",
        role: "reception",
      }),
      "bypilar",
    );
    expect(auth.ok).toBe(true);
    if (!auth.ok) return;
    const gate = requireRole(auth, ["practitioner", "owner", "support"]);
    expect(gate.ok).toBe(false);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without cookie", async () => {
    const res = await authMe(new Request("http://localhost/api/auth/me"));
    expect(res.status).toBe(401);
  });

  it("returns StaffSession shape with cookie", async () => {
    const res = await authMe(
      sessionReq("http://localhost/api/auth/me", {
        accountId: "acc_pilar",
        tenant: "bypilar",
        role: "owner",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accountId).toBe("acc_pilar");
    expect(json.tenant).toBe("bypilar");
    expect(json.role).toBe("owner");
    expect(json.name).toBeTruthy();
    expect(json.tenantName).toBeTruthy();
  });
});

describe("journal route authorization", () => {
  beforeEach(() => {
    _clearMemorySink();
  });

  it("GET /api/journal without auth → 401", async () => {
    const res = await journalListGet(
      new Request("http://localhost/api/journal?tenant=bypilar"),
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/journal without tenant → 400", async () => {
    const res = await journalListGet(
      sessionReq("http://localhost/api/journal", {
        accountId: "acc_pilar",
        tenant: "bypilar",
        role: "owner",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("GET /api/journal cross-tenant → 403 tenant_mismatch", async () => {
    const res = await journalListGet(
      sessionReq("http://localhost/api/journal?tenant=nordlys", {
        accountId: "acc_pilar",
        tenant: "bypilar",
        role: "owner",
      }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("tenant_mismatch");
  });

  it("GET /api/journal with owner cookie → 200", async () => {
    const res = await journalListGet(
      sessionReq("http://localhost/api/journal?tenant=bypilar", {
        accountId: "acc_pilar",
        tenant: "bypilar",
        role: "owner",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.entries)).toBe(true);
  });

  it("reception cannot list journal → 403", async () => {
    const res = await journalListGet(
      sessionReq("http://localhost/api/journal?tenant=bypilar", {
        accountId: "acc_emil_reception",
        tenant: "bypilar",
        role: "reception",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("spoofed x-praxis-tenant without cookie → 401 (not 200)", async () => {
    const res = await journalListGet(
      new Request("http://localhost/api/journal?tenant=nordlys", {
        headers: {
          "x-praxis-tenant": "nordlys",
          "x-praxis-role": "owner",
          "x-praxis-account": "acc_fake",
        },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("GET journal by id cross-tenant → 403", async () => {
    const bypilar = listJournal({ tenant: "bypilar", limit: 1 })[0];
    expect(bypilar).toBeTruthy();
    const res = await journalGet(
      sessionReq(`http://localhost/api/journal/${bypilar!.id}`, {
        accountId: "acc_nadia",
        tenant: "nordlys",
        role: "owner",
      }),
      { params: Promise.resolve({ id: bypilar!.id }) },
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("tenant_mismatch");
    // no SOAP leakage
    expect(json.entry).toBeUndefined();
    expect(JSON.stringify(json)).not.toMatch(/soap/i);
  });

  it("GET missing journal id → 404", async () => {
    const res = await journalGet(
      sessionReq("http://localhost/api/journal/jr_does_not_exist", {
        accountId: "acc_pilar",
        tenant: "bypilar",
        role: "owner",
      }),
      { params: Promise.resolve({ id: "jr_does_not_exist" }) },
    );
    expect(res.status).toBe(404);
  });

  it("reception cannot sign journal → 403", async () => {
    const draft = listJournal({ tenant: "bypilar", status: "draft", limit: 1 })[0]
      ?? listJournal({ tenant: "bypilar", status: "pending_approval", limit: 1 })[0];
    expect(draft).toBeTruthy();
    const res = await journalSign(
      sessionReq(`http://localhost/api/journal/${draft!.id}/sign`, {
        accountId: "acc_emil_reception",
        tenant: "bypilar",
        role: "reception",
      }, { method: "POST", body: "{}" }),
      { params: Promise.resolve({ id: draft!.id }) },
    );
    expect(res.status).toBe(403);
  });

  it("POST create emits audit journal.created", async () => {
    const res = await journalListPost(
      sessionReq("http://localhost/api/journal", {
        accountId: "acc_sofie",
        tenant: "bypilar",
        role: "practitioner",
      }, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: "per",
          tenant: "bypilar",
          service: "Test note",
          soap: { S: "test", O: "", A: "", P: "" },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const sink = _readMemorySink();
    expect(sink.some((e) => e.event === "journal.created")).toBe(true);
  });

  it("sessionFromRequest reads cookie", () => {
    const s = sessionFromRequest(
      sessionReq("http://localhost/api", {
        accountId: "acc_pilar",
        tenant: "bypilar",
        role: "owner",
      }),
    );
    expect(s?.accountId).toBe("acc_pilar");
  });

  it("requireJournalAccess returns entry for matching tenant", () => {
    const entry = listJournal({ tenant: "bypilar", limit: 1 })[0]!;
    const r = requireJournalAccess(
      sessionReq("http://localhost/api", {
        accountId: "acc_pilar",
        tenant: "bypilar",
        role: "owner",
      }),
      entry.id,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entry.id).toBe(entry.id);
  });
});
