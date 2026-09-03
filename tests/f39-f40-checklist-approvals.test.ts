// F39 · operator checklist refresh (F31–F38 smoke)
// F40 · agents/approvals audit request context

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { _clearMemorySink } from "@/lib/audit";
import { POST as approvalsPost } from "@/app/api/agents/approvals/route";

describe("F39 · operator checklist refresh", () => {
  it("lists F31–F38 smoke items + invariants", () => {
    const text = readFileSync(
      join(process.cwd(), "docs/ops/p0-operator-checklist-merge-cutover.md"),
      "utf8",
    );
    expect(text).toMatch(/F34/);
    expect(text).toMatch(/F33|F36/);
    expect(text).toMatch(/F32/);
    expect(text).toMatch(/F35/);
    expect(text).toMatch(/F23/);
    expect(text).toMatch(/NO_AUTO_MERGE/);
    expect(text).toMatch(/suggestion_only/);
  });
});

describe("F40 · approvals audit context wiring", () => {
  beforeEach(() => {
    _clearMemorySink();
  });

  it("approvals route source uses auditLogWithContext", () => {
    const src = readFileSync(
      join(process.cwd(), "app/api/agents/approvals/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/auditLogWithContext/);
    expect(src).toMatch(/approval\.decided/);
  });

  it("unauthenticated POST still 401 (regression)", async () => {
    const res = await approvalsPost(
      new Request("http://localhost/api/agents/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "appr_x", decision: "approved" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("owner POST missing approval → 404/400 without crashing audit path", async () => {
    const token = encodeSession({
      accountId: "acc_pilar",
      tenant: "bypilar",
      role: "owner",
      loggedInAt: new Date().toISOString(),
    });
    const res = await approvalsPost(
      new Request("http://localhost/api/agents/approvals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
          "x-forwarded-for": "203.0.113.60",
          "x-request-id": "req_f40",
        },
        body: JSON.stringify({ id: "appr_does_not_exist", decision: "approved" }),
      }),
    );
    expect([400, 404]).toContain(res.status);
  });
});
