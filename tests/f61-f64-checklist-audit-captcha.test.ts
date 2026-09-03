// F61–F64 · checklist, mutation audit gaps, captcha sitekey skip, stragglers

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { _resetBookingRateLimitForTests } from "@/lib/public-booking-kit";
import {
  captchaSiteKeyConfigured,
  publicCaptchaSiteConfig,
} from "@/lib/captcha";
import { POST as bookingsPost } from "@/app/api/v1/[tenant]/bookings/route";
import { POST as eventsPost } from "@/app/api/events/route";
import { POST as tickPost } from "@/app/api/agents/tick/route";
import { signEventPayload } from "@/lib/event-bus";

const ROOT = process.cwd();

describe("F61 · operator checklist F49–F58 (+ F59–F64)", () => {
  it("checklist documents F49–F64 smoke items", () => {
    const text = readFileSync(
      join(ROOT, "docs/ops/p0-operator-checklist-merge-cutover.md"),
      "utf8",
    );
    expect(text).toMatch(/F49–F58/);
    expect(text).toMatch(/F55/);
    expect(text).toMatch(/F59/);
    expect(text).toMatch(/F60/);
    expect(text).toMatch(/F62/);
    expect(text).toMatch(/F63/);
    expect(text).toMatch(/PRAXIS_MCP_ORIGINS/);
  });
});

describe("F62 · mutation route auditLogWithContext gaps", () => {
  beforeEach(() => {
    _clearMemorySink();
    _resetBookingRateLimitForTests();
  });

  it("bookings/events/tick/workflows/swarm/research/orchestrator use auditLogWithContext", () => {
    const paths = [
      "app/api/v1/[tenant]/bookings/route.ts",
      "app/api/events/route.ts",
      "app/api/agents/tick/route.ts",
      "app/api/agents/workflows/route.ts",
      "app/api/v1/[tenant]/swarm/route.ts",
      "app/api/v1/[tenant]/research/ask/route.ts",
      "app/api/v1/[tenant]/orchestrator/route.ts",
    ];
    for (const rel of paths) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, rel).toMatch(/auditLogWithContext/);
    }
  });

  it("public booking POST emits booking.created", async () => {
    const res = await bookingsPost(
      new Request("http://localhost/api/v1/bypilar/bookings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "req_f62_book",
          "x-forwarded-for": "198.51.100.70",
        },
        body: JSON.stringify({
          serviceId: "fod-med",
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          client: {
            name: "F62 Patient",
            email: `f62-${Date.now()}@example.com`,
            phone: "+4511111111",
          },
        }),
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(201);
    const rec = _readMemorySink().find((r) => r.event === "booking.created");
    expect(rec).toBeTruthy();
    expect(rec?.request_id).toBe("req_f62_book");
    expect(rec?.tenant_id).toBe("bypilar");
  });

  it("events POST emits event.published", async () => {
    const payload = JSON.stringify({
      type: "f62.test",
      tenant: "bypilar",
      data: { ok: true },
    });
    const sig = signEventPayload(payload);
    const res = await eventsPost(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-praxis-signature": sig,
          "x-request-id": "req_f62_evt",
        },
        body: payload,
      }),
    );
    expect(res.status).toBe(200);
    const rec = _readMemorySink().find((r) => r.event === "event.published");
    expect(rec).toBeTruthy();
    expect(rec?.request_id).toBe("req_f62_evt");
  });

  it("agents/tick unauthorized emits agent.tick_unauthorized", async () => {
    const prev = process.env.AGENT_WORKER_SECRET;
    process.env.AGENT_WORKER_SECRET = "f62-secret";
    try {
      const res = await tickPost(
        new Request("http://localhost/api/agents/tick", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-request-id": "req_f62_tick",
          },
          body: "{}",
        }),
      );
      expect(res.status).toBe(401);
      const rec = _readMemorySink().find(
        (r) => r.event === "agent.tick_unauthorized",
      );
      expect(rec).toBeTruthy();
      expect(rec?.request_id).toBe("req_f62_tick");
    } finally {
      if (prev === undefined) delete process.env.AGENT_WORKER_SECRET;
      else process.env.AGENT_WORKER_SECRET = prev;
    }
  });
});

describe("F63 · captcha sitekey UI skip without keys", () => {
  const KEYS = [
    "TURNSTILE_SITE_KEY",
    "HCAPTCHA_SITE_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "NEXT_PUBLIC_HCAPTCHA_SITE_KEY",
    "CAPTCHA_PROVIDER",
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it(".env.example has sitekey placeholders + F63 skip-UI docs", () => {
    const env = readFileSync(join(ROOT, ".env.example"), "utf8");
    expect(env).toMatch(/TURNSTILE_SITE_KEY/);
    expect(env).toMatch(/HCAPTCHA_SITE_KEY/);
    expect(env).toMatch(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
    expect(env).toMatch(/F63/);
    expect(env).toMatch(/skip UI|widgets render ONLY/i);
  });

  it("publicCaptchaSiteConfig returns null without site keys", () => {
    expect(publicCaptchaSiteConfig()).toBeNull();
    expect(captchaSiteKeyConfigured()).toBe(false);
  });

  it("publicCaptchaSiteConfig returns config when NEXT_PUBLIC site key set", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "pk_test_site";
    process.env.CAPTCHA_PROVIDER = "turnstile";
    expect(publicCaptchaSiteConfig()).toEqual({
      provider: "turnstile",
      siteKey: "pk_test_site",
    });
    expect(captchaSiteKeyConfigured()).toBe(true);
  });

  it("login page does not hardcode a captcha widget (UI skipped)", () => {
    const login = readFileSync(join(ROOT, "app/login/page.tsx"), "utf8");
    expect(login).not.toMatch(/turnstile|hcaptcha|CaptchaWidget/i);
  });
});

describe("F64 · CODE-MAP + plan markers", () => {
  it("plan marks F59–F64 done", () => {
    const plan = readFileSync(
      join(ROOT, "docs/ops/p0-secure-clinical-core-plan.md"),
      "utf8",
    );
    expect(plan).toMatch(/\*\*F59\*\*/);
    expect(plan).toMatch(/\*\*F60\*\*/);
    expect(plan).toMatch(/\*\*F61\*\*/);
    expect(plan).toMatch(/\*\*F62\*\*/);
    expect(plan).toMatch(/\*\*F63\*\*/);
    expect(plan).toMatch(/\*\*F64\*\*/);
  });

  it("session cookie encode still works for swarm audit smoke import", () => {
    const token = encodeSession({
      accountId: "acc_pilar",
      tenant: "bypilar",
      role: "owner",
      loggedInAt: new Date().toISOString(),
    });
    expect(token.length).toBeGreaterThan(10);
    expect(SESSION_COOKIE).toBeTruthy();
  });
});
