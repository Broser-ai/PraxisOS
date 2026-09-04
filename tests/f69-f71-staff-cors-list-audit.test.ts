// F69–F71 · staff CORS strip + list audits + CODE-MAP/plan hygiene

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { GET as bookingsListGet } from "@/app/api/v1/[tenant]/bookings/list/route";
import { GET as clientsGet } from "@/app/api/v1/[tenant]/clients/route";

const ROOT = process.cwd();

function ownerCookie() {
  const token = encodeSession({
    accountId: "acc_pilar",
    tenant: "bypilar",
    role: "owner",
    loggedInAt: new Date().toISOString(),
  });
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}`;
}

describe("F69 · staff routes drop ACAO *", () => {
  it("clients + bookings/list sources have no wildcard ACAO", () => {
    for (const rel of [
      "app/api/v1/[tenant]/clients/route.ts",
      "app/api/v1/[tenant]/bookings/list/route.ts",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).not.toMatch(/access-control-allow-origin": "\*"/);
    }
  });

  it("clients GET response omits ACAO", async () => {
    const res = await clientsGet(
      new Request("http://localhost/api/v1/bypilar/clients", {
        headers: { cookie: ownerCookie() },
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("F70 · staff list audits", () => {
  beforeEach(() => _clearMemorySink());

  it("bookings/list emits booking.list_viewed", async () => {
    const res = await bookingsListGet(
      new Request("http://localhost/api/v1/bypilar/bookings/list", {
        headers: {
          cookie: ownerCookie(),
          "x-request-id": "req_f70_bl",
        },
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const rec = _readMemorySink().find((r) => r.event === "booking.list_viewed");
    expect(rec).toBeTruthy();
    expect(rec?.request_id).toBe("req_f70_bl");
  });

  it("clients GET emits client.list_viewed", async () => {
    const res = await clientsGet(
      new Request("http://localhost/api/v1/bypilar/clients", {
        headers: {
          cookie: ownerCookie(),
          "x-request-id": "req_f70_cl",
        },
      }),
      { params: Promise.resolve({ tenant: "bypilar" }) },
    );
    expect(res.status).toBe(200);
    const rec = _readMemorySink().find((r) => r.event === "client.list_viewed");
    expect(rec).toBeTruthy();
    expect(rec?.request_id).toBe("req_f70_cl");
  });
});

describe("F71 · plan/CODE-MAP markers for F65–F70", () => {
  it("plan lists F65–F70", () => {
    const plan = readFileSync(
      join(ROOT, "docs/ops/p0-secure-clinical-core-plan.md"),
      "utf8",
    );
    for (const f of ["F65", "F66", "F67", "F68", "F69", "F70"]) {
      expect(plan).toMatch(new RegExp(`\\*\\*${f}\\*\\*`));
    }
  });
});
