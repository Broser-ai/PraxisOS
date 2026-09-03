// F49–F54 · CODE-MAP, auth/me, public GET rate-limits, prime audit, cron audit

import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { _resetIpRateLimitForTests } from "@/lib/rate-limit";
import { GET as authMe } from "@/app/api/auth/me/route";
import { GET as servicesGet } from "@/app/api/v1/[tenant]/services/route";
import { GET as availabilityGet } from "@/app/api/v1/[tenant]/availability/route";
import { GET as cronTick } from "@/app/api/cron/swarm-tick/route";

const ROOT = process.cwd();

function ctx(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

describe("F49 · CODE-MAP + env captcha docs", () => {
  it("CODE-MAP mentions F41–F54 markers and captcha lib", () => {
    const map = readFileSync(join(ROOT, "CODE-MAP.md"), "utf8");
    expect(map).toMatch(/F41/);
    expect(map).toMatch(/F44/);
    expect(map).toMatch(/F45/);
    expect(map).toMatch(/F50/);
    expect(map).toMatch(/F51/);
    expect(map).toMatch(/F53/);
    expect(map).toMatch(/captcha/);
    expect(map).toMatch(/F11–F54|F49 refresh/);
  });

  it(".env.example documents Turnstile/hCaptcha", () => {
    const env = readFileSync(join(ROOT, ".env.example"), "utf8");
    expect(env).toMatch(/TURNSTILE_SECRET_KEY/);
    expect(env).toMatch(/HCAPTCHA_SECRET_KEY/);
    expect(env).toMatch(/CAPTCHA_FAIL_CLOSED/);
  });
});

describe("F50 · auth/me sessionFromRequest + audit", () => {
  beforeEach(() => _clearMemorySink());

  it("source uses sessionFromRequest and auditLogWithContext", () => {
    const src = readFileSync(join(ROOT, "app/api/auth/me/route.ts"), "utf8");
    expect(src).toMatch(/sessionFromRequest/);
    expect(src).toMatch(/auditLogWithContext/);
    expect(src).not.toMatch(/decodeSession/);
  });

  it("unauthenticated → 401", async () => {
    const res = await authMe(new Request("http://localhost/api/auth/me"));
    expect(res.status).toBe(401);
  });

  it("owner session → 200 + auth.me audit", async () => {
    const token = encodeSession({
      accountId: "acc_pilar",
      tenant: "bypilar",
      role: "owner",
      loggedInAt: new Date().toISOString(),
    });
    const res = await authMe(
      new Request("http://localhost/api/auth/me", {
        headers: {
          cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
          "x-request-id": "req_f50",
          "x-forwarded-for": "203.0.113.90",
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accountId).toBe("acc_pilar");
    const rec = _readMemorySink().find((r) => r.event === "auth.me");
    expect(rec).toBeTruthy();
    expect(rec?.request_id).toBe("req_f50");
    expect(rec?.ip).toBe("203.0.113.90");
  });
});

describe("F51 · services/availability public GET rate-limit", () => {
  beforeEach(() => _resetIpRateLimitForTests());

  it("services GET 429s under burst", async () => {
    let last = 0;
    for (let i = 0; i < 125; i++) {
      const res = await servicesGet(
        new Request("http://localhost/api/v1/bypilar/services", {
          headers: { "x-forwarded-for": "198.51.100.50" },
        }),
        ctx("bypilar"),
      );
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });

  it("availability GET 429s under burst", async () => {
    let last = 0;
    for (let i = 0; i < 125; i++) {
      const res = await availabilityGet(
        new Request(
          "http://localhost/api/v1/bypilar/availability?service=fod-med",
          { headers: { "x-forwarded-for": "198.51.100.51" } },
        ),
        ctx("bypilar"),
      );
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });
});

describe("F52 · prime missions auditLogWithContext", () => {
  it("missions route uses auditLogWithContext for seeded/forbidden", () => {
    const src = readFileSync(
      join(ROOT, "app/api/v1/[tenant]/prime/missions/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/auditLogWithContext/);
    expect(src).toMatch(/prime\.mission_seeded/);
    expect(src).toMatch(/prime\.mission_forbidden/);
    expect(src).not.toMatch(/\bauditLog\(/);
  });
});

describe("F53 · cron swarm-tick audit", () => {
  beforeEach(() => _clearMemorySink());

  it("route source uses auditLogWithContext", () => {
    const src = readFileSync(
      join(ROOT, "app/api/cron/swarm-tick/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/auditLogWithContext/);
    expect(src).toMatch(/swarm\.cron_tick/);
  });

  it("unauthorized in production without secret → 401 + audit", async () => {
    const prevCron = process.env.CRON_SECRET;
    const prevSwarm = process.env.SWARM_CRON_SECRET;
    const prevEnabled = process.env.PRAXIS_SWARM_ENABLED;
    try {
      process.env.PRAXIS_SWARM_ENABLED = "true";
      process.env.CRON_SECRET = "secret-f53";
      process.env.SWARM_CRON_SECRET = "secret-f53";
      vi.stubEnv("NODE_ENV", "production");
      const res = await cronTick(
        new Request("http://localhost/api/cron/swarm-tick", {
          headers: {
            authorization: "Bearer wrong",
            "x-request-id": "req_f53",
          },
        }),
      );
      expect(res.status).toBe(401);
      const rec = _readMemorySink().find((r) => r.event === "swarm.cron_unauthorized");
      expect(rec).toBeTruthy();
      expect(rec?.request_id).toBe("req_f53");
    } finally {
      vi.unstubAllEnvs();
      if (prevCron === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prevCron;
      if (prevSwarm === undefined) delete process.env.SWARM_CRON_SECRET;
      else process.env.SWARM_CRON_SECRET = prevSwarm;
      if (prevEnabled === undefined) delete process.env.PRAXIS_SWARM_ENABLED;
      else process.env.PRAXIS_SWARM_ENABLED = prevEnabled;
    }
  });
});

describe("F54 · operator checklist mentions F49–F54 path", () => {
  it("checklist still lists F41–F48 and captcha env", () => {
    const text = readFileSync(
      join(ROOT, "docs/ops/p0-operator-checklist-merge-cutover.md"),
      "utf8",
    );
    expect(text).toMatch(/F42/);
    expect(text).toMatch(/TURNSTILE|captcha/i);
    expect(text).toMatch(/F48/);
  });
});
