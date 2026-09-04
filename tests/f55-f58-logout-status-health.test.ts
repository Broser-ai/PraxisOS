// F55–F58 · logout audit, agents/status audit, health rate-limit, F29 markers

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { _resetIpRateLimitForTests } from "@/lib/rate-limit";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { GET as agentsStatusGet } from "@/app/api/agents/status/route";
import { GET as healthGet } from "@/app/api/health/route";

const ROOT = process.cwd();

describe("F55 · logout audit", () => {
  beforeEach(() => _clearMemorySink());

  it("route uses auditLogWithContext", () => {
    const src = readFileSync(join(ROOT, "app/api/auth/logout/route.ts"), "utf8");
    expect(src).toMatch(/auditLogWithContext/);
    expect(src).toMatch(/logout\.success/);
  });

  it("owner logout emits logout.success with context", async () => {
    const token = encodeSession({
      accountId: "acc_pilar",
      tenant: "bypilar",
      role: "owner",
      loggedInAt: new Date().toISOString(),
    });
    const res = await logoutPost(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
          "x-request-id": "req_f55",
        },
      }),
    );
    expect(res.status).toBe(200);
    const rec = _readMemorySink().find((r) => r.event === "logout.success");
    expect(rec).toBeTruthy();
    expect(rec?.request_id).toBe("req_f55");
    expect(rec?.actor_user_id).toBe("acc_pilar");
  });
});

describe("F56 · agents/status audit", () => {
  beforeEach(() => _clearMemorySink());

  it("route uses auditLogWithContext agent.status_viewed", () => {
    const src = readFileSync(join(ROOT, "app/api/agents/status/route.ts"), "utf8");
    expect(src).toMatch(/auditLogWithContext/);
    expect(src).toMatch(/agent\.status_viewed/);
  });

  it("owner GET emits audit", async () => {
    const token = encodeSession({
      accountId: "acc_pilar",
      tenant: "bypilar",
      role: "owner",
      loggedInAt: new Date().toISOString(),
    });
    const res = await agentsStatusGet(
      new Request("http://localhost/api/agents/status", {
        headers: {
          cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
          "x-request-id": "req_f56",
        },
      }),
    );
    expect(res.status).toBe(200);
    const rec = _readMemorySink().find((r) => r.event === "agent.status_viewed");
    expect(rec).toBeTruthy();
    expect(rec?.request_id).toBe("req_f56");
  });
});

describe("F57 · health GET rate-limit", () => {
  beforeEach(() => _resetIpRateLimitForTests());

  it("health 429s under generous burst", async () => {
    let last = 0;
    for (let i = 0; i < 305; i++) {
      const res = await healthGet(
        new Request("http://localhost/api/health", {
          headers: { "x-forwarded-for": "198.51.100.60" },
        }),
      );
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });

  it("health still 200 for first request", async () => {
    const res = await healthGet(
      new Request("http://localhost/api/health", {
        headers: { "x-forwarded-for": "198.51.100.61" },
      }),
    );
    expect([200, 503]).toContain(res.status);
  });
});

describe("F58 · F29 markers include requireJournalAccess + logout", () => {
  it("F29 audit still lists journal requireJournalAccess", () => {
    const src = readFileSync(
      join(ROOT, "tests/f29-authorize-tenant-usage-audit.test.ts"),
      "utf8",
    );
    expect(src).toMatch(/requireJournalAccess/);
  });

  it("logout is intentionally public (cookie clear) with audit", () => {
    const src = readFileSync(join(ROOT, "app/api/auth/logout/route.ts"), "utf8");
    expect(src).toMatch(/SESSION_COOKIE/);
    expect(src).toMatch(/auditLogWithContext/);
  });
});
