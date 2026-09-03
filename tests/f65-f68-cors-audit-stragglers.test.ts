// F65–F68 · services/availability CORS, swarm/research audits, MCP unauthorized, worker context

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { _resetIpRateLimitForTests } from "@/lib/rate-limit";
import { GET as servicesGet } from "@/app/api/v1/[tenant]/services/route";
import { GET as availabilityGet } from "@/app/api/v1/[tenant]/availability/route";
import { POST as mcpPost } from "@/app/api/mcp/v1/route";

const ROOT = process.cwd();

function ctx(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

describe("F65 · services/availability CORS align", () => {
  beforeEach(() => _resetIpRateLimitForTests());

  it("sources use bookingAllowedOrigin (not wildcard *)", () => {
    for (const rel of [
      "app/api/v1/[tenant]/services/route.ts",
      "app/api/v1/[tenant]/availability/route.ts",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).toMatch(/bookingAllowedOrigin/);
      expect(src).not.toMatch(/access-control-allow-origin": "\*"/);
    }
  });

  it("services echoes allowlisted origin", async () => {
    const res = await servicesGet(
      new Request("http://localhost/api/v1/bypilar/services", {
        headers: {
          origin: "https://bypilar.dk",
          "x-forwarded-for": "198.51.100.80",
        },
      }),
      ctx("bypilar"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://bypilar.dk",
    );
  });

  it("availability omits ACAO for non-allowlisted origin", async () => {
    const res = await availabilityGet(
      new Request(
        "http://localhost/api/v1/bypilar/availability?service=fod-med",
        {
          headers: {
            origin: "https://evil.example.com",
            "x-forwarded-for": "198.51.100.81",
          },
        },
      ),
      ctx("bypilar"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("F66 · swarm/tick + research harvest audit wiring", () => {
  it("routes use auditLogWithContext", () => {
    for (const rel of [
      "app/api/v1/[tenant]/swarm/tick/route.ts",
      "app/api/v1/[tenant]/research/route.ts",
    ]) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).toMatch(/auditLogWithContext/);
    }
    expect(
      readFileSync(join(ROOT, "app/api/v1/[tenant]/swarm/tick/route.ts"), "utf8"),
    ).toMatch(/swarm\.tick/);
    expect(
      readFileSync(join(ROOT, "app/api/v1/[tenant]/research/route.ts"), "utf8"),
    ).toMatch(/research\.harvest/);
  });
});

describe("F67 · MCP unauthorized audit", () => {
  beforeEach(() => {
    _clearMemorySink();
    _resetIpRateLimitForTests();
  });

  it("tools/list without key emits mcp.unauthorized", async () => {
    const res = await mcpPost(
      new Request("http://localhost/api/mcp/v1", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "req_f67",
          "x-forwarded-for": "198.51.100.82",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "tools/list",
        }),
      }),
    );
    const b = await res.json();
    expect(b.error?.code).toBe(-32001);
    const rec = _readMemorySink().find((r) => r.event === "mcp.unauthorized");
    expect(rec).toBeTruthy();
    expect(rec?.request_id).toBe("req_f67");
  });
});

describe("F68 · worker auth uses auditLogWithContext", () => {
  it("agent-worker-auth imports auditLogWithContext", () => {
    const src = readFileSync(join(ROOT, "lib/agent-worker-auth.ts"), "utf8");
    expect(src).toMatch(/auditLogWithContext/);
    expect(src).not.toMatch(/import \{ auditLog \}/);
  });
});
