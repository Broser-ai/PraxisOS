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
import { listTenants } from "@/lib/tenants";
import { AGENTS } from "@/lib/agents";
import { executeMcpTool } from "@/lib/mcp-handlers";
import { ensureWorkflowSubscription } from "@/lib/agents/workflows";

const SERVER_INFO = {
  name: "praxisos",
  version: "1.0.0",
  description: "PraxisOS · klinisk operativsystem som MCP-server",
  vendor: "PraxisOS",
};

const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: any;
};

function rpcOk(id: any, result: any) {
  return NextResponse.json({ jsonrpc: "2.0", id, result }, {
    headers: { "access-control-allow-origin": "*" },
  });
}

function rpcErr(id: any, code: number, message: string, data?: any) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message, data } }, {
    status: code === -32600 ? 400 : 200,
    headers: { "access-control-allow-origin": "*" },
  });
}

export async function POST(req: Request) {
  ensureWorkflowSubscription();
  let body: JsonRpcRequest;
  try { body = await req.json(); } catch { return rpcErr(null, -32700, "Parse error"); }

  if (body.jsonrpc !== "2.0") return rpcErr(body.id, -32600, "Invalid JSON-RPC version");
  if (!body.method) return rpcErr(body.id, -32600, "Missing method");

  // Auth-tjek (lempelig for prototype — i prod: validér Bearer mod api-keys)
  const auth = req.headers.get("authorization");
  const isAuthed = auth?.startsWith("Bearer ");
  if (!isAuthed && body.method !== "initialize" && body.method !== "ping") {
    return rpcErr(body.id, -32001, "Unauthorized · add Authorization: Bearer sk_live_...");
  }

  switch (body.method) {
    case "initialize":
      return rpcOk(body.id, {
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
      return rpcOk(body.id, {});

    case "tools/list":
      return rpcOk(body.id, {
        tools: MCP_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case "tools/call": {
      const { name, arguments: args } = body.params ?? {};
      const tool = MCP_TOOLS.find((t) => t.name === name);
      if (!tool) return rpcErr(body.id, -32601, `Unknown tool: ${name}`);

      const result = await executeMcpTool(name, args ?? {}, { tenant: args?.tenant });
      return rpcOk(body.id, {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
        isError: !result.ok,
        _meta: {
          requiresApproval: result.requiresApproval ?? false,
          approvalId: result.approvalId,
        },
      });
    }

    case "resources/list":
      return rpcOk(body.id, {
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
        if (!t) return rpcErr(body.id, -32602, "Resource not found");
        return rpcOk(body.id, {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(t, null, 2) }],
        });
      }
      if (uri.startsWith("praxisos://agent/")) {
        const id = uri.replace("praxisos://agent/", "");
        const a = AGENTS.find((x) => x.id === id);
        if (!a) return rpcErr(body.id, -32602, "Resource not found");
        return rpcOk(body.id, {
          contents: [{ uri, mimeType: "application/json", text: JSON.stringify(a, null, 2) }],
        });
      }
      return rpcErr(body.id, -32602, "Unknown resource scheme");
    }

    case "prompts/list":
      return rpcOk(body.id, { prompts: [] });

    default:
      return rpcErr(body.id, -32601, `Method not found: ${body.method}`);
  }
}

// GET = MCP-discovery (manifest)
export async function GET() {
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
  }, { headers: { "access-control-allow-origin": "*" } });
}
