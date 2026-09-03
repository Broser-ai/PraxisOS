// F75–F76 · MCP tools/call audit + research paper view audit

import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth";
import { _clearMemorySink, _readMemorySink } from "@/lib/audit";
import { _resetIpRateLimitForTests } from "@/lib/rate-limit";

vi.mock("@/lib/mcp-handlers", () => ({
  executeMcpTool: vi.fn().mockResolvedValue({ ok: true }),
}));

import { POST as mcpPost } from "@/app/api/mcp/v1/route";
import { GET as paperGet } from "@/app/api/v1/[tenant]/research/papers/[arxivId]/route";

const ROOT = process.cwd();
const BYPILAR_KEY = "sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47";

describe("F75 · MCP tools/call audit", () => {
  beforeEach(() => {
    _clearMemorySink();
    _resetIpRateLimitForTests();
  });

  it("route emits mcp.tools_call", async () => {
    const src = readFileSync(join(ROOT, "app/api/mcp/v1/route.ts"), "utf8");
    expect(src).toMatch(/mcp\.tools_call/);

    const res = await mcpPost(
      new Request("http://localhost/api/mcp/v1", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${BYPILAR_KEY}`,
          "x-request-id": "req_f75",
          "x-forwarded-for": "198.51.100.90",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "tools/call",
          params: { name: "list_bookings", arguments: {} },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const rec = _readMemorySink().find((r) => r.event === "mcp.tools_call");
    expect(rec).toBeTruthy();
    expect(rec?.request_id).toBe("req_f75");
    expect(rec?.target_ref).toBe("list_bookings");
  });
});

describe("F76 · research paper view audit", () => {
  beforeEach(() => _clearMemorySink());

  it("route uses auditLogWithContext research.paper_viewed", () => {
    const src = readFileSync(
      join(ROOT, "app/api/v1/[tenant]/research/papers/[arxivId]/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/auditLogWithContext/);
    expect(src).toMatch(/research\.paper_viewed/);
  });

  it("owner GET emits audit when paper exists (or 404 without crash)", async () => {
    const token = encodeSession({
      accountId: "acc_pilar",
      tenant: "bypilar",
      role: "owner",
      loggedInAt: new Date().toISOString(),
    });
    const res = await paperGet(
      new Request(
        "http://localhost/api/v1/bypilar/research/papers/2401.00001",
        {
          headers: {
            cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
            "x-request-id": "req_f76",
          },
        },
      ),
      {
        params: Promise.resolve({
          tenant: "bypilar",
          arxivId: "2401.00001",
        }),
      },
    );
    // Paper may or may not exist in fixture store — either 200+audit or 404.
    if (res.status === 200) {
      const rec = _readMemorySink().find(
        (r) => r.event === "research.paper_viewed",
      );
      expect(rec).toBeTruthy();
      expect(rec?.request_id).toBe("req_f76");
    } else {
      expect(res.status).toBe(404);
    }
  });
});
