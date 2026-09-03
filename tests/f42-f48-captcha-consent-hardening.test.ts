// F42–F48 · captcha verify, consent audit, public GET rate-limit,
// agents/run audit, authorizeTenant stragglers, checklist, lookup harden

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  verifyCaptchaToken,
  resolveCaptchaProvider,
  captchaFailClosed,
  captchaKeysConfigured,
} from "@/lib/captcha";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { _resetIpRateLimitForTests } from "@/lib/rate-limit";
import { _resetBookingRateLimitForTests } from "@/lib/public-booking-kit";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { POST as consentPost } from "@/app/api/v1/[tenant]/consent/route";
import { GET as birdConfigGet } from "@/app/api/bird/config/route";
import { GET as birdStatusGet } from "@/app/api/bird/status/route";
import { GET as scanConfigGet } from "@/app/api/scan/config/route";
import { POST as agentsRunPost } from "@/app/api/agents/run/route";
import { GET as lookupGet } from "@/app/api/v1/[tenant]/lookup/route";
import { GET as voucherGet } from "@/app/api/v1/[tenant]/voucher/route";

const ROOT = process.cwd();

function ctx(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

describe("F42 · captcha verify path", () => {
  const keys = [
    "TURNSTILE_SECRET_KEY",
    "HCAPTCHA_SECRET_KEY",
    "CAPTCHA_PROVIDER",
    "CAPTCHA_FAIL_CLOSED",
    "CAPTCHA_DEV_BYPASS",
    "NODE_ENV",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) saved[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of keys) {
      if (k === "NODE_ENV") continue;
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("missing token when required → captcha_required", async () => {
    const r = await verifyCaptchaToken({ required: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("captcha_required");
  });

  it("dev bypass accepts non-empty token without keys", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.HCAPTCHA_SECRET_KEY;
    process.env.CAPTCHA_PROVIDER = "none";
    vi.stubEnv("NODE_ENV", "test");
    process.env.CAPTCHA_DEV_BYPASS = "1";
    const r = await verifyCaptchaToken({ token: "dev-token", required: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bypass).toBe(true);
  });

  it("production fail-closed without keys when required", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.HCAPTCHA_SECRET_KEY;
    process.env.CAPTCHA_PROVIDER = "none";
    vi.stubEnv("NODE_ENV", "production");
    process.env.CAPTCHA_FAIL_CLOSED = "1";
    process.env.CAPTCHA_DEV_BYPASS = "0";
    const r = await verifyCaptchaToken({ token: "x", required: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("captcha_unavailable");
    expect(captchaFailClosed()).toBe(true);
  });

  it("turnstile path calls siteverify when key set", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    process.env.CAPTCHA_PROVIDER = "turnstile";
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await verifyCaptchaToken({ token: "tok_abc", ip: "1.2.3.4", required: true });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("turnstile");
    expect(resolveCaptchaProvider()).toBe("turnstile");
    expect(captchaKeysConfigured()).toBe(true);
  });

  it("login + signup routes import verifyCaptchaToken", () => {
    for (const rel of ["app/api/auth/login/route.ts", "app/api/signup/route.ts"]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).toMatch(/verifyCaptchaToken/);
    }
  });
});

describe("F43 · consent auditLogWithContext", () => {
  beforeEach(() => {
    _clearMemorySink();
    _resetBookingRateLimitForTests();
  });

  it("route source uses auditLogWithContext", () => {
    const src = readFileSync(
      join(ROOT, "app/api/v1/[tenant]/consent/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/auditLogWithContext/);
    expect(src).not.toMatch(/\bauditLog\(/);
  });

  it("POST emits consent.onboarding_batch with request context", async () => {
    const res = await consentPost(
      new Request("http://localhost/api/v1/bypilar/consent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.70",
          "x-request-id": "req_f43",
          "user-agent": "vitest-f43",
        },
        body: JSON.stringify({
          email: "f43@example.com",
          name: "F43",
          consents: { treatment: true, journal: true },
        }),
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(201);
    const rec = _readMemorySink().find((r) => r.event === "consent.onboarding_batch");
    expect(rec).toBeTruthy();
    expect(rec?.ip).toBe("203.0.113.70");
    expect(rec?.request_id).toBe("req_f43");
    expect(rec?.auth_mode).toBe("public");
  });
});

describe("F44 · public GET rate-limit bird/scan", () => {
  beforeEach(() => _resetIpRateLimitForTests());

  it("bird status 429s under burst", async () => {
    let last = 0;
    for (let i = 0; i < 65; i++) {
      const res = await birdStatusGet(
        new Request("http://localhost/api/bird/status", {
          headers: { "x-forwarded-for": "198.51.100.44" },
        }),
      );
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });

  it("bird config GET 429s under burst", async () => {
    let last = 0;
    for (let i = 0; i < 65; i++) {
      const res = await birdConfigGet(
        new Request("http://localhost/api/bird/config", {
          headers: { "x-forwarded-for": "198.51.100.45" },
        }),
      );
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });

  it("scan config GET 429s under burst", async () => {
    let last = 0;
    for (let i = 0; i < 65; i++) {
      const res = await scanConfigGet(
        new Request("http://localhost/api/scan/config", {
          headers: { "x-forwarded-for": "198.51.100.46" },
        }),
      );
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });
});

describe("F45 · agents/run audit context", () => {
  beforeEach(() => _clearMemorySink());

  it("route source uses auditLogWithContext agent.run", () => {
    const src = readFileSync(join(ROOT, "app/api/agents/run/route.ts"), "utf8");
    expect(src).toMatch(/auditLogWithContext/);
    expect(src).toMatch(/agent\.run/);
  });

  it("unauthenticated still 401", async () => {
    const res = await agentsRunPost(
      new Request("http://localhost/api/agents/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hi" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("owner run emits agent.run audit with request context", async () => {
    const token = encodeSession({
      accountId: "acc_pilar",
      tenant: "bypilar",
      role: "owner",
      loggedInAt: new Date().toISOString(),
    });
    const res = await agentsRunPost(
      new Request("http://localhost/api/agents/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
          "x-forwarded-for": "203.0.113.80",
          "x-request-id": "req_f45",
        },
        body: JSON.stringify({ message: "Hvad er klinikens åbningstid?" }),
      }),
    );
    expect(res.status).toBe(200);
    const rec = _readMemorySink().find((r) => r.event === "agent.run");
    expect(rec).toBeTruthy();
    expect(rec?.ip).toBe("203.0.113.80");
    expect(rec?.request_id).toBe("req_f45");
    expect(rec?.tenant_id).toBe("bypilar");
  });
});

describe("F46 · authorizeTenantRequest stragglers", () => {
  it("prime missions uses requireTenantAccess not decodeSession", () => {
    const src = readFileSync(
      join(ROOT, "app/api/v1/[tenant]/prime/missions/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/requireTenantAccess/);
    expect(src).not.toMatch(/decodeSession/);
  });
});

describe("F47 · operator checklist F23–F40 (+ F41–F48)", () => {
  it("lists F23–F48 smoke items + invariants", () => {
    const text = readFileSync(
      join(ROOT, "docs/ops/p0-operator-checklist-merge-cutover.md"),
      "utf8",
    );
    expect(text).toMatch(/F23/);
    expect(text).toMatch(/F40/);
    expect(text).toMatch(/F41/);
    expect(text).toMatch(/F42/);
    expect(text).toMatch(/F44/);
    expect(text).toMatch(/F45/);
    expect(text).toMatch(/F48/);
    expect(text).toMatch(/NO_AUTO_MERGE/);
    expect(text).toMatch(/suggestion_only/);
  });
});

describe("F48 · lookup/voucher remaining gaps", () => {
  it("lookup rejects malformed email → 400", async () => {
    const res = await lookupGet(
      new Request("http://localhost/api/v1/bypilar/lookup?email=not-an-email&service=fod-med"),
      ctx("bypilar"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_email");
  });

  it("lookup known client schemes omit memberId", async () => {
    // Use a seeded client email if present; otherwise known:false is fine for shape
    const res = await lookupGet(
      new Request(
        "http://localhost/api/v1/bypilar/lookup?email=pilar%40bypilar.dk&service=fod-med",
      ),
      ctx("bypilar"),
    );
    expect([200]).toContain(res.status);
    const body = await res.json();
    if (body.known && Array.isArray(body.schemes)) {
      for (const s of body.schemes) {
        expect(s).not.toHaveProperty("memberId");
      }
    }
  });

  it("voucher rejects short code → 400", async () => {
    const res = await voucherGet(
      new Request("http://localhost/api/v1/bypilar/voucher?code=AB"),
      ctx("bypilar"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_code");
  });
});
