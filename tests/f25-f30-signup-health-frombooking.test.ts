// F25 · signup abuse hardening — audit on success / failure / rate-limit
// F26 · health endpoint secrets redaction
// F27 · operator checklist linking #33+#34 + cutover
// F28 · middleware strip identity headers edge cases
// F30 · journal from-booking auth + audit context

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { encodeSession, SESSION_COOKIE, type Role } from "@/lib/auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { POST as signupPost } from "@/app/api/signup/route";
import { GET as healthGet, sanitizeHealthDetail } from "@/app/api/health/route";
import { POST as fromBookingPost } from "@/app/api/journal/from-booking/route";
import { middleware } from "../middleware";
import { listBookings } from "@/lib/bookings";

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
  headers.set("x-forwarded-for", "203.0.113.9");
  headers.set("user-agent", "vitest-f25/1");
  headers.set("x-request-id", "req_f25");
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(url, { ...init, headers });
}

function anonReq(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("x-forwarded-for", "203.0.113.9");
  headers.set("user-agent", "vitest-f25/1");
  headers.set("x-request-id", "req_f25");
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(url, { ...init, headers });
}

const owner = { accountId: "acc_pilar", tenant: "bypilar", role: "owner" as Role };
const nordlysOwner = {
  accountId: "acc_nadia",
  tenant: "nordlys",
  role: "owner" as Role,
};
const reception = {
  accountId: "acc_emil_reception",
  tenant: "bypilar",
  role: "reception" as Role,
};

describe("F25 · signup audit", () => {
  beforeEach(() => {
    _clearMemorySink();
  });

  it("missing fields → 400 + signup.failure audit with auth_mode public", async () => {
    const res = await signupPost(
      anonReq("http://localhost/api/signup", {
        method: "POST",
        body: JSON.stringify({ email: "x@example.com" }),
      }),
    );
    expect(res.status).toBe(400);
    const rec = _readMemorySink().find((e) => e.event === "signup.failure");
    expect(rec).toBeTruthy();
    expect(rec?.auth_mode).toBe("public");
    expect(rec?.route).toBe("/api/signup");
    expect(rec?.ip).toBe("203.0.113.9");
  });

  it("success → 201 + signup.success with tenant_id + request context", async () => {
    const slug = `clinic-f25-${Date.now().toString(36)}`;
    const res = await signupPost(
      anonReq("http://localhost/api/signup", {
        method: "POST",
        body: JSON.stringify({
          legalName: "F25 Test Klinik",
          contactName: "Test Owner",
          email: `${slug}@example.com`,
          slug,
          plan: "practice",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const rec = _readMemorySink().find((e) => e.event === "signup.success");
    expect(rec).toBeTruthy();
    expect(rec?.tenant_id).toBe(slug);
    expect(rec?.auth_mode).toBe("public");
    expect(rec?.route).toBe("/api/signup");
    expect(rec?.target_ref).toBe(`tenant/${slug}`);
  });

  it("slug_taken → 409 + signup.failure", async () => {
    const res = await signupPost(
      anonReq("http://localhost/api/signup", {
        method: "POST",
        body: JSON.stringify({
          legalName: "by Pilar",
          contactName: "Pilar",
          email: "dup-f25@example.com",
          slug: "bypilar",
        }),
      }),
    );
    expect(res.status).toBe(409);
    const rec = _readMemorySink().find((e) => e.event === "signup.failure");
    expect(rec).toBeTruthy();
    expect(rec?.tenant_id).toBe("bypilar");
  });
});

describe("F26 · health secrets redaction", () => {
  it("sanitizeHealthDetail strips URL credentials and JWTs", () => {
    expect(
      sanitizeHealthDetail(
        "connect failed https://user:s3cret@db.example/rest JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb",
      ),
    ).toMatch(/\[REDACTED\]@/);
    expect(
      sanitizeHealthDetail(
        "bad token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature",
      ),
    ).toContain("[REDACTED_JWT]");
    expect(
      sanitizeHealthDetail("SUPABASE_SERVICE_ROLE_KEY=super_secret_value_here"),
    ).toBe("SUPABASE_SERVICE_ROLE_KEY=[REDACTED]");
  });

  it("sanitizeHealthDetail preserves benign missing-key ops messages", () => {
    expect(
      sanitizeHealthDetail(
        "SUPABASE_SERVICE_ROLE_KEY missing — using durable memory store",
      ),
    ).toContain("missing");
  });

  it("GET /api/health never returns raw service-role assignment or JWT", async () => {
    const res = await healthGet();
    const json = await res.json();
    const blob = JSON.stringify(json);
    expect(blob).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./);
    expect(blob).not.toMatch(/SERVICE_ROLE_KEY=\S{8,}/);
    expect(blob).not.toMatch(/:\/\/[^/\s]+:[^/\s]+@/);
  });
});

describe("F27 · operator checklist #33+#34", () => {
  it("checklist doc exists and links PR #33, #34, cutover, invariants", () => {
    const path = join(
      process.cwd(),
      "docs/ops/p0-operator-checklist-merge-cutover.md",
    );
    const text = readFileSync(path, "utf8");
    expect(text).toMatch(/PR #33/);
    expect(text).toMatch(/PR #34/);
    expect(text).toMatch(/p0-db-cutover-runbook/);
    expect(text).toMatch(/NO_AUTO_MERGE/);
    expect(text).toMatch(/NO_AUTO_DEPLOY/);
    expect(text).toMatch(/suggestion_only/);
    expect(text).toMatch(/F16/);
    expect(text).toMatch(/F24/);
    expect(text).toMatch(/F25/);
    expect(text).toMatch(/F26/);
  });
});

describe("F28 · middleware strip edge cases", () => {
  function makeReq(
    pathname: string,
    headers: Record<string, string> = {},
    host = "praxisos.example",
  ): NextRequest {
    const url = new URL(`https://${host}${pathname}`);
    return new NextRequest(url, {
      headers: new Headers({ host, ...headers }),
      method: "POST",
    });
  }

  function overrideValue(
    res: import("next/server").NextResponse,
    name: string,
  ): string | null {
    return res.headers.get(`x-middleware-request-${name}`);
  }

  it("strips mixed-case spoof headers (Headers API case-insensitive)", () => {
    const req = makeReq("/api/journal", {
      "X-Praxis-Tenant": "bypilar",
      "X-PRAXIS-ROLE": "owner",
    });
    const res = middleware(req);
    expect(overrideValue(res, "x-praxis-tenant")).toBe("");
    expect(overrideValue(res, "x-praxis-role")).toBe("");
  });

  it("strips on POST /api/* without affecting signature", () => {
    const req = makeReq("/api/events", {
      "x-praxis-signature": "sha256=deadbeef",
      "x-praxis-account-id": "acc_spoof",
    });
    const res = middleware(req);
    expect(overrideValue(res, "x-praxis-signature")).toBe("sha256=deadbeef");
    expect(overrideValue(res, "x-praxis-account-id")).toBe("");
  });

  it("empty spoof values still get overridden to empty", () => {
    const req = makeReq("/api/v1/bypilar/clients", {
      "x-praxis-tenant": "",
      "x-praxis-role": "",
    });
    const res = middleware(req);
    // Present empty inbound → still in override set as ""
    expect(overrideValue(res, "x-praxis-tenant")).toBe("");
    expect(overrideValue(res, "x-praxis-role")).toBe("");
  });
});

describe("F30 · journal from-booking auth + audit", () => {
  beforeEach(() => {
    _clearMemorySink();
  });

  it("rejects unauthenticated → 401", async () => {
    const booking = listBookings({ tenant: "bypilar" })[0];
    expect(booking).toBeTruthy();
    const res = await fromBookingPost(
      anonReq("http://localhost/api/journal/from-booking", {
        method: "POST",
        body: JSON.stringify({ bookingId: booking!.id }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects cross-tenant session → 403", async () => {
    const booking = listBookings({ tenant: "bypilar" })[0];
    expect(booking).toBeTruthy();
    const res = await fromBookingPost(
      sessionReq("http://localhost/api/journal/from-booking", nordlysOwner, {
        method: "POST",
        body: JSON.stringify({ bookingId: booking!.id }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("reception same tenant → 200 and audit when newly created", async () => {
    const booking = listBookings({ tenant: "bypilar" }).find(
      (b) => b.id === "bk_c1",
    );
    expect(booking).toBeTruthy();
    const res = await fromBookingPost(
      sessionReq("http://localhost/api/journal/from-booking", reception, {
        method: "POST",
        body: JSON.stringify({ bookingId: booking!.id }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    if (json.created) {
      const rec = _readMemorySink().find(
        (e) => e.event === "journal.created_from_booking",
      );
      expect(rec).toBeTruthy();
      expect(rec?.auth_mode).toBe("session");
      expect(rec?.route).toBe("/api/journal/from-booking");
      expect(rec?.ip).toBe("203.0.113.9");
      expect(rec?.tenant_id).toBe("bypilar");
    }
  });

  it("missing bookingId → 400", async () => {
    const res = await fromBookingPost(
      sessionReq("http://localhost/api/journal/from-booking", owner, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });
});
