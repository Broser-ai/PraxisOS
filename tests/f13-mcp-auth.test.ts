// F13 · MCP /api/mcp/v1 verifyApiKey + tenant-from-key.
// Replaces the Bearer-prefix-only auth with a real verifyApiKey check that
// resolves the tenant from the verified key and threads it into tool calls.

import { describe, expect, it, beforeEach, vi } from "vitest";

// Spy on executeMcpTool so we can assert the tenant threaded through without
// running real handlers. vi.hoisted lets the mock factory reference the spy.
const { executeMcpToolMock } = vi.hoisted(() => ({
  executeMcpToolMock: vi.fn<
    (name: string, args: Record<string, unknown>, ctx: { tenant: string }) => Promise<unknown>
  >(),
}));
executeMcpToolMock.mockResolvedValue({ ok: true });
vi.mock("@/lib/mcp-handlers", () => ({
  executeMcpTool: executeMcpToolMock,
}));

import { resolveApiKey } from "@/lib/api-keys";
import { POST } from "@/app/api/mcp/v1/route";

const BYPILAR_KEY = "sk_live_8f2a9c47bf24c3d18a47b2c1d59e8f47";
const NORDLYS_KEY = "sk_live_9d3e5b8a4c12f0e1d2c3b4a5968778";
const REVOKED_KEY = "sk_test_dead0000beef0000";

function rpc(method: string, params: unknown = {}, headers: Record<string, string> = {}): Promise<Response> {
  return POST(
    new Request("http://localhost/api/mcp/v1", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
    }),
  );
}

async function body(res: Response): Promise<any> {
  return res.json();
}

describe("F13 · resolveApiKey", () => {
  it("resolves a bypilar key to tenant=bypilar", () => {
    const r = resolveApiKey(BYPILAR_KEY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.key.tenant).toBe("bypilar");
  });

  it("resolves a nordlys key to tenant=nordlys", () => {
    const r = resolveApiKey(NORDLYS_KEY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.key.tenant).toBe("nordlys");
  });

  it("rejects a masked display secret (cannot authenticate)", () => {
    // Masked secrets in the seed (containing '*') are never candidates.
    const r = resolveApiKey("sk_live_3e1b8a2c9f47****");
    expect(r.ok).toBe(false);
  });

  it("rejects a revoked key with key_revoked", () => {
    const r = resolveApiKey(REVOKED_KEY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("key_revoked");
  });

  it("rejects empty token with no_token", () => {
    const r = resolveApiKey("");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("no_token");
  });

  it("rejects a wrong-prefix token with invalid_token", () => {
    const r = resolveApiKey("not_a_key_12345678901234567890");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_token");
  });

  it("rejects an unknown but well-formed token with invalid_token", () => {
    const r = resolveApiKey("sk_live_unknown0000000000000000000000");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("invalid_token");
  });
});

describe("F13 · /api/mcp/v1 route auth", () => {
  beforeEach(() => {
    executeMcpToolMock.mockClear();
    executeMcpToolMock.mockResolvedValue({ ok: true });
  });

  it("initialize is open (no auth required)", async () => {
    const res = await rpc("initialize");
    const b = await body(res);
    expect(b.result.protocolVersion).toBe("2024-11-05");
  });

  it("ping is open (no auth required)", async () => {
    const res = await rpc("ping");
    const b = await body(res);
    expect(b.result).toEqual({});
  });

  it("tools/list without Authorization → -32001 unauthorized", async () => {
    const res = await rpc("tools/list");
    const b = await body(res);
    expect(b.error.code).toBe(-32001);
  });

  it("tools/list with a bare Bearer prefix (no real key) → -32001", async () => {
    const res = await rpc("tools/list", {}, { authorization: "Bearer not-a-key" });
    const b = await body(res);
    expect(b.error.code).toBe(-32001);
  });

  it("tools/list with a verified bypilar key → success", async () => {
    const res = await rpc("tools/list", {}, { authorization: `Bearer ${BYPILAR_KEY}` });
    const b = await body(res);
    expect(b.result.tools).toBeInstanceOf(Array);
    expect(b.result.tools.length).toBeGreaterThan(0);
  });

  it("tools/call threads the verified key's tenant into executeMcpTool (not hardcoded bypilar)", async () => {
    const res = await rpc(
      "tools/call",
      { name: "list_bookings", arguments: {} },
      { authorization: `Bearer ${NORDLYS_KEY}` },
    );
    expect(executeMcpToolMock).toHaveBeenCalledTimes(1);
    const [, , ctx] = executeMcpToolMock.mock.calls[0]!;
    expect((ctx as { tenant: string }).tenant).toBe("nordlys");
    const b = await body(res);
    expect(b.result).toBeTruthy();
  });

  it("tools/call with bypilar key threads tenant=bypilar", async () => {
    await rpc(
      "tools/call",
      { name: "list_bookings", arguments: {} },
      { authorization: `Bearer ${BYPILAR_KEY}` },
    );
    const [, , ctx] = executeMcpToolMock.mock.calls[0]!;
    expect((ctx as { tenant: string }).tenant).toBe("bypilar");
  });

  it("tools/call with revoked key → -32001 key revoked", async () => {
    const res = await rpc(
      "tools/call",
      { name: "list_bookings", arguments: {} },
      { authorization: `Bearer ${REVOKED_KEY}` },
    );
    const b = await body(res);
    expect(b.error.code).toBe(-32001);
    expect(executeMcpToolMock).not.toHaveBeenCalled();
  });
});
