// F59 · MCP public surface rate-limit (initialize / ping / tools/list / GET discovery)

import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { _resetIpRateLimitForTests } from "@/lib/rate-limit";

vi.mock("@/lib/mcp-handlers", () => ({
  executeMcpTool: vi.fn().mockResolvedValue({ ok: true }),
}));

import { POST, GET } from "@/app/api/mcp/v1/route";

const ROOT = process.cwd();
const BYPILAR_KEY = "sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47";

function rpc(
  method: string,
  opts: { headers?: Record<string, string>; params?: unknown } = {},
): Promise<Response> {
  return POST(
    new Request("http://localhost/api/mcp/v1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(opts.headers ?? {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "1",
        method,
        params: opts.params ?? {},
      }),
    }),
  );
}

describe("F59 · MCP route sources", () => {
  it("uses checkIpRateLimit for public surface", () => {
    const src = readFileSync(join(ROOT, "app/api/mcp/v1/route.ts"), "utf8");
    expect(src).toMatch(/checkIpRateLimit/);
    expect(src).toMatch(/mcp:initialize|mcp:\$\{method\}|mcp:discovery/);
    expect(src).toMatch(/PRAXIS_MCP_ORIGINS/);
  });
});

describe("F59 · initialize / ping rate-limit", () => {
  beforeEach(() => _resetIpRateLimitForTests());

  it("initialize returns 429 under burst from same IP", async () => {
    let last = 0;
    for (let i = 0; i < 125; i++) {
      const res = await rpc("initialize", {
        headers: { "x-forwarded-for": "203.0.113.59" },
      });
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });

  it("ping still succeeds for first request", async () => {
    const res = await rpc("ping", {
      headers: { "x-forwarded-for": "203.0.113.60" },
    });
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.result).toEqual({});
  });
});

describe("F59 · tools/list rate-limit", () => {
  beforeEach(() => _resetIpRateLimitForTests());

  it("tools/list 429s under stricter burst (even with valid key)", async () => {
    let last = 0;
    for (let i = 0; i < 65; i++) {
      const res = await rpc("tools/list", {
        headers: {
          "x-forwarded-for": "203.0.113.61",
          authorization: `Bearer ${BYPILAR_KEY}`,
        },
      });
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });
});

describe("F59 · GET discovery rate-limit", () => {
  beforeEach(() => _resetIpRateLimitForTests());

  it("discovery GET 429s under burst", async () => {
    let last = 0;
    for (let i = 0; i < 125; i++) {
      const res = await GET(
        new Request("http://localhost/api/mcp/v1", {
          headers: { "x-forwarded-for": "203.0.113.62" },
        }),
      );
      last = res.status;
      if (res.status === 429) break;
    }
    expect(last).toBe(429);
  });

  it("discovery GET still 200 for first request", async () => {
    const res = await GET(
      new Request("http://localhost/api/mcp/v1", {
        headers: { "x-forwarded-for": "203.0.113.63" },
      }),
    );
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.name).toBe("praxisos");
  });
});
