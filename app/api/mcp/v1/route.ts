// PraxisOS MCP server · JSON-RPC 2.0 over HTTP
// Model Context Protocol · modelcontextprotocol.io
//
// Claude Code (eller anden MCP-klient) tilkobler ved at sætte:
//   { "mcpServers": { "praxisos": { "url": "http://localhost:3002/api/mcp/v1", "headers": { "Authorization": "Bearer sk_live_..." } } } }
//
// Supporterer:
//   - initialize / initialized
//   - tools/list
//   - tools/call
//   - resources/list (returns tenants, agents)
//   - resources/read
//   - ping
import { NextResponse } from "next/server";
import { MCP_TOOLS } from "@/lib/mcp-tools";
import { executeMcpTool } from "@/lib/mcp-handlers";
import { listTenants } from "@/lib/tenants";
import { AGENTS } from "@/lib/agents";
import { resolveApiKey } from "@/lib/api-keys";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { auditLogWithContext } from "@/lib/audit";

const SERVER_INFO = {
  name: "praxisos",
  version: "1.0.0",
  description: "PraxisOS · klinisk operativsystem som MCP-server",
  vendor: "PraxisOS",
};

const PROTOCOL_VERSION = "2024-11-05";

/** Open handshake methods — no API key, but rate-limited (F59). */
const OPEN_METHODS = new Set(["initialize", "ping"]);

/** Public discovery surfaces that need tighter abuse control (F59). */
const PUBLIC_SURFACE_METHODS = new Set(["initialize", "ping", "tools/list"]);

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: any;
};

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** F59/F64 · CORS: allowlist via PRAXIS_MCP_ORIGINS; wildcard only outside production. */
function mcpCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const list = (process.env.PRAXIS_MCP_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const headers: Record<string, string> = { vary: "Origin" };
  if (list.length > 0) {
    if (origin && list.includes(origin)) {
      headers["access-control-allow-origin"] = origin;
    }
    return headers;
  }
  if (process.env.NODE_ENV !== "production") {
    headers["access-control-allow-origin"] = "*";
  }
  return headers;
}

function rpcOk(req: Request, id: any, result: any) {
  return NextResponse.json({ jsonrpc: "2.0", id, result }, {
    headers: mcpCorsHeaders(req),
  });
}

function rpcErr(req: Request, id: any, code: number, message: string, data?: any, httpStatus?: number) {
  const status =
    httpStatus ??
    (code === -32600 ? 400 : code === -32029 ? 429 : 200);
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message, data } }, {
    status,
    headers: {
      ...mcpCorsHeaders(req),
      ...(status === 429 && data?.retryAfterMs
        ? { "Retry-After": String(Math.ceil(Number(data.retryAfterMs) / 1000)) }
        : {}),
    },
  });
}

/**
 * F59 · rate-limit MCP public surface.
 * - initialize / ping: generous but finite (handshake abuse)
 * - tools/list: stricter (catalog scrape even with valid key)
 * - other methods: looser authenticated ceiling
 */
function mcpRateLimit(
  req: Request,
  method: string,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const ip = clientIp(req);
  if (PUBLIC_SURFACE_METHODS.has(method)) {
    const open = method === "tools/list";
    return checkIpRateLimit(ip, {
      key: `mcp:${method}`,
      limit: open ? 60 : 120,
      windowMs: 15 * 60 * 1000,
    });
  }
  return checkIpRateLimit(ip, {
    key: "mcp:rpc",
    limit: 300,
    windowMs: 15 * 60 * 1000,
  });
}

export async function POST(req: Request) {
  let body: JsonRpcRequest;
  try { body = await req.json(); } catch { return rpcErr(req, null, -32700, "Parse error"); }

  if (body.jsonrpc !== "2.0") return rpcErr(req, body.id, -32600, "Invalid JSON-RPC version");
  if (!body.method) return rpcErr(req, body.id, -32600, "Missing method");

  // F59 · rate-limit before auth so open handshake cannot be abused cheaply.
  const limited = mcpRateLimit(req, body.method);
  if (!limited.ok) {
    return rpcErr(
      req,
      body.id,
      -32029,
      "Rate limited",
      { retryAfterMs: limited.retryAfterMs },
      429,
    );
  }

  // Auth (P0 plan §F13): initialize + ping remain open (MCP handshake).
  // All other methods require a verified Bearer API key; the tenant is
  // resolved FROM the key (no tenant in the URL) and threaded into tool calls
  // instead of the previous hardcoded "bypilar".
  let authedTenant: string | null = null;
  if (!OPEN_METHODS.has(body.method)) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
    const resolved = resolveApiKey(token);
    if (!resolved.ok) {
      // F67 · unauthorized MCP surface audit (no token material)
      auditLogWithContext(req, "mcp.unauthorized", {
        target_ref: body.method,
        auth_mode: "api_key",
      });
      return rpcErr(
        req,
        body.id,
        -32001,
        resolved.error === "no_token"
          ? "Unauthorized · add Authorization: Bearer sk_live_..."
          : resolved.error === "key_revoked"
            ? "Unauthorized · key revoked"
            : "Unauthorized · invalid API key",
      );
    }
    authedTenant = resolved.key.tenant;
  }

  switch (body.method) {
    case "initialize":
      return rpcOk(req, body.id, {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: SERVER_INFO,
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false, subscribe: false },
          prompts: { listChanged: false },
          logging: {},
        },
      });

    case "ping":
      return rpcOk(req, body.id, {});

    case "tools/list":
      return rpcOk(req, body.id, {
        tools: MCP_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case "tools/call": {
      const { name, arguments: args } = body.params ?? {};
      const tool = MCP_TOOLS.find((t) => t.name === name);
      if (!tool) return rpcErr(req, body.id, -32601, `Unknown tool: ${name}`);

      try {
        const result = await executeMcpTool(
          name,
          (args ?? {}) as Record<string, unknown>,
          { tenant: authedTenant ?? "bypilar" },
        );
        return rpcOk(req, body.id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: Boolean((result as { isError?: boolean }).isError),
        });
      } catch (err) {
        const sample = simulateToolResult(name, args);
        return rpcOk(req, body.id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  fallback: true,
                  error: err instanceof Error ? err.message : String(err),
                  sample,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        });
      }
    }

    case "resources/list":
      return rpcOk(req, body.id, {
        resources: [
          ...listTenants().map((t) => ({
            uri: `praxisos://tenant/${t.slug}`,
            name: `Tenant: ${t.brand.name}`,
            description: `${t.legalName} · ${t.license.plan} · ${t.stats?.clients} klienter`,
            mimeType: "application/json",
          })),
          ...AGENTS.map((a) => ({
            uri: `praxisos://agent/${a.id}`,
            name: `Agent: ${a.name}`,
            description: `${a.role} — ${a.domain}`,
            mimeType: "application/json",
          })),
        ],
      });

    case "resources/read": {
      const uri: string = body.params?.uri ?? "";
      if (uri.startsWith("praxisos://tenant/")) {
        const slug = uri.replace("praxisos://tenant/", "");
        const t = listTenants().find((x) => x.slug === slug);
        if (!t) return rpcErr(req, body.id, -32602, "Resource not found");
        return rpcOk(req, body.id, {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(t, null, 2) }],
        });
      }
      if (uri.startsWith("praxisos://agent/")) {
        const id = uri.replace("praxisos://agent/", "");
        const a = AGENTS.find((x) => x.id === id);
        if (!a) return rpcErr(req, body.id, -32602, "Resource not found");
        return rpcOk(req, body.id, {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(a, null, 2) }],
        });
      }
      return rpcErr(req, body.id, -32602, "Unknown resource scheme");
    }

    case "prompts/list":
      return rpcOk(req, body.id, { prompts: [] });

    default:
      return rpcErr(req, body.id, -32601, `Method not found: ${body.method}`);
  }
}

// GET = MCP-discovery (manifest) · F59 rate-limit + F64 CORS allowlist
export async function GET(req: Request) {
  const limited = checkIpRateLimit(clientIp(req), {
    key: "mcp:discovery",
    limit: 120,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limited.retryAfterMs },
      {
        status: 429,
        headers: {
          ...mcpCorsHeaders(req),
          "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)),
        },
      },
    );
  }
  return NextResponse.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    description: SERVER_INFO.description,
    protocolVersion: PROTOCOL_VERSION,
    transport: "http",
    endpoint: "POST /api/mcp/v1",
    auth: {
      type: "bearer",
      tokenPrefix: "sk_live_",
      headerName: "Authorization",
    },
    capabilities: ["tools", "resources", "prompts", "logging"],
    toolCount: MCP_TOOLS.length,
    resourceCount: listTenants().length + AGENTS.length,
    documentation: "/admin/mcp",
  }, { headers: mcpCorsHeaders(req) });
}

// Mock tool-results (i prod: kald ægte handlers)
function simulateToolResult(name: string, args: any): any {
  switch (name) {
    case "list_bookings":
      return { count: 9, bookings: [
        { id: "bk_a1", clientName: "Mette L.", service: "Hudanalyse", startsAt: "2026-06-12T14:00:00+02:00", status: "confirmed" },
        { id: "bk_a4", clientName: "Per S.", service: "Medicinsk fodpleje", startsAt: "2026-06-13T11:30:00+02:00", status: "pending" },
      ]};
    case "create_booking":
      return { id: "bk_" + Math.random().toString(36).slice(2, 11), status: "confirmed", receiptUrl: `/r/bk_xxx`, aria: { reminderScheduled: true } };
    case "calculate_subsidy":
      return { best: { scheme: "diabetes", schemeLabel: "Diabetes-tilskud · kommunal", subsidyKr: 495, authority: "Aarhus Kommune" }, all: [
        { scheme: "danmark_g1", subsidyKr: 150, eligible: true },
        { scheme: "diabetes", subsidyKr: 495, eligible: true },
        { scheme: "helbredstillaeg", subsidyKr: 421, eligible: true },
      ]};
    case "list_clients":
      return { count: 5, clients: [
        { id: "mette", name: "Mette Lindqvist", age: 42, tag: "Æstetik" },
        { id: "per", name: "Per Sørensen", age: 73, tag: "Sårpleje" },
      ]};
    case "get_client":
      return { id: args?.clientId ?? "mette", name: "Mette Lindqvist", age: 42, consentLevel: "Sundhedsdata", mitidVerified: true };
    case "validate_voucher":
      return { valid: true, voucher: { code: args?.code, kind: "clip", sessionsRemaining: 5, serviceName: "Medicinsk fodpleje" } };
    case "draft_soap_note":
      return { S: "Patient rapporterer reduceret rødme.", O: "AR-scan viser fald i pigmentering.", A: "Positiv respons.", P: "Fortsæt protokol.", suggestedICD: ["L70.0"] };
    case "ask_agent":
      return { agent: "aria", response: "Hej — modtaget. Jeg vender tilbage med svar." };
    case "get_tenant_info":
      const t = listTenants().find((x) => x.slug === args?.tenant);
      return t ? { slug: t.slug, name: t.brand.name, plan: t.license.plan, modules: t.license.modules, clients: t.stats?.clients } : { error: "tenant not found" };
    default:
      return { ok: true, message: `${name} executed (prototype stub)`, args };
  }
}
