// INV-17 failure-mode coverage · Sprint 6 blocker B12
// Kontrakt: docs/harness/EPIC-1-Orchestration.md §10.2
// Repræsentativt public endpoint: GET /api/v1/{tenant}/services

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/v1/[tenant]/services/route";

function makeReq(tenant: string) {
  return new Request(`http://localhost:3000/api/v1/${tenant}/services`);
}

describe("INV-17 · endpoint-kontrakt (happy-path 200 vs. failure-mode != 200)", () => {
  it("(a) happy-path: kendt tenant (bypilar) → 200", async () => {
    const res = await GET(makeReq("bypilar"), {
      params: Promise.resolve({ tenant: "bypilar" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.services)).toBe(true);
    expect(body.tenant.slug).toBe("bypilar");
  });

  it("(b) failure-mode: ukendt tenant-slug → 404, IKKE 200", async () => {
    const res = await GET(makeReq("does-not-exist"), {
      params: Promise.resolve({ tenant: "does-not-exist" }),
    });

    expect(res.status).not.toBe(200);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe("tenant_not_found");
  });
});
