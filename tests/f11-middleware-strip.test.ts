// F11 · middleware strips spoofable x-praxis-* identity headers (P0 plan §F2).
// Defense-in-depth: regardless of how a handler guard is written, the edge
// neutralizes client-set x-praxis-tenant|role|account so they can never be
// trusted. x-praxis-signature (inbound webhook HMAC) is preserved.
//
// Next.js middleware encodes header overrides as:
//   x-middleware-override-headers: "<comma-list>"
//   x-middleware-request-<name>: "<value>"
// A header is overridden iff it appears in the override list; its downstream
// value is the matching x-middleware-request-<name>. We set spoofable headers
// to "" (falsy) so guards treat them as absent.

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

function makeReq(
  pathname: string,
  headers: Record<string, string> = {},
  host = "praxisos.example",
): NextRequest {
  const url = new URL(`https://${host}${pathname}`);
  return new NextRequest(url, {
    headers: new Headers({ host, ...headers }),
    method: "GET",
  });
}

function overrideList(res: import("next/server").NextResponse): string[] {
  const list = res.headers.get("x-middleware-override-headers");
  return list ? list.split(",") : [];
}

function overrideValue(res: import("next/server").NextResponse, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`);
}

describe("F11 · middleware strip spoofable x-praxis-* identity headers", () => {
  it("neutralizes x-praxis-tenant / role / account / account-id on a non-bypilar request", () => {
    const req = makeReq("/api/v1/bypilar/clients", {
      "x-praxis-tenant": "bypilar",
      "x-praxis-role": "owner",
      "x-praxis-account": "acc_pilar",
      "x-praxis-account-id": "acc_1",
      "x-request-id": "req_1",
    });
    const res = middleware(req);
    const list = overrideList(res);
    expect(list).toContain("x-praxis-tenant");
    expect(list).toContain("x-praxis-role");
    expect(list).toContain("x-praxis-account");
    expect(list).toContain("x-praxis-account-id");
    expect(overrideValue(res, "x-praxis-tenant")).toBe("");
    expect(overrideValue(res, "x-praxis-role")).toBe("");
    expect(overrideValue(res, "x-praxis-account")).toBe("");
    expect(overrideValue(res, "x-praxis-account-id")).toBe("");
    // Non-spoofable header preserved with its value.
    expect(overrideValue(res, "x-request-id")).toBe("req_1");
  });

  it("preserves x-praxis-signature (inbound webhook HMAC for /api/events)", () => {
    const req = makeReq("/api/events", {
      "x-praxis-signature": "sha256=abc",
      "x-praxis-tenant": "bypilar",
    });
    const res = middleware(req);
    // x-praxis-signature is carried through with its original value intact…
    expect(overrideValue(res, "x-praxis-signature")).toBe("sha256=abc");
    // …while the spoofable identity header is neutralized.
    expect(overrideValue(res, "x-praxis-tenant")).toBe("");
  });

  it("returns plain next() with no override header when nothing needs stripping", () => {
    const req = makeReq("/api/v1/bypilar/clients", { "x-request-id": "req_2" });
    const res = middleware(req);
    expect(res.headers.get("x-middleware-override-headers")).toBeNull();
  });

  it("redirects disallowed bypilar-host paths to /review", () => {
    const req = makeReq(
      "/forbidden",
      { "x-praxis-tenant": "bypilar", "x-praxis-role": "owner" },
      "app.bypilar.dk",
    );
    const res = middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location") ?? "").toContain("/review");
  });

  it("neutralizes identity headers on bypilar host allowed path (returns cleaned next)", () => {
    const req = makeReq(
      "/api/v1/bypilar/clients",
      { "x-praxis-tenant": "bypilar", "x-praxis-role": "owner" },
      "app.bypilar.dk",
    );
    const res = middleware(req);
    expect(overrideValue(res, "x-praxis-tenant")).toBe("");
    expect(overrideValue(res, "x-praxis-role")).toBe("");
  });
});
