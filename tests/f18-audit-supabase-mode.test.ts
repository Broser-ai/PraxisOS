// F18 · audit supabase-mode e2e/unit.
// PRAXIS_AUDIT_MODE=supabase maps to audit_log 0008-aligned columns
// (incl. request context). Memory-mode still works. Stub silent.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  auditLog,
  auditLogWithContext,
  auditRequestContext,
  _clearMemorySink,
  _readMemorySink,
} from "@/lib/audit";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("F18 · memory mode still works", () => {
  const prev = process.env.PRAXIS_AUDIT_MODE;

  beforeEach(() => {
    _clearMemorySink();
    process.env.PRAXIS_AUDIT_MODE = "memory";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.PRAXIS_AUDIT_MODE;
    else process.env.PRAXIS_AUDIT_MODE = prev;
  });

  it("records full request context on memory sink", () => {
    auditLog(
      "journal.signed",
      { tenant_id: "bypilar", actor_user_id: "acc_sofie", target_ref: "journal/jr_1" },
      {
        ip: "10.0.0.1",
        user_agent: "Vitest",
        route: "/api/journal/jr_1/sign",
        request_id: "req_mem",
        auth_mode: "session",
      },
    );
    const rec = _readMemorySink().find((e) => e.event === "journal.signed");
    expect(rec).toBeTruthy();
    expect(rec?.ip).toBe("10.0.0.1");
    expect(rec?.user_agent).toBe("Vitest");
    expect(rec?.route).toBe("/api/journal/jr_1/sign");
    expect(rec?.request_id).toBe("req_mem");
    expect(rec?.auth_mode).toBe("session");
    expect(rec?.tenant_id).toBe("bypilar");
  });

  it("recovers memory mode after a supabase session", async () => {
    process.env.PRAXIS_AUDIT_MODE = "supabase";
    process.env.SUPABASE_URL = "https://db.example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc_test_key_long_enough";
    const origFetch = global.fetch;
    global.fetch = vi.fn(async () => new Response("{}", { status: 201 })) as unknown as typeof fetch;

    auditLog("tmp.supabase", { tenant_id: "bypilar" }, { request_id: "r_tmp" });
    await new Promise((r) => setTimeout(r, 10));

    process.env.PRAXIS_AUDIT_MODE = "memory";
    _clearMemorySink();
    auditLog("after.memory", { tenant_id: "nordlys" }, { ip: "1.1.1.1", auth_mode: "api_key" });
    const sink = _readMemorySink();
    expect(sink).toHaveLength(1);
    expect(sink[0]!.event).toBe("after.memory");
    expect(sink[0]!.ip).toBe("1.1.1.1");
    expect(sink[0]!.auth_mode).toBe("api_key");

    global.fetch = origFetch;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
});

describe("F18 · supabase mode → aligned schema + request context", () => {
  const origFetch = global.fetch;
  let captured: { url: string; body: Record<string, unknown> } | null = null;
  const prevMode = process.env.PRAXIS_AUDIT_MODE;
  const prevUrl = process.env.SUPABASE_URL;
  const prevPub = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    _clearMemorySink();
    captured = null;
    process.env.PRAXIS_AUDIT_MODE = "supabase";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_URL = "https://audit.eu.example.co/";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc_f18_test_key_ok";
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      captured = {
        url: String(url),
        body: JSON.parse(String(init?.body ?? "{}")),
      };
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = origFetch;
    if (prevMode === undefined) delete process.env.PRAXIS_AUDIT_MODE;
    else process.env.PRAXIS_AUDIT_MODE = prevMode;
    if (prevUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = prevUrl;
    if (prevPub === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevPub;
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  });

  it("POSTs all 0008 request-context columns via SUPABASE_URL", async () => {
    auditLog(
      "scan.processed",
      {
        tenant_id: "bypilar",
        actor_user_id: "acc_sofie",
        target_ref: "scan/per",
      },
      {
        ip: "203.0.113.9",
        user_agent: "PraxisOS/test",
        route: "/api/v1/scan/process",
        request_id: "req_f18",
        auth_mode: "session",
      },
    );
    await new Promise((r) => setTimeout(r, 15));
    expect(captured).toBeTruthy();
    expect(captured!.url).toBe("https://audit.eu.example.co/rest/v1/audit_log");
    const b = captured!.body;
    expect(b.action).toBe("scan.processed");
    expect(b.tenant_id).toBe("bypilar");
    expect(b.actor_user_id).toBe("acc_sofie");
    expect(b.target_ref).toBe("scan/per");
    expect(b.level).toBe("info");
    expect(b.ip).toBe("203.0.113.9");
    expect(b.user_agent).toBe("PraxisOS/test");
    expect(b.route).toBe("/api/v1/scan/process");
    expect(b.request_id).toBe("req_f18");
    expect(b.auth_mode).toBe("session");
    expect(b.at).toBeTruthy();
    expect(b.meta).toMatchObject({ tenant_id: "bypilar" });
  });

  it("also mirrors to memory L1 cache in supabase mode", async () => {
    auditLog("mirror.test", { tenant_id: "bypilar" }, { request_id: "r_m" });
    await new Promise((r) => setTimeout(r, 10));
    const rec = _readMemorySink().find((e) => e.event === "mirror.test");
    expect(rec?.request_id).toBe("r_m");
  });

  it("auditLogWithContext → supabase payload carries extracted fields", async () => {
    const req = new Request("http://localhost/api/bird/send", {
      headers: {
        "x-forwarded-for": "8.8.8.8",
        "user-agent": "curl/8",
        "x-request-id": "corr_f18",
      },
    });
    auditLogWithContext(req, "bird.sent", {
      tenant_id: "bypilar",
      auth_mode: "session",
    });
    await new Promise((r) => setTimeout(r, 15));
    expect(captured?.body.ip).toBe("8.8.8.8");
    expect(captured?.body.user_agent).toBe("curl/8");
    expect(captured?.body.route).toBe("/api/bird/send");
    expect(captured?.body.request_id).toBe("corr_f18");
    expect(captured?.body.auth_mode).toBe("session");
  });
});

describe("F18 · stub mode + schema alignment docs", () => {
  it("stub mode is silent (no memory push)", () => {
    const prev = process.env.PRAXIS_AUDIT_MODE;
    _clearMemorySink();
    process.env.PRAXIS_AUDIT_MODE = "stub";
    try {
      auditLog("should.not.appear", { tenant_id: "bypilar" });
      expect(_readMemorySink()).toHaveLength(0);
    } finally {
      if (prev === undefined) delete process.env.PRAXIS_AUDIT_MODE;
      else process.env.PRAXIS_AUDIT_MODE = prev;
    }
  });

  it("migration 0008 declares request context columns used by persistSupabase", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/0008_audit_log_align.sql"),
      "utf8",
    );
    for (const col of [
      "actor_user_id",
      "target_ref",
      "meta",
      "level",
      "request_id",
      "route",
      "auth_mode",
    ]) {
      expect(sql).toContain(col);
    }
  });

  it("auditRequestContext covers all request-context fields", () => {
    const ctx = auditRequestContext(
      new Request("http://localhost/api/x", {
        headers: {
          "x-forwarded-for": "1.2.3.4",
          "user-agent": "UA",
          "x-request-id": "rid",
        },
      }),
    );
    expect(ctx).toEqual({
      ip: "1.2.3.4",
      user_agent: "UA",
      route: "/api/x",
      request_id: "rid",
    });
  });
});
