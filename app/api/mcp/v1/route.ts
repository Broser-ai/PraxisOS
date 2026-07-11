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
import * as footScanner from "@/lib/foot-scanner";

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

      // Foot-scanner tools proxy til Python engine — falder tilbage til stub
      // hvis engine er offline (dev-mode).
      if (name.startsWith("foot_scan.")) {
        try {
          const result = await handleFootScanTool(name, args ?? {});
          return rpcOk(body.id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            isError: false,
          });
        } catch (e: any) {
          return rpcOk(body.id, {
            content: [{ type: "text", text: JSON.stringify({ error: String(e?.message ?? e) }, null, 2) }],
            isError: true,
          });
        }
      }

      // Stub-implementering — i prod kalder vi den ægte handler
      const sample = simulateToolResult(name, args);
      return rpcOk(body.id, {
        content: [{ type: "text", text: JSON.stringify(sample, null, 2) }],
        isError: false,
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

// Physical AI · foot-scanner MCP handlers.
// Proxier direkte til den Python-baserede foot-scanner engine
// (praxisos/modules/foot-scanner). Kalder isEngineOnline() først og
// falder tilbage til deterministisk stub når engine ikke kører.
async function handleFootScanTool(name: string, args: any): Promise<any> {
  const online = await footScanner.isEngineOnline();

  switch (name) {
    case "foot_scan.new_session":
      if (!online) {
        return {
          id: `fs_stub_${Math.random().toString(36).slice(2, 10)}`,
          tenant_slug: args.tenant,
          client_id: args.clientId,
          side: args.side,
          source: args.source ?? "phone_video",
          marker_type: args.markerType ?? "a4",
          status: "capturing",
          frame_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          mesh_uri: null,
          report_uri: null,
          _stub: true,
        };
      }
      return footScanner.newSession({
        tenant: args.tenant,
        clientId: args.clientId,
        side: args.side,
        source: args.source,
        markerType: args.markerType,
      });

    case "foot_scan.ingest_video":
      if (!online) return { session_id: args.sessionId, frames_ingested: 27, total: 27, _stub: true };
      // NOTE: video-upload sker via /api/v1/[tenant]/foot-scan/[id]/frames.
      // Denne tool forudsætter at videoPath allerede er tilgængelig for engine.
      return { session_id: args.sessionId, hint: "Upload video via POST /api/v1/[tenant]/foot-scan/[id]/frames" };

    case "foot_scan.calibrate_scale":
      if (!online) return { mm_per_px: 0.412, method: args.markerType ?? "a4_contour", marker_confidence: 0.92, _stub: true };
      // engine gør skala som en del af reconstruct — her returnerer vi seneste cache
      return { hint: "Calibration is performed automatically inside foot_scan.reconstruct_mesh." };

    case "foot_scan.reconstruct_mesh":
      if (!online) {
        return {
          session_id: args.sessionId,
          engine: args.engine ?? "colmap+open3d",
          duration_ms: 84321,
          mesh_uri: `file:///stub/${args.sessionId}/mesh.ply`,
          preview_uri: null,
          stats: {
            vertex_count: 312487, face_count: 618203, watertight: true,
            volume_ml: 486.2, surface_area_cm2: 442.0, bbox_mm: [102, 265, 78],
          },
          calibration: { mm_per_px: 0.412, marker_confidence: 0.92, method: "a4_contour" },
          warnings: ["engine offline — stub result"],
          _stub: true,
        };
      }
      return footScanner.reconstruct({
        sessionId: args.sessionId,
        engine: args.engine,
        voxelSizeMm: args.voxelSizeMm,
        maxPoints: args.maxPoints,
        fillHoles: args.fillHoles,
      });

    case "foot_scan.biomechanical_report":
      if (!online) return { ...footScanner.stubReport(args.sessionId, "R"), _stub: true };
      return footScanner.report(args.sessionId);

    case "foot_scan.generate_orthotic":
      if (!online) {
        return {
          session_id: args.sessionId,
          stl_uri: `file:///stub/${args.sessionId}/orthotic.stl`,
          scad_uri: `file:///stub/${args.sessionId}/orthotic.scad`,
          manufacturing_notes: "Engine offline — stub artefakter",
          estimated_print_hours: 3.4,
          spec: args,
          _stub: true,
        };
      }
      return footScanner.orthotic({
        session_id: args.sessionId,
        material: args.material,
        arch_support_mm: args.archSupportMm,
        heel_cup_mm: args.heelCupMm,
        metatarsal_pad: args.metatarsalPad,
        heel_wedge_deg: args.heelWedgeDeg,
        forefoot_wedge_deg: args.forefootWedgeDeg,
        top_cover: args.topCover,
        print_style: args.printStyle,
      });

    case "foot_scan.list_sessions":
      if (!online) return { count: 0, sessions: [], _stub: true };
      const rows = await footScanner.listSessions({ tenant: args.tenant, clientId: args.clientId });
      return { count: rows.length, sessions: rows };

    case "foot_scan.get_session":
      if (!online) return { id: args.sessionId, status: "capturing", _stub: true };
      return footScanner.getSession(args.sessionId);

    default:
      throw new Error(`unknown foot-scanner tool: ${name}`);
  }
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
