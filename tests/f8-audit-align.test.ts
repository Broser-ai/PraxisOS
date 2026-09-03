// F8 · audit align migration 0008 + request context + wire emits.
// audit_log schema aligned with persistSupabase payload; auditLog gains
// request context (ip, user_agent, route, request_id, auth_mode); login
// failure/success now emit audit.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  auditLog,
  auditLogWithContext,
  auditRequestContext,
  _clearMemorySink,
  _readMemorySink,
} from "@/lib/audit";
import { POST as loginPost } from "@/app/api/auth/login/route";

function req(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe("F8 · auditRequestContext", () => {
  it("extracts ip, user-agent, route, request_id from a Request", () => {
    const r = req("http://localhost/api/journal/jr_1", {
      headers: {
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        "user-agent": "curl/8.5",
        "x-request-id": "req_abc",
      },
    });
    const ctx = auditRequestContext(r);
    expect(ctx.ip).toBe("203.0.113.7");
    expect(ctx.user_agent).toBe("curl/8.5");
    expect(ctx.route).toBe("/api/journal/jr_1");
    expect(ctx.request_id).toBe("req_abc");
  });

  it("falls back to x-real-ip and x-correlation-id", () => {
    const r = req("http://localhost/api/clients", {
      headers: { "x-real-ip": "9.9.9.9", "x-correlation-id": "corr_1" },
    });
    const ctx = auditRequestContext(r);
    expect(ctx.ip).toBe("9.9.9.9");
    expect(ctx.request_id).toBe("corr_1");
  });
});

describe("F8 · auditLogWithContext / context param", () => {
  beforeEach(() => {
    _clearMemorySink();
  });

  it("auditLogWithContext records ip/user_agent/route on the record", () => {
    const r = req("http://localhost/api/v1/bypilar/clients", {
      headers: { "x-forwarded-for": "1.2.3.4", "user-agent": "UA/1" },
    });
    auditLogWithContext(r, "client.listed", {
      tenant_id: "bypilar",
      actor_user_id: "acc_pilar",
    });
    const sink = _readMemorySink();
    const rec = sink.find((e) => e.event === "client.listed");
    expect(rec).toBeTruthy();
    expect(rec?.ip).toBe("1.2.3.4");
    expect(rec?.user_agent).toBe("UA/1");
    expect(rec?.route).toBe("/api/v1/bypilar/clients");
  });

  it("auditLog context param populates request_id + auth_mode", () => {
    auditLog(
      "journal.signed",
      { tenant_id: "bypilar", actor_user_id: "acc_sofie", target_ref: "journal/jr_1" },
      { request_id: "req_x", auth_mode: "session", route: "/api/journal/jr_1/sign" },
    );
    const rec = _readMemorySink().find((e) => e.event === "journal.signed");
    expect(rec?.request_id).toBe("req_x");
    expect(rec?.auth_mode).toBe("session");
    expect(rec?.route).toBe("/api/journal/jr_1/sign");
  });

  it("meta-level keys still extract (back-compat) when no context", () => {
    auditLog("secrets.updated", {
      actor_user_id: "acc_pilar",
      target_ref: "config/bird",
      ip: "5.5.5.5",
      route: "/api/bird/config",
    });
    const rec = _readMemorySink().find((e) => e.event === "secrets.updated");
    expect(rec?.ip).toBe("5.5.5.5");
    expect(rec?.route).toBe("/api/bird/config");
  });
});

describe("F8 · persistSupabase payload aligned with audit_log 0008 columns", () => {
  const origFetch = global.fetch;
  let captured: { url: string; init: RequestInit } | null = null;

  beforeEach(() => {
    _clearMemorySink();
    process.env.PRAXIS_AUDIT_MODE = "supabase";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc_test_key";
    captured = null;
    global.fetch = vi.fn(async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = origFetch;
    delete process.env.PRAXIS_AUDIT_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("POSTs aligned columns (actor_user_id, target_ref, meta, level, ip, user_agent, route, request_id, auth_mode)", async () => {
    auditLog(
      "scan.processed",
      {
        tenant_id: "bypilar",
        actor_user_id: "acc_sofie",
        target_ref: "scan/per",
      },
      { ip: "1.2.3.4", user_agent: "UA", route: "/api/v1/scan/process", request_id: "r1", auth_mode: "session" },
    );
    // fire-and-forget; let microtasks flush
    await new Promise((r) => setTimeout(r, 10));
    expect(captured).toBeTruthy();
    expect(captured!.url).toBe("https://db.example.supabase.co/rest/v1/audit_log");
    const body = JSON.parse(String(captured!.init.body));
    expect(body.action).toBe("scan.processed");
    expect(body.tenant_id).toBe("bypilar");
    expect(body.actor_user_id).toBe("acc_sofie");
    expect(body.target_ref).toBe("scan/per");
    expect(body.level).toBe("info");
    expect(body.meta).toEqual({
      tenant_id: "bypilar",
      actor_user_id: "acc_sofie",
      target_ref: "scan/per",
    });
    expect(body.ip).toBe("1.2.3.4");
    expect(body.user_agent).toBe("UA");
    expect(body.route).toBe("/api/v1/scan/process");
    expect(body.request_id).toBe("r1");
    expect(body.auth_mode).toBe("session");
    expect(body.at).toBeTruthy();
  });
});

describe("F8 · login audit emits (failure + success)", () => {
  beforeEach(() => {
    _clearMemorySink();
  });

  it("invalid credentials → 401 + audit login.failure with request context", async () => {
    const res = await loginPost(
      req("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.7",
          "user-agent": "curl/8.5",
        },
        body: JSON.stringify({ email: "nope@bypilar.dk", password: "wrong" }),
      }),
    );
    expect(res.status).toBe(401);
    const rec = _readMemorySink().find((e) => e.event === "login.failure");
    expect(rec).toBeTruthy();
    expect(rec?.ip).toBe("203.0.113.7");
    expect(rec?.user_agent).toBe("curl/8.5");
    expect(rec?.route).toBe("/api/auth/login");
  });

  it("valid credentials → 200 + audit login.success", async () => {
    const res = await loginPost(
      req("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "62.198.4.117",
        },
        body: JSON.stringify({ email: "pilar@bypilar.dk", password: "demo" }),
      }),
    );
    expect(res.status).toBe(200);
    const rec = _readMemorySink().find((e) => e.event === "login.success");
    expect(rec).toBeTruthy();
    expect(rec?.tenant_id).toBe("bypilar");
    expect(rec?.auth_mode).toBe("session");
    expect(rec?.ip).toBe("62.198.4.117");
  });
});
